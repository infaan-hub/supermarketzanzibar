import psycopg

URL = "postgresql://neondb_owner:npg_mIKHiep8S4Xv@ep-crimson-haze-anvgurjk-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

with psycopg.connect(URL, connect_timeout=15) as conn:
    with conn.cursor() as cur:
        print("=== ID COLUMNS ===")
        for r in cur.execute(
            """
            SELECT table_name, column_name, is_identity, identity_generation, column_default
            FROM information_schema.columns
            WHERE table_schema='public' AND column_name='id'
            ORDER BY table_name
            """
        ).fetchall():
            print(f"  {r[0]}: identity={r[2]} gen={r[3]} default={r[4]}")

        print("=== UNIQUE INDEXES ===")
        for r in cur.execute(
            "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexdef LIKE '%UNIQUE%' ORDER BY tablename"
        ).fetchall():
            print(f"  {r[2]}")

        print("=== SAMPLE (no secrets) ===")
        for r in cur.execute(
            "SELECT id, username, role, is_active, access_window_start, access_window_end FROM supermarketzanzibar_customuser ORDER BY id"
        ).fetchall():
            print(f"  user id={r[0]} role={r[2]} active={r[3]} window={r[4]}..{r[5]}")
        for r in cur.execute(
            "SELECT id, name, price, quantity, barcode, slug, category_id, supplier_id FROM supermarketzanzibar_product ORDER BY id"
        ).fetchall():
            print(f"  product id={r[0]} {r[1]!r} price={r[2]} qty={r[3]} cat={r[6]} sup={r[7]}")
        for r in cur.execute("SELECT id, name FROM supermarketzanzibar_category ORDER BY id").fetchall():
            print(f"  category id={r[0]} {r[1]!r}")
