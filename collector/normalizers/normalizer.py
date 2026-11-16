import hashlib
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any


class IsiSensNormalizer:
    """
    Multi-Vendor Meter JSON Normalizer / Adapter.
    Supports:
    - Standard IsıSens Simulator / Collector format
    - Diehl Sharky 775 (`total_energy_consumption_kwh` / `energy_mwh`)
    - Kamstrup Multical 303 (`total_heating_kwh` / `heat_energy_gj`)
    - Qundis Q heat 5.5 (`cumulated_energy_kwh`)
    """

    UNIT_FACTORS = {
        "kwh": Decimal("1.00"),
        "mwh": Decimal("1000.00"),
        "gj": Decimal("277.78"),
        "wh": Decimal("0.001"),
    }

    @classmethod
    def to_standard_contract(cls, raw_packet: Dict[str, Any]) -> Dict[str, Any]:
        device_id = str(
            raw_packet.get("device_id")
            or raw_packet.get("serial_number")
            or raw_packet.get("id")
            or ""
        ).strip()
        if not device_id:
            raise ValueError("Paket içinde geçerli 'device_id' bulunamadı.")

        source = str(raw_packet.get("source") or "simulator").strip()
        reading_type = str(raw_packet.get("reading_type") or "cumulative_energy").strip()

        # Extract value across vendor field names
        raw_val = (
            raw_packet.get("value")
            if raw_packet.get("value") is not None
            else raw_packet.get("total_energy_consumption_kwh")
            if raw_packet.get("total_energy_consumption_kwh") is not None
            else raw_packet.get("total_heating_kwh")
            if raw_packet.get("total_heating_kwh") is not None
            else raw_packet.get("cumulated_energy_kwh")
        )
        if raw_val is None:
            raise ValueError(f"Cihaz ({device_id}) paketinde okuma değeri ('value') bulunamadı.")

        raw_unit = str(raw_packet.get("unit") or "kWh").strip()
        factor = cls.UNIT_FACTORS.get(raw_unit.lower())
        if factor is None:
            raise ValueError(f"Desteklenmeyen enerji birimi: {raw_unit}")

        val_dec = (Decimal(str(raw_val)) * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        read_at = str(
            raw_packet.get("read_at")
            or raw_packet.get("timestamp")
            or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        )
        status = str(raw_packet.get("status") or "valid").strip()

        idem_seed = f"{source}|{device_id}|{reading_type}|{val_dec}|{read_at[:19]}"
        idem_key = raw_packet.get("idempotency_key") or hashlib.sha256(idem_seed.encode("utf-8")).hexdigest()[:40]

        standard_payload: Dict[str, Any] = {
            "device_id": device_id,
            "source": source,
            "reading_type": reading_type,
            "value": str(val_dec),
            "unit": "kWh",
            "read_at": read_at,
            "status": status,
            "idempotency_key": idem_key,
        }
        if raw_packet.get("rssi_dbm") is not None:
            standard_payload["rssi_dbm"] = int(raw_packet["rssi_dbm"])
        if raw_packet.get("battery_level") is not None:
            standard_payload["battery_level"] = str(raw_packet["battery_level"])
        if raw_packet.get("flow_temp_c") is not None:
            standard_payload["flow_temp_c"] = str(raw_packet["flow_temp_c"])
        if raw_packet.get("return_temp_c") is not None:
            standard_payload["return_temp_c"] = str(raw_packet["return_temp_c"])

        return standard_payload

