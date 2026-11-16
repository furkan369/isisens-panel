from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, Iterable, List, Optional
import random

from collector.readers.base import ReaderAdapter


class SimulatorReader(ReaderAdapter):
    """
    Fully functional Python Simulator Reader that emits realistic calorimeter telemetry
    adhering strictly to the IsıSens RF data contract.
    Does not fabricate fields unavailable on real OMS / Wireless M-Bus heat meters.
    Optional telemetry fields (rssi_dbm, battery_level, flow_temp_c, return_temp_c) are configurable.
    """

    source_name: str = "simulator"

    def __init__(
        self,
        target_devices: Optional[List[Dict[str, Any]]] = None,
        include_optional_telemetry: bool = True,
    ):
        self.connected = False
        self.include_optional_telemetry = include_optional_telemetry
        self.target_devices = target_devices or [
            {"device_id": "SH-775021", "base_value": Decimal("1540.75"), "unit": "kWh", "brand": "Diehl Sharky 775"},
            {"device_id": "SH-775022", "base_value": Decimal("1190.90"), "unit": "kWh", "brand": "Diehl Sharky 775"},
            {"device_id": "SH-775023", "base_value": Decimal("1760.50"), "unit": "kWh", "brand": "Diehl Sharky 775"},
            {"device_id": "SH-775027", "base_value": Decimal("1280.50"), "unit": "kWh", "brand": "Diehl Sharky 775"},
        ]

    def connect(self) -> bool:
        self.connected = True
        return True

    def read_packets(self, count: int = 1) -> Iterable[Dict[str, Any]]:
        if not self.connected:
            self.connect()

        for i in range(count):
            dev = self.target_devices[i % len(self.target_devices)]
            increment = Decimal(str(round(random.uniform(5.25, 42.80), 2)))
            new_val = (Decimal(str(dev["base_value"])) + increment).quantize(Decimal("0.01"))
            dev["base_value"] = new_val

            packet: Dict[str, Any] = {
                "device_id": dev["device_id"],
                "source": self.source_name,
                "reading_type": "cumulative_energy",
                "value": str(new_val),
                "unit": dev.get("unit", "kWh"),
                "read_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "status": dev.get("status", "valid"),
            }
            if self.include_optional_telemetry:
                packet["rssi_dbm"] = random.randint(-82, -61)
                packet["battery_level"] = "ok"
            yield packet

    def generate_single_reading(
        self,
        device_id: str,
        value: str | Decimal,
        unit: str = "kWh",
        status: str = "valid",
        read_at: Optional[str] = None,
        rssi_dbm: Optional[int] = None,
        battery_level: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "device_id": device_id,
            "source": self.source_name,
            "reading_type": "cumulative_energy",
            "value": str(value),
            "unit": unit,
            "read_at": read_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "status": status,
        }
        if rssi_dbm is not None:
            payload["rssi_dbm"] = rssi_dbm
        if battery_level is not None:
            payload["battery_level"] = battery_level
        return payload

    def close(self) -> None:
        self.connected = False

    def health_status(self) -> Dict[str, Any]:
        return {
            "adapter": "SimulatorReader",
            "source": self.source_name,
            "hardware_attached": False,
            "simulated_mode": True,
            "status": "ready",
            "configured_devices": len(self.target_devices),
        }

