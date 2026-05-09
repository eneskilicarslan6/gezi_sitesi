import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "vantag.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")


def init():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = f.read()
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(schema)
    conn.commit()
    conn.close()
    print(f"Database hazır: {DB_PATH}")


if __name__ == "__main__":
    init()
