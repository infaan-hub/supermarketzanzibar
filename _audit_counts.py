import psycopg

URL = "postgresql://neondb_owner:npg_mIKHiep8S4Xv@ep-crimson-haze-anvgurjk-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require"
con = psycopg.connect(URL)
cur = con.cursor()
for t in ["customuser", "category", "supplier", "customer", "product", "sale", "saleitem", "stockmovement", "payment"]:
    cur.execute(f"select count(*) from supermarketzanzibar_{t}")
    print(t, cur.fetchone()[0])
cur.execute("select id, control_number, status, payment_method from supermarketzanzibar_payment order by id desc limit 5")
print("payments sample:", cur.fetchall())
cur.execute("select id, status, final_amount, assigned_driver_id from supermarketzanzibar_sale order by id desc limit 5")
print("sales sample:", cur.fetchall())
con.close()
