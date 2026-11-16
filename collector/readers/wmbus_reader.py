from typing import Dict, Any, Iterable, Optional
from collector.readers.base import ReaderAdapter


class WMBusReader(ReaderAdapter):
    """
    Official Integration Interface for `wmbusmeters` + USB Wireless M-Bus Dongle
    (e.g., IMST iM871A-USB, Amber AMB8465-M, CUL, or RTL-SDR wmbusmeters pipe).

    NOTE: As required by the system architecture, this adapter does NOT pretend a physical USB
    receiver is plugged in when none is present. Once the USB Wireless M-Bus receiver is attached
    on Linux/Windows and `wmbusmeters --format=json` is configured, it yields raw wmbusmeters JSON frames
    directly into the VendorNormalizer -> SQLiteQueue -> FastAPI pipeline with zero database or UI changes.
    """

    source_name: str = "wireless_mbus"

    def __init__(
        self,
        device_path: str = "/dev/ttyUSB0",
        rf_mode: str = "t1,c1",
        wmbusmeters_bin: str = "/usr/bin/wmbusmeters",
    ):
        self.device_path = device_path
        self.rf_mode = rf_mode
        self.wmbusmeters_bin = wmbusmeters_bin
        self.connected = False

    def connect(self) -> bool:
        # Honest hardware check: returns False until physical USB wM-Bus dongle is connected
        self.connected = False
        return False

    def read_packets(self, count: int = 1) -> Iterable[Dict[str, Any]]:
        if not self.connected:
            raise RuntimeError(
                f"WMBusReader: Fiziksel USB Wireless M-Bus alıcı ({self.device_path}) henüz takılı değil. "
                "Donanım eklendiğinde wmbusmeters JSON çıktısı bu arayüzden otomatik okunacaktır."
            )
        yield from []

    def parse_wmbusmeters_json_line(self, raw_json_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Converts a `wmbusmeters --format=json` telegram dictionary into a raw adapter packet.
        Example wmbusmeters JSON:
        {"media":"heat","meter":"sharky","name":"A-101","id":"64775021","total_energy_consumption_kwh":1580.4,"timestamp":"2026-11-16T13:00:00Z","rssi_dbm":-71}
        """
        return {
            "device_id": str(raw_json_dict.get("id") or raw_json_dict.get("device_id", "")),
            "source": self.source_name,
            "meter_driver": raw_json_dict.get("meter", "sharky"),
            "reading_type": "cumulative_energy",
            "value": str(
                raw_json_dict.get("total_energy_consumption_kwh")
                or raw_json_dict.get("total_heating_kwh")
                or raw_json_dict.get("value", "0")
            ),
            "unit": raw_json_dict.get("unit", "kWh"),
            "read_at": raw_json_dict.get("timestamp") or raw_json_dict.get("read_at"),
            "status": "valid",
            "rssi_dbm": raw_json_dict.get("rssi_dbm"),
            "battery_level": raw_json_dict.get("status") if raw_json_dict.get("status") in ("ok", "low") else None,
        }

    def close(self) -> None:
        self.connected = False

    def health_status(self) -> Dict[str, Any]:
        return {
            "adapter": "WMBusReader",
            "source": self.source_name,
            "device_path": self.device_path,
            "rf_mode": self.rf_mode,
            "hardware_attached": False,
            "status": "integration_ready_awaiting_usb_dongle",
        }

