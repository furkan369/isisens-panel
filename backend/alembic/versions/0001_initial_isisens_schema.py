"""0001_initial_isisens_schema

Revision ID: 0001_initial
Revises: None
Create Date: 2026-11-16 19:00:00

Creates all 15 PostgreSQL tables for IsıSens Platform:
- users
- sites
- blocks
- apartments
- occupants
- meters
- meter_assignments
- reading_sessions
- meter_readings
- reading_ingest_events
- billing_periods
- invoices
- allocations
- alerts
- audit_logs
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.db.session import Base
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from app.db.session import Base
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)

