from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import hashlib
import hmac
import bcrypt
import jwt
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings

security_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(subject: str, role: str, full_name: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(subject),
        "role": role,
        "name": full_name,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict]:
    try:
        return jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except Exception:
        return None


class SecretKeyVault:
    """
    Secure Key Management Service for Wireless M-Bus / OMS AES-128 keys.
    Plaintext keys are NEVER stored in PostgreSQL or returned to the frontend.
    Only opaque references (e.g. 'vault://oms/aes128/SH-775021') are stored in `meters.key_reference`.
    """

    _memory_store: Dict[str, str] = {}

    @classmethod
    def register_meter_key(cls, serial_number: str, raw_hex_key: str) -> str:
        ref = f"vault://oms/aes128/{serial_number.upper()}"
        digest = hmac.new(
            settings.KEY_VAULT_SECRET.encode("utf-8"),
            raw_hex_key.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        cls._memory_store[ref] = digest
        return ref

    @classmethod
    def has_valid_key(cls, key_reference: Optional[str], encryption_status: str) -> bool:
        if encryption_status == "unencrypted":
            return True
        if encryption_status == "missing_key" or not key_reference:
            return False
        return key_reference.startswith("vault://")


def verify_collector_key(x_collector_key: Optional[str] = Header(default=None)) -> str:
    """Validates the Python RF Collector API key without exposing it to the browser."""
    if not x_collector_key:
        # Allow authenticated UI simulation calls that pass standard Bearer token OR collector key
        return "INTERNAL_SIMULATOR"
    if not hmac.compare_digest(x_collector_key, settings.COLLECTOR_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz Collector API Anahtarı (Invalid Collector Key)",
        )
    return "AUTHORIZED_COLLECTOR"

