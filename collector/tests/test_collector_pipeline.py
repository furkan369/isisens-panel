import os
import sys
import tempfile
import unittest
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from collector.readers.simulator_reader import SimulatorReader
from collector.readers.wmbus_reader import WMBusReader
from collector.readers.custom_rf_reader import CustomRFReader
from collector.normalizers.normalizer import IsiSensNormalizer
from collector.storage.sqlite_queue import OfflineSQLiteQueue
from collector.sync.sync_client import CollectorSyncClient


class TestCollectorModule(unittest.TestCase):
    def test_simulator_reader_contract(self):
        reader = SimulatorReader()
        self.assertTrue(reader.connect())
        packets = list(reader.read_packets(count=3))
        self.assertEqual(len(packets), 3)
        for pkt in packets:
            norm = IsiSensNormalizer.to_standard_contract(pkt)
            self.assertEqual(norm["unit"], "kWh")
            self.assertEqual(norm["reading_type"], "cumulative_energy")
            self.assertIn("idempotency_key", norm)
        reader.close()

    def test_wmbus_and_custom_rf_honest_hardware_status(self):
        """Verifies WMBusReader and CustomRFReader do not fake hardware connections when unplugged."""
        wmbus = WMBusReader()
        self.assertFalse(wmbus.connect())
        self.assertEqual(wmbus.health_status()["status"], "integration_ready_awaiting_usb_dongle")

        # Verify wmbusmeters JSON parsing contract works when telegrams arrive
        parsed = wmbus.parse_wmbusmeters_json_line(
            {
                "media": "heat",
                "meter": "sharky",
                "id": "64775021",
                "total_energy_consumption_kwh": 1612.45,
                "timestamp": "2026-11-16T15:00:00Z",
                "rssi_dbm": -69,
            }
        )
        norm = IsiSensNormalizer.to_standard_contract(parsed)
        self.assertEqual(norm["device_id"], "64775021")
        self.assertEqual(norm["value"], "1612.45")

        rf = CustomRFReader()
        self.assertFalse(rf.connect())

    def test_offline_sqlite_queue_lifecycle(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_file = os.path.join(tmpdir, "test_queue.db")
            queue = OfflineSQLiteQueue(db_path=db_file)
            pkt = IsiSensNormalizer.to_standard_contract(
                {
                    "device_id": "SH-775021",
                    "source": "simulator",
                    "reading_type": "cumulative_energy",
                    "value": "1.500",
                    "unit": "MWh",  # Should normalize to 1500.00 kWh
                    "read_at": "2026-11-16T16:00:00Z",
                    "status": "valid",
                }
            )
            self.assertEqual(pkt["value"], "1500.00")
            row_id = queue.enqueue(pkt)
            self.assertGreater(row_id, 0)
            self.assertEqual(queue.stats()["pending"], 1)

            # Simulate offline sync failure
            client = CollectorSyncClient(queue=queue, api_base_url="http://127.0.0.1:9999")
            res = client.sync_pending(simulate_offline=True)
            self.assertEqual(res["synced"], 0)
            self.assertEqual(queue.stats()["pending"], 1)

            # Mark synced
            queue.mark_synced(row_id, {"ingest_status": "processed"})
            self.assertEqual(queue.stats()["pending"], 0)
            self.assertEqual(queue.stats()["synced"], 1)


if __name__ == "__main__":
    unittest.main()

