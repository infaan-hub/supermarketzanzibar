import psycopg

URL = "postgresql://neondb_owner:npg_mIKHiep8S4Xv@ep-crimson-haze-anvgurjk-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

TABLES = [
    "supermarketzanzibar_product",
    "supermarketzanzibar_sale",
    "supermarketzanzibar_payment",
    "supermarketzanzibar_supplier",
    "supermarketzanzibar_customer",
]

with psycopg.connect(URL, connect_timeout=15) as conn:
    with conn.cursor() as cur:
        for table in TABLES:
            print(f"=== {table} ===")
            for r in cur.execute(
                """
                SELECT column_name, data_type, is_nullable, character_maximum_length,
                       numeric_precision, numeric_scale
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name=%s
                ORDER BY ordinal_position
                """,
                (table,),
            ).fetchall():
                name, dtype, nullable, cmax, prec, scale = r
                extra = ""
                if cmax:
                    extra += f"({cmax})"
                if prec is not None and scale is not None and dtype == "numeric":
                    extra += f"({prec},{scale})"
                print(f"  {name}: {dtype}{extra} {'NULL' if nullable == 'YES' else 'NOT NULL'}")
