import psycopg

url = None
for line in open(r"D:\supermarketzanzibar\.env"):
    if line.startswith("DATABASE_URL="):
        url = line.split("=", 1)[1].strip().strip('"')
con = psycopg.connect(url)
cur = con.cursor()

print("== numeric precision")
cur.execute(
    "select table_name, column_name, numeric_precision, numeric_scale "
    "from information_schema.columns "
    "where table_schema='public' and data_type='numeric' order by table_name, column_name"
)
for r in cur.fetchall():
    print("  ", r)

print("\n== PK default / identity + sequences")
cur.execute(
    "select table_name, column_name, column_default, is_identity, identity_generation "
    "from information_schema.columns "
    "where table_schema='public' and table_name like 'supermarketzanzibar%' and ordinal_position=1 "
    "order by table_name"
)
for r in cur.fetchall():
    print("  ", r)

print("\n== existing sequences")
cur.execute(
    "select sequencename from pg_sequences where schemaname='public' order by sequencename"
)
for r in cur.fetchall():
    print("  ", r[0])
con.close()
