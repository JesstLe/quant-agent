"""Persistence helpers for dashboard runtime state."""

from __future__ import annotations

from datetime import UTC, datetime
import json
from pathlib import Path
import sqlite3
from typing import Any


class RuntimeStateStore:
    """Tiny SQLite-backed key/value store for runtime state."""

    def __init__(self, db_path: str | Path = "data/runtime_state.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def load(self, key: str, default: Any = None) -> Any:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT value FROM runtime_state WHERE key = ?",
                (key,),
            ).fetchone()

        if row is None:
            return default

        try:
            return json.loads(row[0])
        except json.JSONDecodeError:
            return default

    def save(self, key: str, value: Any) -> None:
        payload = json.dumps(value)
        timestamp = datetime.now(UTC).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO runtime_state(key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                (key, payload, timestamp),
            )
            connection.commit()

    def save_many(self, items: dict[str, Any]) -> None:
        timestamp = datetime.now(UTC).isoformat()
        records = [(key, json.dumps(value), timestamp) for key, value in items.items()]
        with self._connect() as connection:
            connection.executemany(
                """
                INSERT INTO runtime_state(key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                records,
            )
            connection.commit()

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS runtime_state (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)
