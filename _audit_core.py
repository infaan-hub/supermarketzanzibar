import psycopg

url = None
for line in open(r"D:\supermarketzanzibar\.env"):
    if line.startswith("DATABASE_URL="):
        url = line.split("=", 1)[1].strip().strip('"')
con = psycopg.connect(url)
cur = con.cursor()
for t in [
    "supermarketzanzibar_customuser",
    "supermarketzanzibar_category",
    "supermarketzanzibar_customer",
    "supermarketzanzibar_product",
    "supermarketzanzibar_payment",
    "refresh_tokens",
]:
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
