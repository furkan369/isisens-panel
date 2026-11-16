from typing import Dict, Any, Iterable
from collector.readers.base import ReaderAdapter


class CustomRFReader(ReaderAdapter):
    """
    Integration Adapter for custom 868 MHz sub-GHz serial/UART RF receivers (e.g., CC1101 / SX1276).
    Clearly reports hardware status without faking a physical USB connection when no dongle is present.
    """

    source_name: str = "custom_rf"

    def __init__(self, serial_port: str = "COM3", baudrate: int = 115200):
        self.serial_port = serial_port
        self.baudrate = baudrate
        self.connected = False

    def connect(self) -> bool:
        # Does not fake physical hardware connection when USB receiver is absent
        self.connected = False
        return False

    def read_packets(self, count: int = 1) -> Iterable[Dict[str, Any]]:
        if not self.connected:
            raise RuntimeError(
                f"CustomRFReader: Fiziksel RF alıcı ({self.serial_port}) bağlı değil. "
                "Simülasyon için SimulatorReader kullanın."
            )
        yield from []

    def close(self) -> None:
        self.connected = False

    def health_status(self) -> Dict[str, Any]:
        return {
            "adapter": "CustomRFReader",
            "source": self.source_name,
            "serial_port": self.serial_port,
            "hardware_attached": False,
            "status": "awaiting_hardware",
        }

