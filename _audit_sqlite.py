import sqlite3

con = sqlite3.connect(r"D:\supermarketzanzibar\zansupermarket\db.sqlite3")
cur = con.cursor()
tables = [r[0] for r in cur.execute("select name from sqlite_master where type='table' order by name").fetchall()]
for t in tables:
    try:
        count = cur.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        print(f"{t}: {count}")
    except Exception as e:
        print(f"{t}: ERROR {e}")
