import re
import psycopg

url = None
for line in open(r"D:\supermarketzanzibar\.env"):
    if line.startswith("DATABASE_URL="):
        url = line.split("=", 1)[1].strip().strip('"')
con = psycopg.connect(url)
cur = con.cursor()
cur.execute(
    "select table_name from information_schema.tables "
    "where table_schema='public' and table_type='BASE TABLE' order by table_name"
)
tables = [r[0] for r in cur.fetchall()]
print("TABLES:")
for t in tables:
    print("  ", t)
print()
for t in tables:
    cur.execute(
        "select column_name, data_type, is_nullable, character_maximum_length, "
        "column_default from information_schema.columns "
        "where table_schema='public' and table_name=%s order by ordinal_position",
        (t,),
    )
    print("== " + t)
    for name, dt, nullable, maxlen, default in cur.fetchall():
        print(f"   {name:32} {dt:26} null={nullable} len={maxlen} default={default}")
    print()
con.close()
