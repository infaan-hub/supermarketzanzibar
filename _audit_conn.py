import psycopg
urls=[
 "postgresql://neondb_owner:npg_5RNWQXv0ZgBd@ep-odd-truth-adpy5dqz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require",
 "postgresql://neondb_owner:npg_mIKHiep8S4Xv@ep-royal-forest-ayrt4o6p.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require",
]
for u in urls:
    try:
        con=psycopg.connect(u); cur=con.cursor(); cur.execute('select 1'); print('OK', u.split("@")[1].split("?")[0]); con.close()
    except Exception as e:
        print('FAIL', u.split("@")[1].split("?")[0], str(e)[:60])
