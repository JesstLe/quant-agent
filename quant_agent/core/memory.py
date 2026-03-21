"""Memory system for agents."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
import json


class MemoryType(Enum):
    """Types of memory entries."""

    MARKET_DATA = "market_data"
    ANALYSIS = "analysis"
    SIGNAL = "signal"
    TRADE = "trade"
    DECISION = "decision"
    OBSERVATION = "observation"


@dataclass
class MemoryEntry:
    """A single memory entry."""

    id: str
    type: MemoryType
    content: dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)
    importance: float = 1.0  # 0.0 to 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
            "importance": self.importance,
        }


class AgentMemory:
    """Memory system for storing and retrieving agent experiences."""

    def __init__(self, max_entries: int = 1000):
        self.entries: list[MemoryEntry] = []
        self.max_entries = max_entries
        self._id_counter = 0

    def _generate_id(self) -> str:
        self._id_counter += 1
        return f"mem_{self._id_counter:06d}"

    def add(
        self,
        type: MemoryType,
        content: dict[str, Any],
        metadata: dict[str, Any] | None = None,
        importance: float = 1.0,
    ) -> MemoryEntry:
        """Add a new memory entry."""
        entry = MemoryEntry(
            id=self._generate_id(),
            type=type,
            content=content,
            metadata=metadata or {},
            importance=importance,
        )
        self.entries.append(entry)

        # Prune old entries if needed
        if len(self.entries) > self.max_entries:
            self._prune()

        return entry

    def _prune(self):
        """Remove least important old entries."""
        # Sort by importance and recency, keep most valuable
        sorted_entries = sorted(
            self.entries,
            key=lambda e: (e.importance, e.timestamp),
            reverse=True,
        )
        self.entries = sorted_entries[: self.max_entries]

    def get_recent(self, n: int = 10, type: MemoryType | None = None) -> list[MemoryEntry]:
        """Get recent entries, optionally filtered by type."""
        entries = self.entries
        if type:
            entries = [e for e in entries if e.type == type]
        return sorted(entries, key=lambda e: e.timestamp, reverse=True)[:n]

    def get_by_symbol(self, symbol: str) -> list[MemoryEntry]:
        """Get all entries related to a symbol."""
        return [
            e
            for e in self.entries
            if e.metadata.get("symbol") == symbol or e.content.get("symbol") == symbol
        ]

    def search(self, query: str) -> list[MemoryEntry]:
        """Search memory entries by content."""
        query_lower = query.lower()
        return [
            e
            for e in self.entries
            if query_lower in json.dumps(e.content).lower()
            or query_lower in json.dumps(e.metadata).lower()
        ]

    def clear(self):
        """Clear all memory."""
        self.entries.clear()

    def export(self) -> list[dict[str, Any]]:
        """Export all entries as dictionaries."""
        return [e.to_dict() for e in self.entries]
