import psycopg

URL = "postgresql://neondb_owner:npg_mIKHiep8S4Xv@ep-crimson-haze-anvgurjk-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

with psycopg.connect(URL, connect_timeout=15) as conn:
    with conn.cursor() as cur:
        rows = cur.execute(
            """
            SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
            FROM information_schema.columns
            WHERE table_schema='public'
            ORDER BY table_name, ordinal_position
            """
        ).fetchall()
        current = None
        for t, c, dt, nullable, default, cmax, p, s in rows:
            if t != current:
                current = t
                print(f"\n=== {t} ===")
            extra = ""
            if cmax:
                extra += f"({cmax})"
            if p is not None and s is not None and dt == "numeric":
                extra += f"({p},{s})"
            print(f"  {c}: {dt}{extra} {'NULL' if nullable=='YES' else 'NOT NULL'} default={default}")

        print("\n=== INDEXES ===")
        for r in cur.execute(
            "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname"
        ).fetchall():
            print(f"  {r[1]}")

        print("\n=== CONSTRAINTS ===")
        for r in cur.execute(
            """
            SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid)
            FROM pg_constraint WHERE connamespace='public'::regnamespace
            ORDER BY conrelid::regclass::text
            """
        ).fetchall():
            print(f"  {r[0]}: {r[1]} = {r[2]}")
