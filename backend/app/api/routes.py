import os
import sys
import json
import time
from datetime import datetime, date, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status

# Add root path so collector package can be inspected for SQLite offline queue telemetry
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))
from collector.storage.sqlite_queue import OfflineSQLiteQueue
from collector.readers.simulator_reader import SimulatorReader
from collector.normalizers.normalizer import IsiSensNormalizer
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select, func, desc, asc, or_, case, insert
from sqlalchemy.orm import Session

from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    decode_access_token,
    security_scheme,
    verify_collector_key,
    SecretKeyVault,
)
from app.db.session import get_db, ACTIVE_DB_ENGINE_KIND
from app.models.entities import (
    User,
    Site,
    Block,
    Apartment,
    Occupant,
    Meter,
    MeterAssignment,
    ReadingSession,
    MeterReading,
    ReadingIngestEvent,
    BillingPeriod,
    Invoice,
    Allocation,
    Alert,
    AuditLog,
)
from app.schemas.schemas import (
    LoginRequest,
    TokenResponse,
    UserOut,
    UserCreate,
    SiteTreeItemOut,
    BlockSummaryOut,
    SiteCreate,
    SiteUpdate,
    BlockCreate,
    ApartmentCreate,
    MeterCreate,
    MeterAssignRequest,
    BillingPeriodCreate,
    BillingPeriodOut,
    SiteDetailSummaryOut,
    ApartmentConsumptionRowOut,
    PaginatedApartmentsOut,
    ReadingIngestionPayload,
    BatchReadingIngestionPayload,
    IngestionResultOut,
)
from app.services.ingestion_service import process_reading_ingestion
from app.services.billing_service import CentralHeating7030Calculator

router = APIRouter()


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials and credentials.credentials:
        payload = decode_access_token(credentials.credentials)
        if payload and "sub" in payload:
            user = db.execute(
                select(User).where(User.username == payload["sub"])
            ).scalar_one_or_none()
            if user and user.is_active:
                return user
    # Fallback to primary founder admin if token not supplied in local session
    founder = db.execute(select(User).order_by(User.id)).scalars().first()
    if not founder:
        raise HTTPException(status_code=401, detail="Kullanıcı oturumu bulunamadı.")
    return founder


# ============================================================================
# 1. AUTH & USERS
# ============================================================================

@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(
        select(User).where(
            or_(User.username == req.username.strip(), User.email == req.username.strip())
        )
    ).scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı veya parola hatalı.",
        )
    user.last_login_at = datetime.now(timezone.utc)
    db.add(
        AuditLog(
            user_id=user.id,
            actor_name=user.full_name,
            action="USER_LOGIN",
            entity_type="user",
            entity_id=user.username,
            details_json=json.dumps({"summary": f"{user.full_name} sisteme giriş yaptı."}),
        )
    )
    db.commit()
    db.refresh(user)
    token = create_access_token(
        subject=user.username, role=user.role, full_name=user.full_name
    )
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user_optional)):
    return UserOut.model_validate(current_user)


@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    users = db.execute(select(User).order_by(User.id)).scalars().all()
    return [UserOut.model_validate(u) for u in users]


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    req: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    exists = db.execute(
        select(User).where(or_(User.username == req.username, User.email == req.email))
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı veya e-posta zaten kayıtlı.")

    new_user = User(
        username=req.username.strip(),
        email=req.email.strip(),
        full_name=req.full_name.strip(),
        title=req.title,
        role=req.role,
        password_hash=hash_password(req.password),
        is_active=True,
        kvkk_approved=True,
    )
    db.add(new_user)
    db.add(
        AuditLog(
            user_id=current_user.id,
            actor_name=current_user.full_name,
            action="USER_CREATED",
            entity_type="user",
            entity_id=req.username,
            details_json=json.dumps({"summary": f"Yeni kullanıcı oluşturuldu: {req.full_name} ({req.role})"}),
        )
    )
    db.commit()
    db.refresh(new_user)
    return UserOut.model_validate(new_user)


# ============================================================================
# 2. OVERVIEW DASHBOARD ("Genel Bakış" - Konya Site Bazlı IsıSens Paneli)
# ============================================================================

@router.get("/overview")
def get_overview_dashboard(db: Session = Depends(get_db)):
    sites = db.execute(select(Site).order_by(Site.id)).scalars().all()
    total_sites_db = len(sites)
    total_blocks_db = db.execute(select(func.count(Block.id))).scalar_one()
    total_apts_db = db.execute(select(func.count(Apartment.id))).scalar_one()
    read_apts_db = db.execute(
        select(func.count(Apartment.id)).where(
            Apartment.last_reading_status.in_(["read", "needs_review"])
        )
    ).scalar_one()
    unread_apts_db = total_apts_db - read_apts_db
    success_rate = round((read_apts_db / total_apts_db * 100.0), 1) if total_apts_db > 0 else 0.0

    # Alert counts by category from `alerts` table
    open_alerts = db.execute(
        select(Alert.alert_type, func.count(Alert.id))
        .where(Alert.status != "resolved")
        .group_by(Alert.alert_type)
    ).all()
    alert_map = {atype: cnt for atype, cnt in open_alerts}
    total_open_alerts = sum(alert_map.values())

    # Site cards breakdown
    site_cards = []
    for s in sites[:8]:
        s_total = db.execute(
            select(func.count(Apartment.id)).where(Apartment.site_id == s.id)
        ).scalar_one()
        s_read = db.execute(
            select(func.count(Apartment.id)).where(
                Apartment.site_id == s.id,
                Apartment.last_reading_status.in_(["read", "needs_review"]),
            )
        ).scalar_one()
        s_blocks = db.execute(
            select(func.count(Block.id)).where(Block.site_id == s.id)
        ).scalar_one()
        rate = round((s_read / s_total * 100.0), 1) if s_total > 0 else 100.0
        site_cards.append(
            {
                "id": s.id,
                "name": s.name,
                "district": s.district,
                "city": s.city,
                "status": s.status,
                "is_demo": s.is_demo,
                "block_count": s_blocks,
                "apartment_count": s_total,
                "read_count": s_read,
                "success_rate": rate,
                "last_read_label": "Bugün 10:24" if s.id == 1 else "Bugün 09:56",
            }
        )

    # First 8 apartments of primary site for the mini preview widget
    first_8_apts = []
    if sites:
        apts8 = db.execute(
            select(Apartment)
            .where(Apartment.site_id == sites[0].id)
            .order_by(Apartment.apartment_no)
            .limit(8)
        ).scalars().all()
        for a in apts8:
            first_8_apts.append(
                {
                    "id": a.id,
                    "apartment_no": a.apartment_no,
                    "flat_label": a.flat_label,
                    "status": a.last_reading_status,
                }
            )

    recent_logs = db.execute(
        select(AuditLog).order_by(desc(AuditLog.created_at), desc(AuditLog.id)).limit(6)
    ).scalars().all()
    logs_out = []
    for lg in recent_logs:
        try:
            d = json.loads(lg.details_json)
            summary = d.get("summary") or f"{lg.action}: {lg.entity_id}"
        except Exception:
            summary = f"{lg.action}: {lg.entity_id}"
        logs_out.append(
            {
                "id": lg.id,
                "actor": lg.actor_name,
                "action": lg.action,
                "summary": summary,
                "time_label": lg.created_at.strftime("%H:%M") if lg.created_at else "10:24",
            }
        )

    return {
        "engine": ACTIVE_DB_ENGINE_KIND,
        "kpis": {
            "total_apartments": total_apts_db,
            "active_sites": total_sites_db,
            "total_blocks": total_blocks_db,
            "read_meters_this_month": read_apts_db,
            "unread_meters_this_month": unread_apts_db,
            "success_rate": success_rate,
            "open_alerts_count": total_open_alerts,
        },
        "alert_breakdown": {
            "low_battery": alert_map.get("low_battery", 0),
            "no_signal": alert_map.get("no_signal", 0),
            "missing_key": alert_map.get("missing_key", 0),
            "unmatched_meter": alert_map.get("unmatched_meter", 0),
            "invalid_reading": alert_map.get("invalid_reading", 0),
        },
        "sites": site_cards,
        "featured_site_preview": {
            "site": site_cards[0] if site_cards else None,
            "first_8_apartments": first_8_apts,
        },
        "recent_logs": logs_out,
    }


# ============================================================================
# 3. SITES & BLOCKS HIERARCHY & SITE DETAIL SUMMARY
# ============================================================================

@router.get("/sites", response_model=List[SiteTreeItemOut])
def list_sites_tree(
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = select(Site).order_by(Site.id)
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(or_(Site.name.ilike(q), Site.district.ilike(q), Site.code.ilike(q)))
    sites = db.execute(stmt).scalars().all()

    # Aggregate apartment counts grouped by site_id, block_id, and reading status in a single fast SQL query
    block_rows = db.execute(select(Block).order_by(Block.site_id, Block.code, Block.id)).scalars().all()
    apt_stats = db.execute(
        select(
            Apartment.site_id,
            Apartment.block_id,
            func.count(Apartment.id).label("total"),
            func.sum(
                case(
                    (Apartment.last_reading_status.in_(["read", "needs_review"]), 1),
                    else_=0,
                )
            ).label("read_cnt"),
        ).group_by(Apartment.site_id, Apartment.block_id)
    ).all()

    stats_by_block = {
        (row.site_id, row.block_id): (int(row.total or 0), int(row.read_cnt or 0))
        for row in apt_stats
    }

    blocks_by_site: dict[int, List[BlockSummaryOut]] = {}
    for b in block_rows:
        tot, rd = stats_by_block.get((b.site_id, b.id), (0, 0))
        blocks_by_site.setdefault(b.site_id, []).append(
            BlockSummaryOut(
                id=b.id,
                site_id=b.site_id,
                name=b.name,
                code=b.code,
                floor_count=b.floor_count,
                planned_apartment_count=b.planned_apartment_count,
                actual_apartment_count=tot,
                read_count=rd,
                unread_count=max(0, tot - rd),
            )
        )

    result: List[SiteTreeItemOut] = []
    for s in sites:
        s_blocks = blocks_by_site.get(s.id, [])
        tot_apts = sum(b.actual_apartment_count for b in s_blocks)
        rd_apts = sum(b.read_count for b in s_blocks)
        unrd_apts = max(0, tot_apts - rd_apts)
        rate = round((rd_apts / tot_apts * 100.0), 1) if tot_apts > 0 else 0.0
        result.append(
            SiteTreeItemOut(
                id=s.id,
                name=s.name,
                code=s.code,
                district=s.district,
                city=s.city,
                primary_protocol=s.primary_protocol,
                status=s.status,
                is_demo=s.is_demo,
                block_count=len(s_blocks),
                apartment_count=tot_apts,
                read_count=rd_apts,
                unread_count=unrd_apts,
                success_rate=rate,
                blocks=s_blocks,
            )
        )
    return result


@router.post("/sites", response_model=SiteTreeItemOut, status_code=201)
def create_site(
    req: SiteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    code = (req.code or f"KNY-{int(time.time()) % 100000}").strip().upper()
    existing = db.execute(select(Site).where(Site.code == code)).scalar_one_or_none()
    if existing:
        code = f"{code}-{int(time.time()) % 1000}"

    site = Site(
        name=req.name.strip(),
        code=code,
        district=req.district.strip(),
        city=req.city.strip(),
        address=req.address,
        heating_system=req.heating_system,
        primary_protocol=req.primary_protocol,
        status=req.status,
        is_demo=req.is_demo,
        common_share_ratio=req.common_share_ratio,
        usage_share_ratio=req.usage_share_ratio,
    )
    db.add(site)
    db.flush()

    # Create default active BillingPeriod for the new site so readings & allocations work immediately
    default_period = BillingPeriod(
        site_id=site.id,
        name="Ocak 2026",
        period_code="2026-01",
        start_date=date(2025, 12, 1),
        end_date=date(2025, 12, 31),
        unit_price_per_kwh=Decimal("4.0000"),
        common_fee_per_apartment_try=Decimal("80.00"),
        common_share_ratio=req.common_share_ratio,
        usage_share_ratio=req.usage_share_ratio,
        status="preview",
    )
    db.add(default_period)

    db.add(
        AuditLog(
            user_id=current_user.id,
            actor_name=current_user.full_name,
            action="SITE_CREATED",
            entity_type="site",
            entity_id=site.name,
            details_json=json.dumps({"summary": f"Yeni site oluşturuldu: {site.name} ({site.district}/{site.city})"}),
        )
    )
    db.commit()
    db.refresh(site)

    return SiteTreeItemOut(
        id=site.id,
        name=site.name,
        code=site.code,
        district=site.district,
        city=site.city,
        primary_protocol=site.primary_protocol,
        status=site.status,
        is_demo=site.is_demo,
        block_count=0,
        apartment_count=0,
        read_count=0,
        unread_count=0,
        success_rate=0.0,
        blocks=[],
    )


@router.put("/sites/{site_id}", response_model=SiteTreeItemOut)
def update_site(
    site_id: int,
    req: SiteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site bulunamadı.")

    if req.name is not None:
        site.name = req.name.strip()
    if req.district is not None:
        site.district = req.district.strip()
    if req.city is not None:
        site.city = req.city.strip()
    if req.address is not None:
        site.address = req.address
    if req.heating_system is not None:
        site.heating_system = req.heating_system
    if req.primary_protocol is not None:
        site.primary_protocol = req.primary_protocol
    if req.status is not None:
        site.status = req.status
    if req.is_demo is not None:
        site.is_demo = req.is_demo
    if req.common_share_ratio is not None:
        site.common_share_ratio = req.common_share_ratio
    if req.usage_share_ratio is not None:
        site.usage_share_ratio = req.usage_share_ratio

    db.add(
        AuditLog(
            user_id=current_user.id,
            actor_name=current_user.full_name,
            action="SITE_UPDATED",
            entity_type="site",
            entity_id=site.name,
            details_json=json.dumps({"summary": f"Site bilgileri güncellendi: {site.name}"}),
        )
    )
    db.commit()
    return [s for s in list_sites_tree(search=None, db=db) if s.id == site_id][0]


@router.post("/blocks", response_model=BlockSummaryOut, status_code=201)
def create_block(
    req: BlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    site = db.get(Site, req.site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site bulunamadı.")

    code = (req.code or req.name.split()[0]).strip().upper()
    blk = Block(
        site_id=site.id,
        name=req.name.strip(),
        code=code,
        floor_count=req.floor_count,
        planned_apartment_count=req.planned_apartment_count,
    )
    db.add(blk)
    db.add(
        AuditLog(
            user_id=current_user.id,
            actor_name=current_user.full_name,
            action="BLOCK_CREATED",
            entity_type="block",
            entity_id=f"{site.name} - {blk.name}",
            details_json=json.dumps({"summary": f"{site.name} sitesine {blk.name} eklendi."}),
        )
    )
    db.commit()
    db.refresh(blk)
    return BlockSummaryOut(
        id=blk.id,
        site_id=blk.site_id,
        name=blk.name,
        code=blk.code,
        floor_count=blk.floor_count,
        planned_apartment_count=blk.planned_apartment_count,
        actual_apartment_count=0,
        read_count=0,
        unread_count=0,
    )


@router.get("/blocks")
def list_all_blocks(
    site_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = select(Block, Site.name.label("site_name"), Site.district.label("district")).join(
        Site, Site.id == Block.site_id
    )
    if site_id is not None:
        stmt = stmt.where(Block.site_id == site_id)
    rows = db.execute(stmt.order_by(Block.site_id, Block.code)).all()

    apt_stats = db.execute(
        select(
            Apartment.block_id,
            func.count(Apartment.id).label("total"),
            func.sum(
                case(
                    (Apartment.last_reading_status.in_(["read", "needs_review"]), 1),
                    else_=0,
                )
            ).label("read_cnt"),
        ).group_by(Apartment.block_id)
    ).all()
    stat_map = {r.block_id: (int(r.total or 0), int(r.read_cnt or 0)) for r in apt_stats}

    out = []
    for blk, site_name, district in rows:
        tot, rd = stat_map.get(blk.id, (0, 0))
        out.append(
            {
                "id": blk.id,
                "site_id": blk.site_id,
                "site_name": site_name,
                "district": district,
                "name": blk.name,
                "code": blk.code,
                "floor_count": blk.floor_count,
                "planned_apartment_count": blk.planned_apartment_count,
                "actual_apartment_count": tot,
                "read_count": rd,
                "unread_count": max(0, tot - rd),
                "success_rate": round((rd / tot * 100.0), 1) if tot > 0 else 0.0,
            }
        )
    return out


@router.get("/sites/{site_id}/summary", response_model=SiteDetailSummaryOut)
def get_site_detail_summary(
    site_id: int,
    block_id: Optional[int] = Query(default=None),
    billing_period_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site bulunamadı.")

    periods = db.execute(
        select(BillingPeriod)
        .where(BillingPeriod.site_id == site.id)
        .order_by(desc(BillingPeriod.end_date), desc(BillingPeriod.id))
    ).scalars().all()

    active_period = None
    if billing_period_id is not None:
        active_period = next((p for p in periods if p.id == billing_period_id), None)
    if active_period is None and periods:
        active_period = periods[0]

    blocks = db.execute(
        select(Block).where(Block.site_id == site.id).order_by(Block.code, Block.id)
    ).scalars().all()

    # Compute block stats from DB
    apt_stats = db.execute(
        select(
            Apartment.block_id,
            func.count(Apartment.id).label("total"),
            func.sum(
                case(
                    (Apartment.last_reading_status.in_(["read", "needs_review"]), 1),
                    else_=0,
                )
            ).label("read_cnt"),
        )
        .where(Apartment.site_id == site.id)
        .group_by(Apartment.block_id)
    ).all()
    b_map = {r.block_id: (int(r.total or 0), int(r.read_cnt or 0)) for r in apt_stats}

    block_summaries: List[BlockSummaryOut] = []
    for b in blocks:
        tot, rd = b_map.get(b.id, (0, 0))
        block_summaries.append(
            BlockSummaryOut(
                id=b.id,
                site_id=b.site_id,
                name=b.name,
                code=b.code,
                floor_count=b.floor_count,
                planned_apartment_count=b.planned_apartment_count,
                actual_apartment_count=tot,
                read_count=rd,
                unread_count=max(0, tot - rd),
            )
        )

    # Site-level (or block-filtered if requested) KPI aggregates from DB
    total_apts = sum(b.actual_apartment_count for b in block_summaries)
    read_apts = sum(b.read_count for b in block_summaries)
    unread_apts = max(0, total_apts - read_apts)
    read_pct = round((read_apts / total_apts * 100.0), 1) if total_apts > 0 else 0.0
    unread_pct = round((unread_apts / total_apts * 100.0), 1) if total_apts > 0 else 0.0

    # Calculate total consumption & total amount from `allocations` in the active billing period
    total_kwh = Decimal("0.00")
    total_try = Decimal("0.00")
    if active_period:
        alloc_stmt = (
            select(
                func.coalesce(func.sum(Allocation.consumption_kwh), 0),
                func.coalesce(func.sum(Allocation.total_amount_try), 0),
            )
            .join(Apartment, Apartment.id == Allocation.apartment_id)
            .where(Allocation.billing_period_id == active_period.id)
        )
        if block_id is not None:
            alloc_stmt = alloc_stmt.where(Apartment.block_id == block_id)
        kwh_val, try_val = db.execute(alloc_stmt).one()
        total_kwh = Decimal(str(kwh_val or 0))
        total_try = Decimal(str(try_val or 0))

    return SiteDetailSummaryOut(
        site_id=site.id,
        site_name=site.name,
        site_code=site.code,
        district=site.district,
        city=site.city,
        status=site.status,
        is_demo=site.is_demo,
        primary_protocol=site.primary_protocol,
        block_count=len(blocks),
        total_apartments=total_apts,
        read_apartments=read_apts,
        unread_apartments=unread_apts,
        read_percentage=read_pct,
        unread_percentage=unread_pct,
        total_consumption_kwh=float(total_kwh),
        estimated_total_amount_try=float(total_try),
        active_period=BillingPeriodOut.model_validate(active_period) if active_period else None,
        available_periods=[BillingPeriodOut.model_validate(p) for p in periods],
        blocks=block_summaries,
    )


# ============================================================================
# 4. APARTMENTS & SERVER-SIDE PAGINATED CONSUMPTION TABLE
# ============================================================================

@router.get("/apartments", response_model=PaginatedApartmentsOut)
def list_apartments_consumption(
    site_id: int = Query(..., description="Site ID"),
    block_id: Optional[int] = Query(default=None, description="Optional Block ID filter"),
    billing_period_id: Optional[int] = Query(default=None, description="Optional Billing Period ID"),
    reading_status: Optional[str] = Query(default=None, description="Filter by reading_status"),
    meter_brand: Optional[str] = Query(default=None, description="Filter by meter manufacturer/model"),
    apartment_no: Optional[str] = Query(default=None, description="Filter by flat_label or apartment_no"),
    meter_serial: Optional[str] = Query(default=None, description="Filter by meter serial number"),
    search: Optional[str] = Query(default=None, description="Search flat_label, occupant, or meter serial"),
    sort_by: str = Query(default="apartment_no"),
    sort_dir: str = Query(default="asc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    # Resolve active billing period for this site
    if billing_period_id is not None:
        period = db.get(BillingPeriod, billing_period_id)
    else:
        period = db.execute(
            select(BillingPeriod)
            .where(BillingPeriod.site_id == site_id)
            .order_by(desc(BillingPeriod.end_date), desc(BillingPeriod.id))
            .limit(1)
        ).scalar_one_or_none()

    period_id = period.id if period else -1
    period_start_lbl = period.start_date.strftime("%d.%m.%Y") if period else "01.12.2025"
    period_end_lbl = period.end_date.strftime("%d.%m.%Y") if period else "31.12.2025"

    # Scope totals (for footer: e.g. "Toplam: 80 daire (A Blok) | Okunan: 78 | Okunamayan: 2")
    scope_stmt = select(
        func.count(Apartment.id),
        func.sum(
            case(
                (Apartment.last_reading_status.in_(["read", "needs_review"]), 1),
                else_=0,
            )
        ),
    ).where(Apartment.site_id == site_id)
    if block_id is not None:
        scope_stmt = scope_stmt.where(Apartment.block_id == block_id)
    scope_tot, scope_rd = db.execute(scope_stmt).one()
    scope_tot_int = int(scope_tot or 0)
    scope_rd_int = int(scope_rd or 0)
    scope_unrd_int = max(0, scope_tot_int - scope_rd_int)

    # Main joined query for apartments + block + active occupant + active meter assignment + meter + period allocation
    base_stmt = (
        select(
            Apartment,
            Block.name.label("block_name"),
            Occupant.full_name.label("occupant_name"),
            Occupant.occupant_type.label("occupant_type"),
            Meter.id.label("meter_id"),
            Meter.serial_number.label("meter_serial"),
            Meter.wmbus_id.label("meter_wmbus_id"),
            Meter.manufacturer.label("meter_manufacturer"),
            Meter.model.label("meter_model"),
            Meter.encryption_status.label("encryption_status"),
            Allocation.first_index.label("first_index"),
            Allocation.last_index.label("last_index"),
            Allocation.consumption_kwh.label("consumption_kwh"),
            Allocation.common_share_try.label("common_share_try"),
            Allocation.usage_share_try.label("usage_share_try"),
            Allocation.total_amount_try.label("total_amount_try"),
        )
        .join(Block, Block.id == Apartment.block_id)
        .outerjoin(
            Occupant,
            (Occupant.apartment_id == Apartment.id) & (Occupant.is_active == True),  # noqa: E712
        )
        .outerjoin(
            MeterAssignment,
            (MeterAssignment.apartment_id == Apartment.id) & (MeterAssignment.is_active == True),  # noqa: E712
        )
        .outerjoin(Meter, Meter.id == MeterAssignment.meter_id)
        .outerjoin(
            Allocation,
            (Allocation.apartment_id == Apartment.id) & (Allocation.billing_period_id == period_id),
        )
        .where(Apartment.site_id == site_id)
    )

    if block_id is not None:
        base_stmt = base_stmt.where(Apartment.block_id == block_id)
    if reading_status and reading_status != "all":
        base_stmt = base_stmt.where(Apartment.last_reading_status == reading_status)
    if meter_brand and meter_brand != "all":
        mb = f"%{meter_brand.strip()}%"
        base_stmt = base_stmt.where(or_(Meter.manufacturer.ilike(mb), Meter.model.ilike(mb)))
    if apartment_no and apartment_no.strip():
        apq = f"%{apartment_no.strip()}%"
        base_stmt = base_stmt.where(Apartment.flat_label.ilike(apq))
    if meter_serial and meter_serial.strip():
        msq = f"%{meter_serial.strip()}%"
        base_stmt = base_stmt.where(or_(Meter.serial_number.ilike(msq), Meter.wmbus_id.ilike(msq)))
    if search and search.strip():
        sq = f"%{search.strip()}%"
        base_stmt = base_stmt.where(
            or_(
                Apartment.flat_label.ilike(sq),
                Occupant.full_name.ilike(sq),
                Meter.serial_number.ilike(sq),
                Meter.wmbus_id.ilike(sq),
            )
        )

    # Count filtered total
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total_filtered = db.execute(count_stmt).scalar_one()

    # Sorting
    sort_map = {
        "apartment_no": Apartment.apartment_no,
        "flat_label": Apartment.flat_label,
        "occupant_name": Occupant.full_name,
        "meter_serial": Meter.serial_number,
        "first_index": Allocation.first_index,
        "last_index": Allocation.last_index,
        "consumption_kwh": Allocation.consumption_kwh,
        "total_amount_try": Allocation.total_amount_try,
        "reading_status": Apartment.last_reading_status,
        "last_read_at": Apartment.last_read_at,
    }
    sort_col = sort_map.get(sort_by, Apartment.apartment_no)
    order_expr = desc(sort_col) if sort_dir.lower() == "desc" else asc(sort_col)

    offset = (page - 1) * page_size
    rows = db.execute(
        base_stmt.order_by(Apartment.block_id, order_expr, Apartment.id).offset(offset).limit(page_size)
    ).all()

    items: List[ApartmentConsumptionRowOut] = []
    for row in rows:
        apt: Apartment = row[0]
        manuf = row.meter_manufacturer or "Diehl Metering"
        mdl = row.meter_model or "Sharky 775"
        items.append(
            ApartmentConsumptionRowOut(
                apartment_id=apt.id,
                site_id=apt.site_id,
                block_id=apt.block_id,
                block_name=row.block_name,
                apartment_no=apt.apartment_no,
                flat_label=apt.flat_label,
                floor=apt.floor,
                area_m2=float(apt.area_m2 or 140.0),
                occupant_name=row.occupant_name or "Atanmamış Sakin",
                occupant_type=row.occupant_type or "owner",
                meter_id=row.meter_id,
                meter_serial=row.meter_serial or "ATANMAMIŞ",
                meter_wmbus_id=row.meter_wmbus_id,
                meter_brand_model=f"{manuf} {mdl}",
                meter_manufacturer=manuf,
                meter_model=mdl,
                encryption_status=row.encryption_status or "AES-128-CBC",
                first_index=float(row.first_index) if row.first_index is not None else None,
                last_index=float(row.last_index) if row.last_index is not None else None,
                consumption_kwh=float(row.consumption_kwh) if row.consumption_kwh is not None else None,
                common_share_try=float(row.common_share_try) if row.common_share_try is not None else None,
                usage_share_try=float(row.usage_share_try) if row.usage_share_try is not None else None,
                total_amount_try=float(row.total_amount_try) if row.total_amount_try is not None else None,
                last_read_at=apt.last_read_at,
                reading_status=apt.last_reading_status,
                is_demo=apt.is_demo,
            )
        )

    total_pages = max(1, (total_filtered + page_size - 1) // page_size)
    return PaginatedApartmentsOut(
        items=items,
        total=total_filtered,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        scope_total_apartments=scope_tot_int,
        scope_read_apartments=scope_rd_int,
        scope_unread_apartments=scope_unrd_int,
        period_start_label=period_start_lbl,
        period_end_label=period_end_lbl,
    )


@router.post("/apartments", response_model=ApartmentConsumptionRowOut, status_code=201)
def create_apartment(
    req: ApartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    site = db.get(Site, req.site_id)
    block = db.get(Block, req.block_id)
    if not site or not block or block.site_id != site.id:
        raise HTTPException(status_code=400, detail="Geçersiz site veya blok seçimi.")

    flat_label = (req.flat_label or f"{block.code}-{req.apartment_no}").strip()

    apt = Apartment(
        site_id=site.id,
        block_id=block.id,
        apartment_no=req.apartment_no,
        flat_label=flat_label,
        floor=req.floor,
        door_number=req.door_number or str(req.apartment_no),
        area_m2=req.area_m2,
        status="occupied",
        last_reading_status="pending",
        is_demo=req.is_demo,
    )
    db.add(apt)
    db.flush()

    occ_name = (req.occupant_name or "Yeni Daire Sakini").strip()
    occ = Occupant(
        apartment_id=apt.id,
        full_name=occ_name,
        occupant_type=req.occupant_type,
        phone_masked="0532 *** ** 00",
        is_active=True,
    )
    db.add(occ)

    meter_obj = None
    if req.meter_serial and req.meter_serial.strip():
        serial_clean = req.meter_serial.strip().upper()
        meter_obj = db.execute(
            select(Meter).where(Meter.serial_number == serial_clean)
        ).scalar_one_or_none()
        if not meter_obj:
            key_ref = SecretKeyVault.register_meter_key(serial_clean, f"AES128-{serial_clean}")
            meter_obj = Meter(
                technical_uid=f"OMS-{serial_clean}",
                serial_number=serial_clean,
                wmbus_id=serial_clean.replace("-", ""),
                manufacturer=req.meter_manufacturer,
                model=req.meter_model,
                communication_protocol=site.primary_protocol,
                rf_mode="T1",
                unit="kWh",
                driver_name="sharky",
                encryption_status="AES-128-CBC",
                key_reference=key_ref,
                battery_status="ok",
                status="active",
                is_paired=True,
                is_demo=req.is_demo,
            )
            db.add(meter_obj)
            db.flush()
        else:
            meter_obj.is_paired = True
            meter_obj.status = "active"

        db.add(
            MeterAssignment(
                apartment_id=apt.id,
                meter_id=meter_obj.id,
                initial_index_value=req.initial_index,
                is_active=True,
                reason="Daire oluşturulurken tanımlandı",
                assigned_by_user_id=current_user.id,
            )
        )

    # Create initial allocation row in active billing period so initial_index is immediately visible
    active_period = db.execute(
        select(BillingPeriod)
        .where(BillingPeriod.site_id == site.id)
        .order_by(desc(BillingPeriod.end_date), desc(BillingPeriod.id))
        .limit(1)
    ).scalar_one_or_none()

    if active_period:
        db.add(
            Allocation(
                billing_period_id=active_period.id,
                apartment_id=apt.id,
                meter_id=meter_obj.id if meter_obj else None,
                first_index=req.initial_index,
                last_index=None,
                consumption_kwh=None,
                common_share_try=None,
                usage_share_try=None,
                total_amount_try=None,
                reading_status="pending",
                status="preview",
            )
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            actor_name=current_user.full_name,
            action="APARTMENT_CREATED",
            entity_type="apartment",
            entity_id=flat_label,
            details_json=json.dumps(
                {
                    "summary": f"{site.name} / {block.name} içine {flat_label} ({occ_name}) eklendi.",
                    "meter_serial": meter_obj.serial_number if meter_obj else None,
                }
            ),
        )
    )
    db.commit()

    return ApartmentConsumptionRowOut(
        apartment_id=apt.id,
        site_id=site.id,
        block_id=block.id,
        block_name=block.name,
        apartment_no=apt.apartment_no,
        flat_label=apt.flat_label,
        floor=apt.floor,
        area_m2=float(apt.area_m2),
        occupant_name=occ_name,
        occupant_type=req.occupant_type,
        meter_id=meter_obj.id if meter_obj else None,
        meter_serial=meter_obj.serial_number if meter_obj else "ATANMAMIŞ",
        meter_wmbus_id=meter_obj.wmbus_id if meter_obj else None,
        meter_brand_model=f"{meter_obj.manufacturer} {meter_obj.model}" if meter_obj else "Atanmamış",
        meter_manufacturer=meter_obj.manufacturer if meter_obj else "",
        meter_model=meter_obj.model if meter_obj else "",
        encryption_status=meter_obj.encryption_status if meter_obj else "unencrypted",
        first_index=float(req.initial_index),
        last_index=None,
        consumption_kwh=None,
        common_share_try=None,
        usage_share_try=None,
        total_amount_try=None,
        last_read_at=None,
        reading_status="pending",
        is_demo=apt.is_demo,
    )


@router.get("/apartments/{apartment_id}/detail")
def get_apartment_detail(apartment_id: int, db: Session = Depends(get_db)):
    apt = db.get(Apartment, apartment_id)
    if not apt:
        raise HTTPException(status_code=404, detail="Daire bulunamadı.")

    site = db.get(Site, apt.site_id)
    block = db.get(Block, apt.block_id)
    occupants = db.execute(
        select(Occupant).where(Occupant.apartment_id == apt.id).order_by(desc(Occupant.is_active), desc(Occupant.id))
    ).scalars().all()

    assignments = db.execute(
        select(MeterAssignment, Meter)
        .join(Meter, Meter.id == MeterAssignment.meter_id)
        .where(MeterAssignment.apartment_id == apt.id)
        .order_by(desc(MeterAssignment.is_active), desc(MeterAssignment.assigned_at))
    ).all()

    readings = db.execute(
        select(MeterReading, Meter.serial_number)
        .join(Meter, Meter.id == MeterReading.meter_id)
        .where(MeterReading.apartment_id == apt.id)
        .order_by(desc(MeterReading.read_at), desc(MeterReading.id))
        .limit(50)
    ).all()

    allocations = db.execute(
        select(Allocation, BillingPeriod)
        .join(BillingPeriod, BillingPeriod.id == Allocation.billing_period_id)
        .where(Allocation.apartment_id == apt.id)
        .order_by(desc(BillingPeriod.end_date), desc(Allocation.id))
    ).all()

    return {
        "apartment": {
            "id": apt.id,
            "site_id": apt.site_id,
            "site_name": site.name if site else "",
            "block_id": apt.block_id,
            "block_name": block.name if block else "",
            "apartment_no": apt.apartment_no,
            "flat_label": apt.flat_label,
            "floor": apt.floor,
            "area_m2": float(apt.area_m2 or 140.0),
            "reading_status": apt.last_reading_status,
            "last_read_at": apt.last_read_at,
            "is_demo": apt.is_demo,
        },
        "occupants": [
            {
                "id": o.id,
                "full_name": o.full_name,
                "occupant_type": o.occupant_type,
                "phone_masked": o.phone_masked,
                "is_active": o.is_active,
                "start_date": o.start_date,
            }
            for o in occupants
        ],
        "meter_assignments": [
            {
                "assignment_id": ma.id,
                "meter_id": m.id,
                "serial_number": m.serial_number,
                "wmbus_id": m.wmbus_id,
                "manufacturer": m.manufacturer,
                "model": m.model,
                "protocol": m.communication_protocol,
                "rf_mode": m.rf_mode,
                "unit": m.unit,
                "encryption_status": m.encryption_status,
                "key_reference": m.key_reference,
                "battery_status": m.battery_status,
                "last_rssi_dbm": m.last_rssi_dbm,
                "assigned_at": ma.assigned_at,
                "unassigned_at": ma.unassigned_at,
                "initial_index_value": float(ma.initial_index_value or 0.0),
                "is_active": ma.is_active,
                "reason": ma.reason,
            }
            for ma, m in assignments
        ],
        "readings_history": [
            {
                "id": r.id,
                "meter_serial": m_serial,
                "reading_type": r.reading_type,
                "first_index": float(r.first_index or 0.0),
                "value": float(r.value),
                "consumption_kwh": float(r.consumption_kwh) if r.consumption_kwh is not None else None,
                "unit": r.unit,
                "read_at": r.read_at,
                "source": r.source,
                "status": r.status,
                "rssi_dbm": r.rssi_dbm,
                "battery_level": r.battery_level,
                "flow_temp_c": float(r.flow_temp_c) if r.flow_temp_c is not None else None,
                "return_temp_c": float(r.return_temp_c) if r.return_temp_c is not None else None,
                "idempotency_key": r.idempotency_key,
                "is_official": r.is_official,
            }
            for r, m_serial in readings
        ],
        "billing_history": [
            {
                "allocation_id": al.id,
                "period_id": bp.id,
                "period_name": bp.name,
                "period_code": bp.period_code,
                "start_date": bp.start_date,
                "end_date": bp.end_date,
                "first_index": float(al.first_index or 0.0),
                "last_index": float(al.last_index) if al.last_index is not None else None,
                "consumption_kwh": float(al.consumption_kwh) if al.consumption_kwh is not None else None,
                "common_share_try": float(al.common_share_try) if al.common_share_try is not None else None,
                "usage_share_try": float(al.usage_share_try) if al.usage_share_try is not None else None,
                "total_amount_try": float(al.total_amount_try) if al.total_amount_try is not None else None,
                "calculation_version": al.calculation_version,
                "status": al.status,
            }
            for al, bp in allocations
        ],
    }


# ============================================================================
# 5. METERS & UNMATCHED METERS MANAGEMENT
# ============================================================================

@router.get("/meters")
def list_meters(
    site_id: Optional[int] = Query(default=None),
    paired_only: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = (
        select(
            Meter,
            Apartment.id.label("apartment_id"),
            Apartment.flat_label.label("flat_label"),
            Site.name.label("site_name"),
            Block.name.label("block_name"),
        )
        .outerjoin(
            MeterAssignment,
            (MeterAssignment.meter_id == Meter.id) & (MeterAssignment.is_active == True),  # noqa: E712
        )
        .outerjoin(Apartment, Apartment.id == MeterAssignment.apartment_id)
        .outerjoin(Site, Site.id == Apartment.site_id)
        .outerjoin(Block, Block.id == Apartment.block_id)
    )
    if site_id is not None:
        stmt = stmt.where(Apartment.site_id == site_id)
    if paired_only is True:
        stmt = stmt.where(Meter.is_paired == True)  # noqa: E712
    elif paired_only is False:
        stmt = stmt.where(Meter.is_paired == False)  # noqa: E712
    if search and search.strip():
        sq = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Meter.serial_number.ilike(sq),
                Meter.wmbus_id.ilike(sq),
                Meter.manufacturer.ilike(sq),
                Meter.model.ilike(sq),
                Apartment.flat_label.ilike(sq),
            )
        )

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(
        stmt.order_by(Meter.is_paired.asc(), Meter.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = []
    for m, apt_id, flat_lbl, s_name, b_name in rows:
        items.append(
            {
                "id": m.id,
                "technical_uid": m.technical_uid,
                "serial_number": m.serial_number,
                "wmbus_id": m.wmbus_id,
                "manufacturer": m.manufacturer,
                "model": m.model,
                "communication_protocol": m.communication_protocol,
                "rf_mode": m.rf_mode,
                "unit": m.unit,
                "driver_name": m.driver_name,
                "encryption_status": m.encryption_status,
                "key_reference": m.key_reference,  # Only opaque vault reference, never plaintext key!
                "battery_status": m.battery_status,
                "last_rssi_dbm": m.last_rssi_dbm,
                "status": m.status,
                "is_paired": m.is_paired,
                "apartment_id": apt_id,
                "flat_label": flat_lbl,
                "site_name": s_name,
                "block_name": b_name,
            }
        )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/meters/unmatched")
def list_unmatched_meters(db: Session = Depends(get_db)):
    unpaired = db.execute(
        select(Meter).where(or_(Meter.is_paired == False, Meter.status == "unassigned")).order_by(desc(Meter.id))  # noqa: E712
    ).scalars().all()

    out = []
    for m in unpaired:
        last_evt = db.execute(
            select(ReadingIngestEvent)
            .where(ReadingIngestEvent.device_id == m.serial_number)
            .order_by(desc(ReadingIngestEvent.received_at), desc(ReadingIngestEvent.id))
            .limit(1)
        ).scalar_one_or_none()
        last_val = None
        last_src = "wireless_mbus"
        last_ts = m.created_at
        if last_evt:
            last_src = last_evt.source
            last_ts = last_evt.received_at
            try:
                parsed = json.loads(last_evt.raw_payload_json)
                last_val = parsed.get("value")
            except Exception:
                pass
        out.append(
            {
                "id": m.id,
                "serial_number": m.serial_number,
                "wmbus_id": m.wmbus_id,
                "manufacturer": m.manufacturer,
                "model": m.model,
                "protocol": m.communication_protocol,
                "rf_mode": m.rf_mode,
                "unit": m.unit,
                "last_detected_value": last_val,
                "last_source": last_src,
                "last_detected_at": last_ts,
                "last_rssi_dbm": m.last_rssi_dbm,
                "status": m.status,
            }
        )
    return out


@router.post("/meters", status_code=201)
def create_meter(
    req: MeterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    serial = req.serial_number.strip().upper()
    existing = db.execute(select(Meter).where(Meter.serial_number == serial)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"{serial} seri numaralı sayaç zaten kayıtlı.")

    key_ref = None
    if req.encryption_status != "missing_key":
        key_ref = SecretKeyVault.register_meter_key(
            serial, req.raw_aes_key_hex or f"AES128-OMS-{serial}"
        )

    is_paired = req.apartment_id is not None
    m = Meter(
        technical_uid=f"OMS-{serial}",
        serial_number=serial,
        wmbus_id=(req.wmbus_id or serial.replace("-", "")).strip(),
        manufacturer=req.manufacturer,
        model=req.model,
        communication_protocol=req.communication_protocol,
        rf_mode=req.rf_mode,
        unit=req.unit,
        driver_name=req.driver_name,
        encryption_status=req.encryption_status,
        key_reference=key_ref,
        battery_status="ok",
        status="active" if is_paired else "unassigned",
        is_paired=is_paired,
        is_demo=req.is_demo,
    )
    db.add(m)
    db.flush()

    if req.apartment_id is not None:
        apt = db.get(Apartment, req.apartment_id)
        if apt:
            # Deactivate previous active meter assignment while preserving history
            old_assigns = db.execute(
                select(MeterAssignment).where(
                    MeterAssignment.apartment_id == apt.id,
                    MeterAssignment.is_active == True,  # noqa: E712
                )
            ).scalars().all()
            for oa in old_assigns:
                oa.is_active = False
                oa.unassigned_at = datetime.now(timezone.utc)

            db.add(
                MeterAssignment(
                    apartment_id=apt.id,
                    meter_id=m.id,
                    initial_index_value=req.initial_index_value,
                    is_active=True,
                    reason="Yeni sayaç kaydı ve daire eşleştirmesi",
                    assigned_by_user_id=current_user.id,
                )
            )

    db.commit()
    db.refresh(m)
    return {
        "id": m.id,
        "serial_number": m.serial_number,
        "wmbus_id": m.wmbus_id,
        "key_reference": m.key_reference,
        "is_paired": m.is_paired,
    }


@router.post("/meters/assign")
def assign_meter_to_apartment(
    req: MeterAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    apt = db.get(Apartment, req.apartment_id)
    meter = db.get(Meter, req.meter_id)
    if not apt or not meter:
        raise HTTPException(status_code=404, detail="Daire veya sayaç bulunamadı.")

    now = datetime.now(timezone.utc)
    # Close any previous active assignment on this apartment or this meter (preserving history!)
    prev_assigns = db.execute(
        select(MeterAssignment).where(
            or_(
                MeterAssignment.apartment_id == apt.id,
                MeterAssignment.meter_id == meter.id,
            ),
            MeterAssignment.is_active == True,  # noqa: E712
        )
    ).scalars().all()
    for pa in prev_assigns:
        pa.is_active = False
        pa.unassigned_at = now

    if not meter.key_reference and meter.encryption_status != "missing_key":
        meter.key_reference = SecretKeyVault.register_meter_key(
            meter.serial_number, f"AES128-{meter.serial_number}"
        )

    meter.is_paired = True
    meter.status = "active"

    new_assign = MeterAssignment(
        apartment_id=apt.id,
        meter_id=meter.id,
        assigned_at=now,
        initial_index_value=req.initial_index_value,
        is_active=True,
        reason=req.reason or "Operatör tarafından eşleştirildi",
        assigned_by_user_id=current_user.id,
    )
    db.add(new_assign)

    db.add(
        AuditLog(
            user_id=current_user.id,
            actor_name=current_user.full_name,
            action="METER_ASSIGNED",
            entity_type="meter_assignment",
            entity_id=f"{apt.flat_label} <- {meter.serial_number}",
            details_json=json.dumps(
                {"summary": f"{meter.serial_number} sayacı {apt.flat_label} dairesine eşleştirildi."}
            ),
        )
    )
    db.commit()
    return {"status": "ok", "apartment_label": apt.flat_label, "meter_serial": meter.serial_number}


# ============================================================================
# 6. RF READING INGESTION & LIVE TELEMETRY ("Okumalar" & Python Collector)
# ============================================================================

@router.post("/ingestion/readings", response_model=IngestionResultOut)
def ingest_single_reading(
    payload: ReadingIngestionPayload,
    db: Session = Depends(get_db),
    collector_auth: str = Depends(verify_collector_key),
):
    return process_reading_ingestion(
        db=db,
        payload=payload,
        collector_auth_status=collector_auth,
    )


@router.post("/ingestion/batch")
def ingest_batch_readings(
    batch: BatchReadingIngestionPayload,
    db: Session = Depends(get_db),
    collector_auth: str = Depends(verify_collector_key),
):
    session_code = batch.session_code or f"SES-{int(time.time())}"
    session_obj = ReadingSession(
        session_code=session_code,
        collector_id=batch.collector_id,
        source=batch.readings[0].source if batch.readings else "simulator",
        adapter_name="CollectorBatchSync",
        total_packets=len(batch.readings),
        status="active",
    )
    db.add(session_obj)
    db.flush()

    results = []
    valid_cnt = 0
    err_cnt = 0
    unmatched_cnt = 0

    for item in batch.readings:
        res = process_reading_ingestion(
            db=db,
            payload=item,
            collector_auth_status=collector_auth,
            session_id=session_obj.id,
        )
        results.append(res)
        if res.ingest_status == "processed":
            valid_cnt += 1
        elif res.ingest_status == "unmatched_device":
            unmatched_cnt += 1
        elif res.ingest_status in ("validation_error", "decryption_failed"):
            err_cnt += 1

    session_obj.valid_readings_count = valid_cnt
    session_obj.error_count = err_cnt
    session_obj.unmatched_count = unmatched_cnt
    session_obj.ended_at = datetime.now(timezone.utc)
    session_obj.status = "completed"
    db.commit()

    return {
        "session_code": session_code,
        "total_received": len(batch.readings),
        "processed": valid_cnt,
        "unmatched": unmatched_cnt,
        "errors": err_cnt,
        "results": results,
    }


@router.get("/readings/status")
def get_readings_live_status(db: Session = Depends(get_db)):
    total_readings = db.execute(select(func.count(MeterReading.id))).scalar_one()
    error_events = db.execute(
        select(func.count(ReadingIngestEvent.id)).where(
            ReadingIngestEvent.ingest_status.in_(["validation_error", "decryption_failed"])
        )
    ).scalar_one()
    unmatched_meters = db.execute(
        select(func.count(Meter.id)).where(or_(Meter.is_paired == False, Meter.status == "unassigned"))  # noqa: E712
    ).scalar_one()

    latest_reading = db.execute(
        select(MeterReading).order_by(desc(MeterReading.read_at), desc(MeterReading.id)).limit(1)
    ).scalar_one_or_none()

    sessions = db.execute(
        select(ReadingSession).order_by(desc(ReadingSession.started_at), desc(ReadingSession.id)).limit(10)
    ).scalars().all()

    recent_events = db.execute(
        select(
            ReadingIngestEvent,
            Meter.serial_number.label("meter_serial"),
            Apartment.flat_label.label("flat_label"),
        )
        .outerjoin(Meter, Meter.id == ReadingIngestEvent.matched_meter_id)
        .outerjoin(Apartment, Apartment.id == ReadingIngestEvent.matched_apartment_id)
        .order_by(desc(ReadingIngestEvent.received_at), desc(ReadingIngestEvent.id))
        .limit(30)
    ).all()

    recent_readings = db.execute(
        select(
            MeterReading,
            Meter.serial_number.label("meter_serial"),
            Meter.manufacturer.label("manufacturer"),
            Meter.model.label("model"),
            Apartment.flat_label.label("flat_label"),
            Site.name.label("site_name"),
        )
        .join(Meter, Meter.id == MeterReading.meter_id)
        .outerjoin(Apartment, Apartment.id == MeterReading.apartment_id)
        .outerjoin(Site, Site.id == Apartment.site_id)
        .order_by(desc(MeterReading.read_at), desc(MeterReading.id))
        .limit(40)
    ).all()

    sqlite_queue = OfflineSQLiteQueue()
    q_stats = sqlite_queue.stats()
    q_pending_rows = sqlite_queue.get_pending(limit=20)

    return {
        "collector_status": {
            "collector_id": "COLLECTOR-KONYA-01",
            "connection_state": "connected_ready",
            "active_adapter": "SimulatorReader (WMBusReader Hazır)",
            "supported_sources": ["simulator", "custom_rf", "wireless_mbus", "manual_import"],
            "last_received_at": latest_reading.read_at if latest_reading else None,
            "last_source": latest_reading.source if latest_reading else "simulator",
            "total_readings_stored": total_readings,
            "error_packets_count": error_events,
            "unmatched_meters_count": unmatched_meters,
            "pending_sqlite_sync_count": q_stats["pending"],
            "synced_sqlite_count": q_stats["synced"],
        },
        "pending_sqlite_items": q_pending_rows,
        "sessions": [
            {
                "id": s.id,
                "session_code": s.session_code,
                "collector_id": s.collector_id,
                "source": s.source,
                "adapter_name": s.adapter_name,
                "started_at": s.started_at,
                "ended_at": s.ended_at,
                "total_packets": s.total_packets,
                "valid_readings_count": s.valid_readings_count,
                "error_count": s.error_count,
                "unmatched_count": s.unmatched_count,
                "status": s.status,
            }
            for s in sessions
        ],
        "recent_events": [
            {
                "id": ev.id,
                "idempotency_key": ev.idempotency_key,
                "collector_id": ev.collector_id,
                "device_id": ev.device_id,
                "source": ev.source,
                "ingest_status": ev.ingest_status,
                "error_message": ev.error_message,
                "flat_label": flat_lbl,
                "received_at": ev.received_at,
            }
            for ev, m_ser, flat_lbl in recent_events
        ],
        "recent_readings": [
            {
                "id": mr.id,
                "meter_serial": m_ser,
                "brand_model": f"{manuf} {mdl}",
                "flat_label": flat_lbl or "Eşleştirilmemiş",
                "site_name": s_name or "—",
                "first_index": float(mr.first_index or 0.0),
                "value": float(mr.value),
                "consumption_kwh": float(mr.consumption_kwh) if mr.consumption_kwh is not None else None,
                "unit": mr.unit,
                "source": mr.source,
                "status": mr.status,
                "rssi_dbm": mr.rssi_dbm,
                "battery_level": mr.battery_level,
                "read_at": mr.read_at,
            }
            for mr, m_ser, manuf, mdl, flat_lbl, s_name in recent_readings
        ],
    }


@router.post("/readings/collector-enqueue")
def collector_enqueue_offline(
    device_id: str = Query(..., description="Sayaç seri no / wM-Bus ID"),
    value: Decimal = Query(..., description="Endeks değeri (kWh)"),
    source: str = Query(default="simulator"),
):
    """
    Simulates an internet outage in the field: the Python Collector reads the meter via SimulatorReader,
    normalizes the JSON payload, and saves it into local SQLite (`collector_offline_queue.db`) with
    status='pending' without sending to PostgreSQL yet.
    """
    reader = SimulatorReader()
    reader.connect()
    raw_pkt = reader.generate_single_reading(
        device_id=device_id,
        value=value,
        unit="kWh",
        rssi_dbm=-66,
        battery_level="ok",
    )
    raw_pkt["source"] = source
    normalized = IsiSensNormalizer.to_standard_contract(raw_pkt)
    queue = OfflineSQLiteQueue()
    row_id = queue.enqueue(normalized)
    reader.close()
    return {
        "status": "queued_offline_sqlite",
        "sqlite_row_id": row_id,
        "payload": normalized,
        "queue_stats": queue.stats(),
    }


@router.post("/readings/collector-sync")
def collector_sync_pending_to_db(db: Session = Depends(get_db)):
    """
    Synchronizes all pending readings stored in the Collector's local SQLite queue into PostgreSQL/SQLAlchemy
    and marks each SQLite record as 'synced'.
    """
    queue = OfflineSQLiteQueue()
    pending = queue.get_pending(limit=100)
    synced = 0
    results = []
    for row in pending:
        payload_dict = json.loads(row["payload_json"])
        req_obj = ReadingIngestionPayload(
            device_id=payload_dict["device_id"],
            source=payload_dict.get("source", "simulator"),
            reading_type=payload_dict.get("reading_type", "cumulative_energy"),
            value=Decimal(str(payload_dict["value"])),
            unit=payload_dict.get("unit", "kWh"),
            read_at=datetime.fromisoformat(payload_dict["read_at"].replace("Z", "+00:00")),
            status=payload_dict.get("status", "valid"),
            idempotency_key=payload_dict.get("idempotency_key"),
            rssi_dbm=payload_dict.get("rssi_dbm"),
            battery_level=payload_dict.get("battery_level"),
        )
        res = process_reading_ingestion(db=db, payload=req_obj, collector_auth_status="SQLITE_SYNC")
        queue.mark_synced(row["id"], res.model_dump())
        results.append(res)
        synced += 1

    return {
        "status": "synced",
        "synced_count": synced,
        "queue_stats": queue.stats(),
        "results": results,
    }


# ============================================================================
# 7. BILLING PERIODS & EXPENSE DISTRIBUTION ("Faturalandırma")
# ============================================================================

@router.get("/billing/periods", response_model=List[BillingPeriodOut])
def list_billing_periods(
    site_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = select(BillingPeriod).order_by(desc(BillingPeriod.end_date), desc(BillingPeriod.id))
    if site_id is not None:
        stmt = stmt.where(BillingPeriod.site_id == site_id)
    periods = db.execute(stmt).scalars().all()
    return [BillingPeriodOut.model_validate(p) for p in periods]


@router.post("/billing/periods", response_model=BillingPeriodOut, status_code=201)
def create_billing_period(
    req: BillingPeriodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    site = db.get(Site, req.site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site bulunamadı.")

    bp = BillingPeriod(
        site_id=site.id,
        name=req.name.strip(),
        period_code=req.period_code.strip(),
        start_date=req.start_date,
        end_date=req.end_date,
        total_bill_amount_try=req.total_bill_amount_try,
        unit_price_per_kwh=req.unit_price_per_kwh,
        common_fee_per_apartment_try=req.common_fee_per_apartment_try,
        common_share_ratio=req.common_share_ratio,
        usage_share_ratio=req.usage_share_ratio,
        calculation_method="TR_MERKEZI_70_30_DECIMAL",
        calculation_version=1,
        status="preview",
    )
    db.add(bp)
    db.flush()

    # Copy baseline allocations from latest existing period or apartment initial indexes
    apts = db.execute(select(Apartment).where(Apartment.site_id == site.id)).scalars().all()
    for a in apts:
        latest_mr = db.execute(
            select(MeterReading)
            .where(MeterReading.apartment_id == a.id)
            .order_by(desc(MeterReading.read_at), desc(MeterReading.id))
            .limit(1)
        ).scalar_one_or_none()

        f_idx = Decimal(str(latest_mr.first_index)) if latest_mr else Decimal("1000.00")
        l_idx = Decimal(str(latest_mr.value)) if latest_mr else None
        cons = (l_idx - f_idx) if l_idx is not None else None
        c_try = req.common_fee_per_apartment_try if cons is not None else None
        u_try = (cons * req.unit_price_per_kwh).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if cons is not None else None
        t_try = (c_try + u_try) if (c_try is not None and u_try is not None) else None

        db.add(
            Allocation(
                billing_period_id=bp.id,
                apartment_id=a.id,
                meter_id=latest_mr.meter_id if latest_mr else None,
                first_index=f_idx,
                last_index=l_idx,
                consumption_kwh=cons,
                common_share_try=c_try,
                usage_share_try=u_try,
                total_amount_try=t_try,
                reading_status=a.last_reading_status,
                status="preview",
            )
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            actor_name=current_user.full_name,
            action="BILLING_PERIOD_CREATED",
            entity_type="billing_period",
            entity_id=f"{site.name} - {bp.name}",
            details_json=json.dumps({"summary": f"{site.name} için {bp.name} dönemi oluşturuldu."}),
        )
    )
    db.commit()
    db.refresh(bp)
    return BillingPeriodOut.model_validate(bp)


@router.post("/billing/periods/{period_id}/calculate")
def calculate_billing_preview(
    period_id: int,
    total_invoice_try: Decimal = Query(..., description="Bina toplam doğalgaz/ısı faturası tutarı (₺)"),
    common_ratio: Decimal = Query(default=Decimal("0.3000")),
    usage_ratio: Decimal = Query(default=Decimal("0.7000")),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    try:
        return CentralHeating7030Calculator.calculate_period_preview(
            db=db,
            billing_period_id=period_id,
            total_invoice_try=total_invoice_try,
            common_ratio=common_ratio,
            usage_ratio=usage_ratio,
            actor_name=current_user.full_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/billing/periods/{period_id}/approve", response_model=BillingPeriodOut)
def approve_billing_period(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    try:
        bp = CentralHeating7030Calculator.approve_period(
            db=db,
            billing_period_id=period_id,
            user_id=current_user.id,
            actor_name=current_user.full_name,
        )
        return BillingPeriodOut.model_validate(bp)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ============================================================================
# 8. ALERTS, AUDIT LOGS & 60,000 APARTMENT SCALE BENCHMARK
# ============================================================================

@router.get("/alerts")
def list_alerts(
    status_filter: Optional[str] = Query(default=None),
    alert_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Alert, Site.name.label("site_name"))
        .outerjoin(Site, Site.id == Alert.site_id)
        .order_by(Alert.status.asc(), desc(Alert.created_at), desc(Alert.id))
    )
    if status_filter and status_filter != "all":
        stmt = stmt.where(Alert.status == status_filter)
    if alert_type and alert_type != "all":
        stmt = stmt.where(Alert.alert_type == alert_type)
    rows = db.execute(stmt).all()
    return [
        {
            "id": a.id,
            "site_id": a.site_id,
            "site_name": s_name or "Saha Geneli",
            "device_id": a.device_id,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "title": a.title,
            "description": a.description,
            "status": a.status,
            "created_at": a.created_at,
            "resolved_at": a.resolved_at,
        }
        for a, s_name in rows
    ]


@router.patch("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Uyarı bulunamadı.")
    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    db.add(
        AuditLog(
            user_id=current_user.id,
            actor_name=current_user.full_name,
            action="ALERT_RESOLVED",
            entity_type="alert",
            entity_id=str(alert.id),
            details_json=json.dumps({"summary": f"Uyarı çözüldü olarak işaretlendi: {alert.title}"}),
        )
    )
    db.commit()
    return {"status": "resolved", "id": alert.id}


@router.get("/audit-logs")
def list_audit_logs(limit: int = Query(default=50, le=200), db: Session = Depends(get_db)):
    logs = db.execute(
        select(AuditLog).order_by(desc(AuditLog.created_at), desc(AuditLog.id)).limit(limit)
    ).scalars().all()
    return [
        {
            "id": lg.id,
            "actor_name": lg.actor_name,
            "action": lg.action,
            "entity_type": lg.entity_type,
            "entity_id": lg.entity_id,
            "details_json": lg.details_json,
            "created_at": lg.created_at,
        }
        for lg in logs
    ]


@router.post("/system/generate-60k")
def generate_60k_scale_dataset(
    target_total: int = Query(default=60000, ge=1000, le=100000),
    db: Session = Depends(get_db),
):
    """
    Stage 6: Generates up to 60,000 apartments in the database to test server-side pagination,
    composite indexes, and sub-50ms query performance without overloading the browser.
    """
    t0 = time.perf_counter()
    current_count = db.execute(select(func.count(Apartment.id))).scalar_one()
    needed = max(0, target_total - current_count)
    if needed == 0:
        t1 = time.perf_counter()
        return {
            "message": f"Veritabanında zaten {current_count} daire mevcut.",
            "total_apartments": current_count,
            "inserted": 0,
            "elapsed_ms": round((t1 - t0) * 1000, 2),
        }

    # Create or get a dedicated Konya Mega Ölçek Test Sitesi so Selçuklu Park Evleri's exact 320-apartment KPIs remain intact!
    mega_site = db.execute(
        select(Site).where(Site.code == "KNY-MEGA-60K")
    ).scalar_one_or_none()
    if not mega_site:
        mega_site = Site(
            name="Konya Büyükşehir 60K Ölçek Test Sitesi (Demo)",
            code="KNY-MEGA-60K",
            district="Selçuklu",
            city="Konya",
            address="Konya Teknokent Yük Testi Kampüsü",
            heating_system="Merkezi Kalorimetre",
            primary_protocol="SHARKY / OMS",
            status="active",
            is_demo=True,
        )
        db.add(mega_site)
        db.flush()

        mega_block = Block(
            site_id=mega_site.id,
            name="M Blok (Yük Testi)",
            code="M",
            floor_count=50,
            planned_apartment_count=needed,
        )
        db.add(mega_block)
        db.flush()
    else:
        mega_block = db.execute(
            select(Block).where(Block.site_id == mega_site.id).limit(1)
        ).scalar_one()

    now = datetime.now(timezone.utc)
    batch_size = 5000
    inserted = 0
    start_no = current_count + 1

    while inserted < needed:
        chunk = min(batch_size, needed - inserted)
        rows = [
            {
                "site_id": mega_site.id,
                "block_id": mega_block.id,
                "apartment_no": start_no + i,
                "flat_label": f"M-{start_no + i}",
                "floor": (i % 30) + 1,
                "door_number": str(start_no + i),
                "area_m2": Decimal("140.00"),
                "share_coefficient": Decimal("1.000000"),
                "status": "occupied",
                "last_reading_status": "read" if (i % 20 != 0) else "unread",
                "last_read_at": now,
                "is_demo": True,
                "created_at": now,
            }
            for i in range(chunk)
        ]
        db.execute(insert(Apartment), rows)
        db.commit()
        inserted += chunk
        start_no += chunk

    total_after = db.execute(select(func.count(Apartment.id))).scalar_one()
    t1 = time.perf_counter()
    return {
        "message": f"{inserted} yeni test dairesi başarıyla üretildi. Toplam: {total_after} daire.",
        "total_apartments": total_after,
        "inserted": inserted,
        "mega_site_id": mega_site.id,
        "elapsed_ms": round((t1 - t0) * 1000, 2),
    }
