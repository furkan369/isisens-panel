import argparse
import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from collector.readers.simulator_reader import SimulatorReader
from collector.normalizers.normalizer import IsiSensNormalizer
from collector.storage.sqlite_queue import OfflineSQLiteQueue
from collector.sync.sync_client import CollectorSyncClient


def run_collector_cycle(
    device_id: str = "SH-775021",
    value: str = "1585.50",
    unit: str = "kWh",
    source: str = "simulator",
    offline_only: bool = False,
    api_url: str = "http://127.0.0.1:8000",
    db_path: str | None = None,
) -> dict:
    reader = SimulatorReader()
    reader.connect()
    raw_pkt = reader.generate_single_reading(
        device_id=device_id,
        value=value,
        unit=unit,
        rssi_dbm=-67,
        battery_level="ok",
    )
    raw_pkt["source"] = source
    normalized = IsiSensNormalizer.to_standard_contract(raw_pkt)

    queue = OfflineSQLiteQueue(db_path=db_path)
    row_id = queue.enqueue(normalized)

    sync_client = CollectorSyncClient(queue=queue, api_base_url=api_url)
    sync_result = sync_client.sync_pending(simulate_offline=offline_only)
    reader.close()

    return {
        "queued_row_id": row_id,
        "normalized_payload": normalized,
        "sync_result": sync_result,
    }


def main():
    parser = argparse.ArgumentParser(description="IsıSens Python RF Collector & Simulator CLI")
    parser.add_argument("--device-id", default="SH-775021", help="Target meter serial / wM-Bus ID")
    parser.add_argument("--value", default="1585.50", help="Cumulative energy reading value")
    parser.add_argument("--unit", default="kWh", help="Energy unit (kWh, MWh, GJ)")
    parser.add_argument("--source", default="simulator", choices=["simulator", "custom_rf", "wireless_mbus", "manual_import"])
    parser.add_argument("--offline", action="store_true", help="Store in SQLite without syncing to simulate internet outage")
    parser.add_argument("--sync-only", action="store_true", help="Sync all pending SQLite records to FastAPI")
    parser.add_argument("--api-url", default="http://127.0.0.1:8000", help="FastAPI Base URL")
    args = parser.parse_args()

    queue = OfflineSQLiteQueue()
    sync_client = CollectorSyncClient(queue=queue, api_base_url=args.api_url)

    if args.sync_only:
        res = sync_client.sync_pending(simulate_offline=False)
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return

    result = run_collector_cycle(
        device_id=args.device_id,
        value=args.value,
        unit=args.unit,
        source=args.source,
        offline_only=args.offline,
        api_url=args.api_url,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

