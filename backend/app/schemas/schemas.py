from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    full_name: str
    title: str
    role: str
    is_active: bool
    kvkk_approved: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime


class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    title: str = "Kurucu Bilgisayar Mühendisi"
    role: str = "founder_admin"
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class BlockSummaryOut(BaseModel):
    id: int
    site_id: int
    name: str
    code: str
    floor_count: int
    planned_apartment_count: int
    actual_apartment_count: int
    read_count: int
    unread_count: int


class SiteTreeItemOut(BaseModel):
    id: int
    name: str
    code: str
    district: str
    city: str
    primary_protocol: str
    status: str
    is_demo: bool
    block_count: int
    apartment_count: int
    read_count: int
    unread_count: int
    success_rate: float
    blocks: List[BlockSummaryOut] = []


class SiteCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    code: Optional[str] = None
    district: str = "Selçuklu"
    city: str = "Konya"
    address: Optional[str] = None
    heating_system: str = "Merkezi Kalorimetre"
    primary_protocol: str = "SHARKY / OMS"
    status: str = "active"
    is_demo: bool = False
    common_share_ratio: Decimal = Decimal("0.3000")
    usage_share_ratio: Decimal = Decimal("0.7000")


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    heating_system: Optional[str] = None
    primary_protocol: Optional[str] = None
    status: Optional[str] = None
    is_demo: Optional[bool] = None
    common_share_ratio: Optional[Decimal] = None
    usage_share_ratio: Optional[Decimal] = None


class BlockCreate(BaseModel):
    site_id: int
    name: str
    code: Optional[str] = None
    floor_count: int = 10
    planned_apartment_count: int = 80


class ApartmentCreate(BaseModel):
    site_id: int
    block_id: int
    apartment_no: int
    flat_label: Optional[str] = None
    floor: int = 1
    door_number: Optional[str] = None
    area_m2: Decimal = Decimal("140.00")
    occupant_name: Optional[str] = None
    occupant_type: str = "owner"
    meter_serial: Optional[str] = None
    meter_manufacturer: str = "Diehl Metering"
    meter_model: str = "Sharky 775"
    initial_index: Decimal = Decimal("0.00")
    is_demo: bool = False


class MeterCreate(BaseModel):
    serial_number: str
    wmbus_id: Optional[str] = None
    manufacturer: str = "Diehl Metering"
    model: str = "Sharky 775"
    communication_protocol: str = "Wireless M-Bus / OMS v4"
    rf_mode: str = "T1"
    unit: str = "kWh"
    driver_name: str = "sharky"
    encryption_status: str = "AES-128-CBC"
    raw_aes_key_hex: Optional[str] = None
    apartment_id: Optional[int] = None
    initial_index_value: Decimal = Decimal("0.00")
    is_demo: bool = False


class MeterAssignRequest(BaseModel):
    apartment_id: int
    meter_id: int
    initial_index_value: Decimal = Decimal("0.00")
    reason: Optional[str] = "Yeni sayaç ataması"


class BillingPeriodCreate(BaseModel):
    site_id: int
    name: str  # e.g. "Ocak 2026"
    period_code: str  # e.g. "2026-01"
    start_date: date
    end_date: date
    total_bill_amount_try: Decimal = Decimal("1284760.00")
    unit_price_per_kwh: Decimal = Decimal("4.0000")
    common_fee_per_apartment_try: Decimal = Decimal("80.00")
    common_share_ratio: Decimal = Decimal("0.3000")
    usage_share_ratio: Decimal = Decimal("0.7000")


class BillingPeriodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int
    name: str
    period_code: str
    start_date: date
    end_date: date
    total_site_consumption_kwh: float
    total_bill_amount_try: float
    unit_price_per_kwh: float
    common_fee_per_apartment_try: float
    common_share_ratio: float
    usage_share_ratio: float
    calculation_method: str
    calculation_version: int
    rounding_diff_try: float
    status: str
    approved_at: Optional[datetime] = None
    created_at: datetime


class SiteDetailSummaryOut(BaseModel):
    site_id: int
    site_name: str
    site_code: str
    district: str
    city: str
    status: str
    is_demo: bool
    primary_protocol: str
    block_count: int
    total_apartments: int
    read_apartments: int
    unread_apartments: int
    read_percentage: float
    unread_percentage: float
    total_consumption_kwh: float
    estimated_total_amount_try: float
    active_period: Optional[BillingPeriodOut] = None
    available_periods: List[BillingPeriodOut] = []
    blocks: List[BlockSummaryOut] = []


class ApartmentConsumptionRowOut(BaseModel):
    apartment_id: int
    site_id: int
    block_id: int
    block_name: str
    apartment_no: int
    flat_label: str
    floor: int
    area_m2: float
    occupant_name: str
    occupant_type: str
    meter_id: Optional[int] = None
    meter_serial: str
    meter_wmbus_id: Optional[str] = None
    meter_brand_model: str
    meter_manufacturer: str
    meter_model: str
    encryption_status: str
    first_index: Optional[float] = None
    last_index: Optional[float] = None
    consumption_kwh: Optional[float] = None
    common_share_try: Optional[float] = None
    usage_share_try: Optional[float] = None
    total_amount_try: Optional[float] = None
    last_read_at: Optional[datetime] = None
    reading_status: str  # read, pending, unread, invalid_data, needs_review, missing_key
    is_demo: bool = True


class PaginatedApartmentsOut(BaseModel):
    items: List[ApartmentConsumptionRowOut]
    total: int
    page: int
    page_size: int
    total_pages: int
    scope_total_apartments: int
    scope_read_apartments: int
    scope_unread_apartments: int
    period_start_label: str
    period_end_label: str


class ReadingIngestionPayload(BaseModel):
    device_id: str = Field(..., description="Meter serial number or wM-Bus ID, e.g. SH-775021 or TEST-001")
    source: str = Field(
        default="simulator",
        description="Data source: simulator | custom_rf | wireless_mbus | manual_import",
    )
    reading_type: str = Field(default="cumulative_energy")
    value: Decimal = Field(..., description="Cumulative energy reading value")
    unit: str = Field(default="kWh")
    read_at: datetime
    status: str = Field(default="valid")
    collector_id: str = Field(default="COLLECTOR-KONYA-01")
    idempotency_key: Optional[str] = None
    rssi_dbm: Optional[int] = None
    battery_level: Optional[str] = None
    flow_temp_c: Optional[Decimal] = None
    return_temp_c: Optional[Decimal] = None
    manufacturer_frame: Optional[dict[str, Any]] = None


class BatchReadingIngestionPayload(BaseModel):
    collector_id: str = "COLLECTOR-KONYA-01"
    session_code: Optional[str] = None
    readings: List[ReadingIngestionPayload]


class IngestionResultOut(BaseModel):
    ingest_status: str  # processed, duplicate_ignored, unmatched_device, validation_error, decryption_failed
    idempotency_key: str
    device_id: str
    source: str
    matched_meter_serial: Optional[str] = None
    matched_apartment_label: Optional[str] = None
    previous_index: Optional[float] = None
    new_index: Optional[float] = None
    calculated_consumption_kwh: Optional[float] = None
    reading_status: str
    message: str

