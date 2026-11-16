import os
import json
from typing import Dict, Any, Optional
import requests

from collector.storage.sqlite_queue import OfflineSQLiteQueue


class CollectorSyncClient:
    """
    HTTPS/HTTP Synchronization Client for the IsıSens Field Collector (`collector/sync/sync_client.py`).
    - Reads pending records from local SQLite (`OfflineSQLiteQueue`)
    - Posts each reading to `POST /api/v1/ingestion/readings` with `X-Collector-Key`
    - Keeps records safely in SQLite if the backend is offline or unreachable
    - Marks records as `synced` once FastAPI returns 200 OK
    """

    def __init__(
        self,
        queue: OfflineSQLiteQueue,
        api_base_url: Optional[str] = None,
        collector_api_key: Optional[str] = None,
        collector_id: str = "COLLECTOR-KONYA-01",
    ):
        self.queue = queue
        self.api_base_url = (
            api_base_url or os.getenv("ISISENS_API_URL", "http://127.0.0.1:8000")
        ).rstrip("/")
        self.collector_api_key = collector_api_key or os.getenv(
            "COLLECTOR_API_KEY", "isisens-collector-rf-key-2026"
        )
        self.collector_id = collector_id

    def sync_pending(self, batch_limit: int = 100, simulate_offline: bool = False) -> Dict[str, Any]:
        pending_rows = self.queue.get_pending(limit=batch_limit)
        if not pending_rows:
            return {
                "attempted": 0,
                "synced": 0,
                "failed": 0,
                "queue_stats": self.queue.stats(),
            }

        if simulate_offline:
            for row in pending_rows:
                self.queue.mark_failed(row["id"], "Simulated offline mode: Bağlantı yok, SQLite kuyruğunda bekletiliyor.")
            return {
                "attempted": len(pending_rows),
                "synced": 0,
                "failed": len(pending_rows),
                "offline_mode": True,
                "queue_stats": self.queue.stats(),
            }

        synced_count = 0
        failed_count = 0
        endpoint = f"{self.api_base_url}/api/v1/ingestion/readings"
        headers = {
            "Content-Type": "application/json",
            "X-Collector-Key": self.collector_api_key,
        }

        for row in pending_rows:
            rec_id = row["id"]
            payload = json.loads(row["payload_json"])
            payload["collector_id"] = self.collector_id
            try:
                resp = requests.post(endpoint, json=payload, headers=headers, timeout=5.0)
                if resp.status_code in (200, 201):
                    self.queue.mark_synced(rec_id, resp.json())
                    synced_count += 1
                else:
                    self.queue.mark_failed(rec_id, f"HTTP {resp.status_code}: {resp.text}")
                    failed_count += 1
            except Exception as exc:
                self.queue.mark_failed(rec_id, f"NetworkError: {exc}")
                failed_count += 1

        return {
            "attempted": len(pending_rows),
            "synced": synced_count,
            "failed": failed_count,
            "queue_stats": self.queue.stats(),
        }

