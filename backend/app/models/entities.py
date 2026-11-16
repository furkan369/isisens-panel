from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String,
    Integer,
    Boolean,
    DateTime,
    Date,
    Numeric,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(128), default="Kurucu Bilgisayar Mühendisi")
    role: Mapped[str] = mapped_column(
        String(32), default="founder_admin", nullable=False
    )  # founder_admin, operations_engineer, billing_specialist, field_technician
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    kvkk_approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    district: Mapped[str] = mapped_column(String(64), default="Selçuklu", index=True)
    city: Mapped[str] = mapped_column(String(64), default="Konya", index=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    heating_system: Mapped[str] = mapped_column(String(64), default="Merkezi Kalorimetre")
    primary_protocol: Mapped[str] = mapped_column(String(64), default="SHARKY / OMS")
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)  # active, maintenance, inactive
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    common_share_ratio: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.3000"))
    usage_share_ratio: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.7000"))
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    blocks: Mapped[List["Block"]] = relationship("Block", back_populates="site", cascade="all, delete-orphan")
    apartments: Mapped[List["Apartment"]] = relationship("Apartment", back_populates="site", cascade="all, delete-orphan")
    billing_periods: Mapped[List["BillingPeriod"]] = relationship("BillingPeriod", back_populates="site", cascade="all, delete-orphan")


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (
        Index("ix_blocks_site_name", "site_id", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. "A Blok"
    code: Mapped[str] = mapped_column(String(16), nullable=False)  # e.g. "A"
    floor_count: Mapped[int] = mapped_column(Integer, default=10)
    planned_apartment_count: Mapped[int] = mapped_column(Integer, default=80)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    site: Mapped["Site"] = relationship("Site", back_populates="blocks")
    apartments: Mapped[List["Apartment"]] = relationship("Apartment", back_populates="block", cascade="all, delete-orphan")


class Apartment(Base):
    __tablename__ = "apartments"
    __table_args__ = (
        Index("ix_apartments_site_block_no", "site_id", "block_id", "apartment_no"),
        Index("ix_apartments_site_status", "site_id", "last_reading_status"),
        Index("ix_apartments_flat_label", "flat_label"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    block_id: Mapped[int] = mapped_column(ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    apartment_no: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 101
    flat_label: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g. "A-101"
    floor: Mapped[int] = mapped_column(Integer, default=1)
    door_number: Mapped[str] = mapped_column(String(16), default="1")
    area_m2: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("140.00"))
    share_coefficient: Mapped[Decimal] = mapped_column(Numeric(8, 6), default=Decimal("1.000000"))
    status: Mapped[str] = mapped_column(String(32), default="occupied")
    last_reading_status: Mapped[str] = mapped_column(
        String(32), default="pending", index=True
    )  # read, pending, unread, invalid_data, needs_review, missing_key
    last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    site: Mapped["Site"] = relationship("Site", back_populates="apartments")
    block: Mapped["Block"] = relationship("Block", back_populates="apartments")
    occupants: Mapped[List["Occupant"]] = relationship("Occupant", back_populates="apartment", cascade="all, delete-orphan")
    meter_assignments: Mapped[List["MeterAssignment"]] = relationship("MeterAssignment", back_populates="apartment", cascade="all, delete-orphan")
    readings: Mapped[List["MeterReading"]] = relationship("MeterReading", back_populates="apartment")
    allocations: Mapped[List["Allocation"]] = relationship("Allocation", back_populates="apartment", cascade="all, delete-orphan")


class Occupant(Base):
    __tablename__ = "occupants"
    __table_args__ = (
        Index("ix_occupants_apt_active", "apartment_id", "is_active"),
        Index("ix_occupants_fullname", "full_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    occupant_type: Mapped[str] = mapped_column(String(32), default="owner")  # owner, tenant
    phone_masked: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    email_masked: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    start_date: Mapped[date] = mapped_column(Date, default=lambda: date(2024, 1, 1))
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    apartment: Mapped["Apartment"] = relationship("Apartment", back_populates="occupants")


class Meter(Base):
    __tablename__ = "meters"
    __table_args__ = (
        Index("ix_meters_manufacturer_model", "manufacturer", "model"),
        Index("ix_meters_paired_status", "is_paired", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    technical_uid: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    serial_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    wmbus_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    manufacturer: Mapped[str] = mapped_column(String(64), default="Diehl Metering", index=True)
    model: Mapped[str] = mapped_column(String(64), default="Sharky 775")
    communication_protocol: Mapped[str] = mapped_column(String(64), default="Wireless M-Bus / OMS v4")
    rf_mode: Mapped[str] = mapped_column(String(16), default="T1")  # T1, C1, S1
    unit: Mapped[str] = mapped_column(String(16), default="kWh")
    driver_name: Mapped[str] = mapped_column(String(64), default="sharky")
    encryption_status: Mapped[str] = mapped_column(
        String(32), default="AES-128-CBC"
    )  # AES-128-CBC, unencrypted, missing_key
    key_reference: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True
    )  # Reference ID only, NEVER plaintext key!
    battery_status: Mapped[Optional[str]] = mapped_column(String(32), default="ok", nullable=True)
    last_rssi_dbm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)  # active, unassigned, faulty, decommissioned
    is_paired: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    assignments: Mapped[List["MeterAssignment"]] = relationship("MeterAssignment", back_populates="meter", cascade="all, delete-orphan")
    readings: Mapped[List["MeterReading"]] = relationship("MeterReading", back_populates="meter", cascade="all, delete-orphan")


class MeterAssignment(Base):
    __tablename__ = "meter_assignments"
    __table_args__ = (
        Index("ix_meter_assignments_apt_active", "apartment_id", "is_active"),
        Index("ix_meter_assignments_meter_active", "meter_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False, index=True)
    meter_id: Mapped[int] = mapped_column(ForeignKey("meters.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    unassigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    initial_index_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    final_index_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    assigned_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    apartment: Mapped["Apartment"] = relationship("Apartment", back_populates="meter_assignments")
    meter: Mapped["Meter"] = relationship("Meter", back_populates="assignments")


class ReadingSession(Base):
    __tablename__ = "reading_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    site_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sites.id", ondelete="SET NULL"), nullable=True, index=True)
    collector_id: Mapped[str] = mapped_column(String(64), default="COLLECTOR-KONYA-01", index=True)
    source: Mapped[str] = mapped_column(
        String(32), default="simulator"
    )  # simulator, custom_rf, wireless_mbus, manual_import
    adapter_name: Mapped[str] = mapped_column(String(64), default="SimulatorReader")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    total_packets: Mapped[int] = mapped_column(Integer, default=0)
    valid_readings_count: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    unmatched_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="completed")  # active, completed, failed


class MeterReading(Base):
    __tablename__ = "meter_readings"
    __table_args__ = (
        Index("ix_meter_readings_meter_read_at", "meter_id", "read_at"),
        Index("ix_meter_readings_apt_period", "apartment_id", "billing_period_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    meter_id: Mapped[int] = mapped_column(ForeignKey("meters.id", ondelete="CASCADE"), nullable=False, index=True)
    apartment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("apartments.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id: Mapped[Optional[int]] = mapped_column(ForeignKey("reading_sessions.id", ondelete="SET NULL"), nullable=True)
    billing_period_id: Mapped[Optional[int]] = mapped_column(ForeignKey("billing_periods.id", ondelete="SET NULL"), nullable=True, index=True)
    reading_type: Mapped[str] = mapped_column(String(64), default="cumulative_energy")
    first_index: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    consumption_kwh: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    unit: Mapped[str] = mapped_column(String(16), default="kWh")
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    source: Mapped[str] = mapped_column(
        String(32), default="simulator"
    )  # simulator, custom_rf, wireless_mbus, manual_import
    status: Mapped[str] = mapped_column(
        String(32), default="valid", index=True
    )  # valid, invalid_data, needs_review, missing_key, unread
    rssi_dbm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    battery_level: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    flow_temp_c: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    return_temp_c: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    is_official: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    meter: Mapped["Meter"] = relationship("Meter", back_populates="readings")
    apartment: Mapped[Optional["Apartment"]] = relationship("Apartment", back_populates="readings")


class ReadingIngestEvent(Base):
    __tablename__ = "reading_ingest_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    collector_id: Mapped[str] = mapped_column(String(64), default="COLLECTOR-KONYA-01", index=True)
    device_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="simulator", index=True)
    raw_payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_payload_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ingest_status: Mapped[str] = mapped_column(
        String(32), default="processed", index=True
    )  # processed, duplicate_ignored, unmatched_device, validation_error, decryption_failed
    error_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    matched_meter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("meters.id", ondelete="SET NULL"), nullable=True)
    matched_apartment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("apartments.id", ondelete="SET NULL"), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class BillingPeriod(Base):
    __tablename__ = "billing_periods"
    __table_args__ = (
        Index("ix_billing_periods_site_code", "site_id", "period_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. "Ocak 2026"
    period_code: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g. "2026-01"
    start_date: Mapped[date] = mapped_column(Date, nullable=False)  # e.g. 2025-12-01
    end_date: Mapped[date] = mapped_column(Date, nullable=False)  # e.g. 2025-12-31
    total_site_consumption_kwh: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    total_bill_amount_try: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    unit_price_per_kwh: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("4.0000"))
    common_fee_per_apartment_try: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("80.00"))
    common_share_ratio: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.3000"))
    usage_share_ratio: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.7000"))
    calculation_method: Mapped[str] = mapped_column(String(64), default="TR_MERKEZI_70_30_DECIMAL")
    calculation_version: Mapped[int] = mapped_column(Integer, default=1)
    rounding_diff_try: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0.0000"))
    status: Mapped[str] = mapped_column(
        String(32), default="preview", index=True
    )  # draft, preview, approved, locked
    approved_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    site: Mapped["Site"] = relationship("Site", back_populates="billing_periods")
    invoices: Mapped[List["Invoice"]] = relationship("Invoice", back_populates="billing_period", cascade="all, delete-orphan")
    allocations: Mapped[List["Allocation"]] = relationship("Allocation", back_populates="billing_period", cascade="all, delete-orphan")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    billing_period_id: Mapped[int] = mapped_column(ForeignKey("billing_periods.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_name: Mapped[str] = mapped_column(String(128), default="Enerya Konya Gaz Dağıtım A.Ş.")
    invoice_no: Mapped[str] = mapped_column(String(64), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    gas_volume_sm3: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    total_energy_kwh: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    total_amount_try: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    billing_period: Mapped["BillingPeriod"] = relationship("BillingPeriod", back_populates="invoices")


class Allocation(Base):
    __tablename__ = "allocations"
    __table_args__ = (
        Index("ix_allocations_period_apt", "billing_period_id", "apartment_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    billing_period_id: Mapped[int] = mapped_column(ForeignKey("billing_periods.id", ondelete="CASCADE"), nullable=False, index=True)
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False, index=True)
    meter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("meters.id", ondelete="SET NULL"), nullable=True)
    first_index: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    last_index: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    consumption_kwh: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    common_share_try: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    usage_share_try: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    total_amount_try: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    calculation_version: Mapped[int] = mapped_column(Integer, default=1)
    reading_status: Mapped[str] = mapped_column(
        String(32), default="read"
    )  # read, pending, unread, invalid_data, needs_review, missing_key
    status: Mapped[str] = mapped_column(String(32), default="preview")  # preview, approved
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    billing_period: Mapped["BillingPeriod"] = relationship("BillingPeriod", back_populates="allocations")
    apartment: Mapped["Apartment"] = relationship("Apartment", back_populates="allocations")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    site_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=True, index=True)
    block_id: Mapped[Optional[int]] = mapped_column(ForeignKey("blocks.id", ondelete="SET NULL"), nullable=True)
    apartment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("apartments.id", ondelete="SET NULL"), nullable=True)
    meter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("meters.id", ondelete="SET NULL"), nullable=True)
    device_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    alert_type: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True
    )  # low_battery, no_signal, missing_key, unmatched_meter, invalid_reading, reverse_flow
    severity: Mapped[str] = mapped_column(String(16), default="warning", index=True)  # info, warning, critical
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open", index=True)  # open, investigating, resolved
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(128), default="IsıSens Ekibi")
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    details_json: Mapped[str] = mapped_column(Text, default="{}")
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

