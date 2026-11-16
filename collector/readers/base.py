from abc import ABC, abstractmethod
from typing import Dict, Any, Iterable, List


class ReaderAdapter(ABC):
    """
    Abstract Hardware / Simulator Reader Adapter Interface for IsıSens RF Collector.
    Allows switching between SimulatorReader, CustomRFReader, and WMBusReader (wmbusmeters USB dongle)
    without changing the Collector pipeline, SQLite offline queue, FastAPI ingestion contract, or React UI.
    """

    source_name: str = "unknown"

    @abstractmethod
    def connect(self) -> bool:
        """Initialize connection to the reader source."""
        raise NotImplementedError

    @abstractmethod
    def read_packets(self, count: int = 1) -> Iterable[Dict[str, Any]]:
        """Yield raw meter reading dictionaries from the source."""
        raise NotImplementedError

    @abstractmethod
    def close(self) -> None:
        """Release hardware/simulator resources."""
        raise NotImplementedError

    @abstractmethod
    def health_status(self) -> Dict[str, Any]:
        """Return diagnostic information about the adapter."""
        raise NotImplementedError

