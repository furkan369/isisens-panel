import os
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Iterator


class OfflineSQLiteQueue:
    """
    Local SQLite persistence engine for the Field RF Collector (`collector/storage/sqlite_queue.py`).
    Guarantees zero data loss when internet connectivity drops during building/basement meter reading sessions.
    Records are stored with `sync_status = 'pending'`, retried on failure, and marked `sync_status = 'synced'`
    after FastAPI confirms ingestion.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "collector_offline_queue.db")
        )
        self._init_schema()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, timeout=20)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS queued_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    idempotency_key TEXT UNIQUE NOT NULL,
                    device_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    sync_status TEXT NOT NULL DEFAULT 'pending',
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    server_response_json TEXT,
                    created_at TEXT NOT NULL,
                    synced_at TEXT
                );
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS ix_queued_readings_status ON queued_readings(sync_status);"
            )
            conn.commit()

    def enqueue(self, normalized_payload: Dict[str, Any]) -> int:
        idem_key = normalized_payload["idempotency_key"]
        now_iso = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO queued_readings
                (idempotency_key, device_id, source, payload_json, sync_status, retry_count, created_at)
                VALUES (?, ?, ?, ?, 'pending', 0, ?)
                """,
                (
                    idem_key,
                    normalized_payload["device_id"],
                    normalized_payload["source"],
                    json.dumps(normalized_payload),
                    now_iso,
                ),
            )
            conn.commit()
            if cur.lastrowid:
                return int(cur.lastrowid)
            row = conn.execute(
                "SELECT id FROM queued_readings WHERE idempotency_key = ?", (idem_key,)
            ).fetchone()
            return int(row["id"]) if row else 0

    def get_pending(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM queued_readings
                WHERE sync_status IN ('pending', 'failed_retry')
                ORDER BY id ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def mark_synced(self, record_id: int, server_response: Dict[str, Any]) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE queued_readings
                SET sync_status = 'synced',
                    synced_at = ?,
                    last_error = NULL,
                    server_response_json = ?
                WHERE id = ?
                """,
                (now_iso, json.dumps(server_response), record_id),
            )
            conn.commit()

    def mark_failed(self, record_id: int, error_message: str) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE queued_readings
                SET sync_status = 'failed_retry',
                    retry_count = retry_count + 1,
                    last_error = ?
                WHERE id = ?
                """,
                (error_message[:250], record_id),
            )
            conn.commit()

    def stats(self) -> Dict[str, int]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT sync_status, COUNT(*) AS cnt FROM queued_readings GROUP BY sync_status"
            ).fetchall()
            counts = {r["sync_status"]: int(r["cnt"]) for r in rows}
            return {
                "pending": counts.get("pending", 0) + counts.get("failed_retry", 0),
                "synced": counts.get("synced", 0),
                "total": sum(counts.values()),
            }
