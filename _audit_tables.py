import psycopg
conn = psycopg.connect(host='ep-crimson-haze-anvgurjk-pooler.c-6.us-east-1.aws.neon.tech', port=5432, dbname='neondb', user='neondb_owner', password='npg_mIKHiep8S4Xv', sslmode='require', channel_binding='require')
TABLES=['supermarketzanzibar_customuser','supermarketzanzibar_category','supermarketzanzibar_supplier','supermarketzanzibar_customer','supermarketzanzibar_product','supermarketzanzibar_sale','supermarketzanzibar_saleitem','supermarketzanzibar_stockmovement','supermarketzanzibar_payment']
for t in TABLES:
    print('=== '+t+' ===')
    with conn.cursor() as cur:
        cur.execute('select column_name, data_type, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale from information_schema.columns where table_name=%s order by ordinal_position',(t,))
        for r in cur.fetchall():
            print('  ',r)
conn.close()
