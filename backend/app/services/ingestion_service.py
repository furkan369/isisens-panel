import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.core.security import SecretKeyVault
from app.models.entities import (
    Meter,
    MeterAssignment,
    Apartment,
    MeterReading,
    ReadingIngestEvent,
    ReadingSession,
    BillingPeriod,
    Allocation,
    Alert,
    AuditLog,
)
from app.schemas.schemas import ReadingIngestionPayload, IngestionResultOut

ALLOWED_SOURCES = {"simulator", "custom_rf", "wireless_mbus", "manual_import"}
UNIT_CONVERSION_TO_KWH = {
    "kwh": Decimal("1.000"),
    "mwh": Decimal("1000.000"),
    "gj": Decimal("277.778"),
    "wh": Decimal("0.001"),
}


class VendorPayloadNormalizer:
    """
    Normalizes vendor-specific wmbusmeters / OMS JSON frames (Diehl Sharky, Kamstrup Multical,
    Danfoss SonoSelect, Qundis Q heat) into the standard IsıSens reading contract.
    """

    @staticmethod
    def normalize(payload: ReadingIngestionPayload) -> tuple[Decimal, str, dict]:
        unit_key = (payload.unit or "kWh").strip().lower()
        if unit_key not in UNIT_CONVERSION_TO_KWH:
            raise ValueError(f"Desteklenmeyen enerji birimi: {payload.unit}")

        multiplier = UNIT_CONVERSION_TO_KWH[unit_key]
        normalized_value = (Decimal(str(payload.value)) * multiplier).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        normalized_meta = {
            "device_id": payload.device_id.strip(),
            "source": payload.source,
            "reading_type": payload.reading_type,
            "original_value": str(payload.value),
            "original_unit": payload.unit,
            "normalized_value_kwh": str(normalized_value),
            "unit": "kWh",
            "read_at": payload.read_at.isoformat(),
            "status": payload.status,
        }
        if payload.rssi_dbm is not None:
            normalized_meta["rssi_dbm"] = payload.rssi_dbm
        if payload.battery_level is not None:
            normalized_meta["battery_level"] = payload.battery_level
        return normalized_value, "kWh", normalized_meta


def compute_idempotency_key(payload: ReadingIngestionPayload) -> str:
    if payload.idempotency_key and payload.idempotency_key.strip():
        return payload.idempotency_key.strip()
    ts_str = payload.read_at.strftime("%Y-%m-%dT%H:%M:%S")
    raw = f"{payload.source}|{payload.device_id.strip()}|{payload.reading_type}|{payload.value}|{ts_str}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:40]


def process_reading_ingestion(
    db: Session,
    payload: ReadingIngestionPayload,
    collector_auth_status: str = "AUTHORIZED_COLLECTOR",
    session_id: Optional[int] = None,
) -> IngestionResultOut:
    """
    9-Step RF / Simulator Meter Reading Ingestion Pipeline:
    1. Validate collector & source
    2. Validate reading type & normalize unit
    3. Compute & check idempotency key (safe duplicate handling)
    4. Lookup meter by serial_number, wmbus_id, or technical_uid
    5. If unknown meter -> record in Unmatched Meters & raise Alert (never auto-pair randomly!)
    6. Lookup active apartment assignment & verify encryption key reference
    7. Validate reading index progression & date
    8. Persist raw reading in `meter_readings` & `reading_ingest_events` (append-only, never overwrite history)
    9. Update apartment status & current billing period preview allocation
    """
    idem_key = compute_idempotency_key(payload)
    raw_json = payload.model_dump_json()

    # Step 3: Idempotency check
    existing_event = db.execute(
        select(ReadingIngestEvent).where(ReadingIngestEvent.idempotency_key == idem_key)
    ).scalar_one_or_none()
    if existing_event is not None:
        return IngestionResultOut(
            ingest_status="duplicate_ignored",
            idempotency_key=idem_key,
            device_id=payload.device_id,
            source=payload.source,
            reading_status="duplicate",
            message="Tekrarlanan okuma paketi idempotency anahtarı ile güvenli şekilde yoksayıldı.",
        )

    # Step 1 & 2: Source & Unit validation
    if payload.source not in ALLOWED_SOURCES:
        event = ReadingIngestEvent(
            idempotency_key=idem_key,
            collector_id=payload.collector_id,
            device_id=payload.device_id,
            source=payload.source,
            raw_payload_json=raw_json,
            ingest_status="validation_error",
            error_message=f"Geçersiz veri kaynağı: {payload.source}",
        )
        db.add(event)
        db.commit()
        return IngestionResultOut(
            ingest_status="validation_error",
            idempotency_key=idem_key,
            device_id=payload.device_id,
            source=payload.source,
            reading_status="invalid_data",
            message=f"Geçersiz veri kaynağı: {payload.source}",
        )

    try:
        normalized_val, norm_unit, norm_dict = VendorPayloadNormalizer.normalize(payload)
    except ValueError as exc:
        event = ReadingIngestEvent(
            idempotency_key=idem_key,
            collector_id=payload.collector_id,
            device_id=payload.device_id,
            source=payload.source,
            raw_payload_json=raw_json,
            ingest_status="validation_error",
            error_message=str(exc),
        )
        db.add(event)
        db.commit()
        return IngestionResultOut(
            ingest_status="validation_error",
            idempotency_key=idem_key,
            device_id=payload.device_id,
            source=payload.source,
            reading_status="invalid_data",
            message=str(exc),
        )

    dev_id = payload.device_id.strip()

    # Step 4: Lookup meter in DB
    meter = db.execute(
        select(Meter).where(
            (Meter.serial_number == dev_id)
            | (Meter.wmbus_id == dev_id)
            | (Meter.technical_uid == dev_id)
        )
    ).scalar_one_or_none()

    # Step 5: Unmatched / unknown meter handling (NEVER randomly assign to an apartment!)
    if meter is None:
        unassigned_meter = Meter(
            technical_uid=f"UNM-{dev_id}",
            serial_number=dev_id,
            wmbus_id=dev_id,
            manufacturer="Bilinmeyen / Sahada Algılanan",
            model="OMS / wM-Bus Cihazı",
            communication_protocol="Wireless M-Bus",
            rf_mode="T1",
            unit=norm_unit,
            driver_name="auto_detected",
            encryption_status="AES-128-CBC",
            key_reference=None,
            battery_status=payload.battery_level or "ok",
            last_rssi_dbm=payload.rssi_dbm,
            status="unassigned",
            is_paired=False,
            is_demo=False,
        )
        db.add(unassigned_meter)
        db.flush()

        event = ReadingIngestEvent(
            idempotency_key=idem_key,
            collector_id=payload.collector_id,
            device_id=dev_id,
            source=payload.source,
            raw_payload_json=raw_json,
            normalized_payload_json=json.dumps(norm_dict),
            ingest_status="unmatched_device",
            error_message="Tanımsız sayaç kimliği; Eşleştirilmemiş Sayaçlar inceleme listesine alındı.",
            matched_meter_id=unassigned_meter.id,
        )
        db.add(event)

        alert = Alert(
            meter_id=unassigned_meter.id,
            device_id=dev_id,
            alert_type="unmatched_meter",
            severity="warning",
            title=f"Eşleştirilmemiş Sayaç Algılandı: {dev_id}",
            description=f"{payload.source} kaynağından {normalized_val} {norm_unit} endeks verisi alındı ancak sayaç hiçbir daireye atanmamış.",
            status="open",
        )
        db.add(alert)
        db.commit()

        return IngestionResultOut(
            ingest_status="unmatched_device",
            idempotency_key=idem_key,
            device_id=dev_id,
            source=payload.source,
            matched_meter_serial=dev_id,
            matched_apartment_label=None,
            new_index=float(normalized_val),
            reading_status="unmatched",
            message=f"Bilinmeyen sayaç ({dev_id}) otomatik eşlenmedi; 'Eşleştirilmemiş Sayaçlar' inceleme listesine eklendi.",
        )

    # Update optional telemetry on meter if provided
    if payload.rssi_dbm is not None:
        meter.last_rssi_dbm = payload.rssi_dbm
    if payload.battery_level is not None:
        meter.battery_status = payload.battery_level

    # Step 6: Find active apartment assignment
    active_assignment = db.execute(
        select(MeterAssignment).where(
            MeterAssignment.meter_id == meter.id,
            MeterAssignment.is_active == True,  # noqa: E712
        )
    ).scalar_one_or_none()

    if active_assignment is None or not meter.is_paired:
        event = ReadingIngestEvent(
            idempotency_key=idem_key,
            collector_id=payload.collector_id,
            device_id=dev_id,
            source=payload.source,
            raw_payload_json=raw_json,
            normalized_payload_json=json.dumps(norm_dict),
            ingest_status="unmatched_device",
            error_message="Sayaç kayıtlı ancak aktif bir daireye atanmamış.",
            matched_meter_id=meter.id,
        )
        db.add(event)
        db.commit()
        return IngestionResultOut(
            ingest_status="unmatched_device",
            idempotency_key=idem_key,
            device_id=dev_id,
            source=payload.source,
            matched_meter_serial=meter.serial_number,
            matched_apartment_label=None,
            new_index=float(normalized_val),
            reading_status="unmatched",
            message=f"Sayaç ({meter.serial_number}) henüz bir daireye atanmamış; Eşleştirilmemiş Sayaçlar listesinde.",
        )

    apartment = db.get(Apartment, active_assignment.apartment_id)

    # Check encryption key status
    if not SecretKeyVault.has_valid_key(meter.key_reference, meter.encryption_status):
        if apartment:
            apartment.last_reading_status = "missing_key"
            apartment.last_read_at = payload.read_at
        event = ReadingIngestEvent(
            idempotency_key=idem_key,
            collector_id=payload.collector_id,
            device_id=dev_id,
            source=payload.source,
            raw_payload_json=raw_json,
            normalized_payload_json=json.dumps(norm_dict),
            ingest_status="decryption_failed",
            error_message="Sayaç OMS AES-128 şifre çözme anahtarı eksik (Anahtar Eksik).",
            matched_meter_id=meter.id,
            matched_apartment_id=apartment.id if apartment else None,
        )
        db.add(event)
        db.commit()
        return IngestionResultOut(
            ingest_status="decryption_failed",
            idempotency_key=idem_key,
            device_id=dev_id,
            source=payload.source,
            matched_meter_serial=meter.serial_number,
            matched_apartment_label=apartment.flat_label if apartment else None,
            reading_status="missing_key",
            message="Sayaç için güvenlik anahtarı tanımlı değil (Anahtar Eksik).",
        )

    # Step 7: Determine baseline index and validate progression
    latest_reading = db.execute(
        select(MeterReading)
        .where(MeterReading.meter_id == meter.id)
        .order_by(desc(MeterReading.read_at), desc(MeterReading.id))
        .limit(1)
    ).scalar_one_or_none()

    # Find active billing period for the apartment's site
    active_period = None
    existing_alloc = None
    if apartment:
        active_period = db.execute(
            select(BillingPeriod)
            .where(BillingPeriod.site_id == apartment.site_id)
            .order_by(desc(BillingPeriod.end_date), desc(BillingPeriod.id))
            .limit(1)
        ).scalar_one_or_none()
        if active_period:
            existing_alloc = db.execute(
                select(Allocation).where(
                    Allocation.billing_period_id == active_period.id,
                    Allocation.apartment_id == apartment.id,
                )
            ).scalar_one_or_none()

    if existing_alloc and existing_alloc.first_index is not None:
        baseline_index = Decimal(str(existing_alloc.first_index))
    elif latest_reading is not None:
        baseline_index = Decimal(str(latest_reading.first_index or latest_reading.value))
    else:
        baseline_index = Decimal(str(active_assignment.initial_index_value or "0.00"))

    consumption_diff = (normalized_val - baseline_index).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    if payload.status in ("invalid_data", "error"):
        reading_status = "invalid_data"
        apt_status = "invalid_data"
    elif consumption_diff < Decimal("0.00"):
        # Negative index delta -> mark as invalid_data and create alert
        reading_status = "invalid_data"
        apt_status = "invalid_data"
        db.add(
            Alert(
                site_id=apartment.site_id if apartment else None,
                block_id=apartment.block_id if apartment else None,
                apartment_id=apartment.id if apartment else None,
                meter_id=meter.id,
                device_id=meter.serial_number,
                alert_type="invalid_reading",
                severity="critical",
                title=f"Geçersiz Endeks (Negatif Fark): {meter.serial_number}",
                description=f"İlk endeks {baseline_index} kWh iken gelen endeks {normalized_val} kWh.",
                status="open",
            )
        )
    elif consumption_diff == Decimal("0.00"):
        reading_status = "needs_review"
        apt_status = "needs_review"
    else:
        reading_status = "valid"
        apt_status = "read"

    # Step 8: Persist append-only reading record (never delete or overwrite historical readings!)
    new_reading = MeterReading(
        meter_id=meter.id,
        apartment_id=apartment.id if apartment else None,
        session_id=session_id,
        billing_period_id=active_period.id if active_period else None,
        reading_type=payload.reading_type,
        first_index=baseline_index,
        value=normalized_val,
        consumption_kwh=consumption_diff if consumption_diff >= Decimal("0.00") else None,
        unit=norm_unit,
        read_at=payload.read_at,
        source=payload.source,
        status=reading_status,
        rssi_dbm=payload.rssi_dbm,
        battery_level=payload.battery_level,
        flow_temp_c=payload.flow_temp_c,
        return_temp_c=payload.return_temp_c,
        idempotency_key=idem_key,
        is_official=False,
    )
    db.add(new_reading)

    event = ReadingIngestEvent(
        idempotency_key=idem_key,
        collector_id=payload.collector_id,
        device_id=dev_id,
        source=payload.source,
        raw_payload_json=raw_json,
        normalized_payload_json=json.dumps(norm_dict),
        ingest_status="processed",
        matched_meter_id=meter.id,
        matched_apartment_id=apartment.id if apartment else None,
    )
    db.add(event)

    # Step 9: Update apartment status & current period allocation preview
    if apartment:
        apartment.last_reading_status = apt_status
        apartment.last_read_at = payload.read_at

        if active_period and consumption_diff >= Decimal("0.00"):
            unit_price = Decimal(str(active_period.unit_price_per_kwh or "4.0000"))
            common_fee = Decimal(str(active_period.common_fee_per_apartment_try or "80.00"))
            usage_try = (consumption_diff * unit_price).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            total_try = (common_fee + usage_try).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

            if existing_alloc:
                existing_alloc.last_index = normalized_val
                existing_alloc.consumption_kwh = consumption_diff
                existing_alloc.common_share_try = common_fee
                existing_alloc.usage_share_try = usage_try
                existing_alloc.total_amount_try = total_try
                existing_alloc.reading_status = apt_status
                existing_alloc.meter_id = meter.id
            else:
                new_alloc = Allocation(
                    billing_period_id=active_period.id,
                    apartment_id=apartment.id,
                    meter_id=meter.id,
                    first_index=baseline_index,
                    last_index=normalized_val,
                    consumption_kwh=consumption_diff,
                    common_share_try=common_fee,
                    usage_share_try=usage_try,
                    total_amount_try=total_try,
                    reading_status=apt_status,
                    status="preview",
                )
                db.add(new_alloc)

    db.add(
        AuditLog(
            actor_name=f"Collector ({payload.source})",
            action="READING_INGESTED",
            entity_type="meter_reading",
            entity_id=meter.serial_number,
            details_json=json.dumps(
                {
                    "apartment": apartment.flat_label if apartment else None,
                    "first_index": str(baseline_index),
                    "last_index": str(normalized_val),
                    "consumption_kwh": str(consumption_diff),
                    "status": apt_status,
                }
            ),
        )
    )

    db.commit()

    return IngestionResultOut(
        ingest_status="processed",
        idempotency_key=idem_key,
        device_id=dev_id,
        source=payload.source,
        matched_meter_serial=meter.serial_number,
        matched_apartment_label=apartment.flat_label if apartment else None,
        previous_index=float(baseline_index),
        new_index=float(normalized_val),
        calculated_consumption_kwh=float(consumption_diff) if consumption_diff >= Decimal("0.00") else None,
        reading_status=apt_status,
        message=f"{apartment.flat_label if apartment else meter.serial_number} için yeni okuma ({normalized_val} {norm_unit}) başarıyla kaydedildi.",
    )

