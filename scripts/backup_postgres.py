"""Backup the live Neon PostgreSQL database to local SQL/CSV files.

Usage:
  python scripts/backup_postgres.py <DATABASE_URL> [output_dir]

The URL is passed as an argument (or via DATABASE_URL env var) so that no
credentials are ever committed to the repository.
"""

from __future__ import annotations

import csv
import io
import os
import sys
from datetime import datetime, timezone

import psycopg


def main() -> int:
    url = None
    out_dir = None
    args = [a for a in sys.argv[1:]]
    if args and args[0].startswith(("postgres://", "postgresql://")):
        url = args.pop(0)
    if args:
        out_dir = args.pop(0)
    url = url or os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: provide a postgres URL argument or DATABASE_URL env var")
        return 1
    out_dir = out_dir or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "backups",
        f"postgres_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
    )
    os.makedirs(out_dir, exist_ok=True)

    manifest = []
    with psycopg.connect(url, connect_timeout=20) as conn:
        with conn.cursor() as cur:
            tables = [
                r[0]
                for r in cur.execute(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema='public' AND table_type='BASE TABLE' "
                    "ORDER BY table_name"
                ).fetchall()
            ]
            # schema DDL
            ddl_lines = []
            for r in cur.execute(
                "SELECT tablename, indexname, indexdef FROM pg_indexes "
                "WHERE schemaname='public' ORDER BY tablename, indexname"
            ).fetchall():
                ddl_lines.append(r[1] + ";")
            constraints = cur.execute(
                "SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid) "
                "FROM pg_constraint WHERE connamespace='public'::regnamespace "
                "ORDER BY conrelid::regclass::text, conname"
            ).fetchall()
            for rel, name, definition in constraints:
                ddl_lines.append(f"-- {rel}: {name} = {definition}")
            with open(os.path.join(out_dir, "schema_notes.sql"), "w", encoding="utf-8") as fh:
                fh.write("\n".join(ddl_lines) + "\n")

            for table in tables:
                count = cur.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
                manifest.append((table, count))

    # Each table is copied on its own connection: the pooled endpoint does not
    # tolerate interleaved COPY/SELECT commands on one connection.
    for table, count in manifest:
        chunks: list[bytes] = []
        with psycopg.connect(url, connect_timeout=20) as conn:
            with conn.cursor() as cur:
                with cur.copy(
                    f'COPY "{table}" TO STDOUT WITH (FORMAT csv, HEADER true)'
                ) as copy:
                    while True:
                        chunk = copy.read()
                        if not chunk:
                            break
                        chunks.append(bytes(chunk))
        payload = b"".join(chunks).decode("utf-8")
        with open(os.path.join(out_dir, f"{table}.csv"), "w", encoding="utf-8", newline="") as fh:
            fh.write(payload)

    with open(os.path.join(out_dir, "row_counts.txt"), "w", encoding="utf-8") as fh:
        for table, count in manifest:
            fh.write(f"{table}: {count}\n")

    print(f"Backup written to {out_dir}")
    for table, count in manifest:
        print(f"  {table}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
