import sys

urls = [
    ("settings-default", "postgresql://neondb_owner:npg_mIKHiep8S4Xv@ep-crimson-haze-anvgurjk-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"),
    ("env-file", "postgresql://neondb_owner:npg_5RNWQXv0ZgBd@ep-odd-truth-adpy5dqz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"),
]

for name, url in urls:
    try:
        import psycopg
        with psycopg.connect(url, connect_timeout=12) as conn:
            with conn.cursor() as cur:
                tables = cur.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
                ).fetchall()
                print(f"[{name}] CONNECTED. tables={[t[0] for t in tables]}")
                for t in tables:
                    cnt = cur.execute(f'SELECT COUNT(*) FROM "{t[0]}"').fetchone()[0]
                    print(f"  {t[0]}: {cnt}")
    except Exception as e:
        print(f"[{name}] FAILED: {type(e).__name__}: {e}")
