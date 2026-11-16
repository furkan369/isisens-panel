import json
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    BillingPeriod,
    Allocation,
    Apartment,
    Site,
    AuditLog,
)


class CentralHeating7030Calculator:
    """
    Dedicated Turkish Central Heating Expense Sharing Calculator (Merkezi Isıtma 70/30 Paylaşım Modülü).
    - Uses Decimal exclusively with ROUND_HALF_UP.
    - Separates 30% Common Share (by apartment area m2) and 70% Measured Consumption Share (by kWh).
    - Audits and reports exact kuruş rounding differences (`rounding_diff_try`).
    - Does NOT apply unverified 15°C automatic penalty calculations.
    """

    @staticmethod
    def calculate_period_preview(
        db: Session,
        billing_period_id: int,
        total_invoice_try: Decimal,
        common_ratio: Decimal = Decimal("0.3000"),
        usage_ratio: Decimal = Decimal("0.7000"),
        actor_name: str = "IsıSens Ekibi",
    ) -> Dict[str, Any]:
        period = db.get(BillingPeriod, billing_period_id)
        if not period:
            raise ValueError("Faturalandırma dönemi bulunamadı.")

        if (common_ratio + usage_ratio).quantize(Decimal("0.0001")) != Decimal("1.0000"):
            raise ValueError("Ortak pay ve tüketim payı oranları toplamı 1.00 (%100) olmalıdır.")

        apartments = db.execute(
            select(Apartment).where(Apartment.site_id == period.site_id)
        ).scalars().all()
        allocations = {
            a.apartment_id: a
            for a in db.execute(
                select(Allocation).where(Allocation.billing_period_id == period.id)
            ).scalars().all()
        }

        total_area_m2 = sum(
            (Decimal(str(a.area_m2 or "140.00")) for a in apartments), Decimal("0.00")
        )
        total_kwh = sum(
            (
                Decimal(str(alloc.consumption_kwh or "0.00"))
                for alloc in allocations.values()
                if alloc.consumption_kwh is not None and alloc.consumption_kwh > 0
            ),
            Decimal("0.00"),
        )

        common_pool_try = (total_invoice_try * common_ratio).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        usage_pool_try = (total_invoice_try * usage_ratio).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        unit_price_kwh = (
            (usage_pool_try / total_kwh).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            if total_kwh > Decimal("0.00")
            else Decimal("4.0000")
        )

        new_version = (period.calculation_version or 1) + 1
        distributed_sum = Decimal("0.00")

        for apt in apartments:
            apt_area = Decimal(str(apt.area_m2 or "140.00"))
            apt_common_try = (
                (common_pool_try * (apt_area / total_area_m2)).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                if total_area_m2 > Decimal("0.00")
                else Decimal("0.00")
            )
            alloc = allocations.get(apt.id)
            kwh = (
                Decimal(str(alloc.consumption_kwh))
                if (alloc and alloc.consumption_kwh is not None and alloc.consumption_kwh > 0)
                else Decimal("0.00")
            )
            apt_usage_try = (
                (usage_pool_try * (kwh / total_kwh)).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                if total_kwh > Decimal("0.00")
                else Decimal("0.00")
            )
            apt_total_try = (apt_common_try + apt_usage_try).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if alloc:
                alloc.common_share_try = apt_common_try
                alloc.usage_share_try = apt_usage_try
                alloc.total_amount_try = apt_total_try
                alloc.calculation_version = new_version
            distributed_sum += apt_total_try

        rounding_diff = (total_invoice_try - distributed_sum).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )

        period.total_bill_amount_try = total_invoice_try
        period.total_site_consumption_kwh = total_kwh
        period.common_share_ratio = common_ratio
        period.usage_share_ratio = usage_ratio
        period.unit_price_per_kwh = unit_price_kwh
        period.calculation_version = new_version
        period.rounding_diff_try = rounding_diff
        if period.status == "draft":
            period.status = "preview"

        db.add(
            AuditLog(
                actor_name=actor_name,
                action="BILLING_PREVIEW_CALCULATED",
                entity_type="billing_period",
                entity_id=str(period.id),
                details_json=json.dumps(
                    {
                        "period": period.name,
                        "version": new_version,
                        "total_invoice_try": str(total_invoice_try),
                        "distributed_sum_try": str(distributed_sum),
                        "rounding_diff_try": str(rounding_diff),
                        "total_kwh": str(total_kwh),
                    }
                ),
            )
        )
        db.commit()

        return {
            "billing_period_id": period.id,
            "period_name": period.name,
            "calculation_version": new_version,
            "total_invoice_try": float(total_invoice_try),
            "common_pool_try": float(common_pool_try),
            "usage_pool_try": float(usage_pool_try),
            "total_consumption_kwh": float(total_kwh),
            "distributed_sum_try": float(distributed_sum),
            "rounding_diff_try": float(rounding_diff),
            "unit_price_per_kwh": float(unit_price_kwh),
            "status": period.status,
        }

    @staticmethod
    def approve_period(
        db: Session,
        billing_period_id: int,
        user_id: int,
        actor_name: str = "IsıSens Ekibi",
    ) -> BillingPeriod:
        period = db.get(BillingPeriod, billing_period_id)
        if not period:
            raise ValueError("Faturalandırma dönemi bulunamadı.")

        period.status = "approved"
        period.approved_by_user_id = user_id
        period.approved_at = datetime.now(timezone.utc)

        allocs = db.execute(
            select(Allocation).where(Allocation.billing_period_id == period.id)
        ).scalars().all()
        for a in allocs:
            a.status = "approved"

        db.add(
            AuditLog(
                user_id=user_id,
                actor_name=actor_name,
                action="BILLING_PERIOD_APPROVED",
                entity_type="billing_period",
                entity_id=str(period.id),
                details_json=json.dumps(
                    {
                        "period": period.name,
                        "calculation_version": period.calculation_version,
                        "approved_at": period.approved_at.isoformat(),
                    }
                ),
            )
        )
        db.commit()
        db.refresh(period)
        return period
