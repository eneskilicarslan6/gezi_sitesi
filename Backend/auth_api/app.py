import os
import datetime
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
import bcrypt
import jwt
from db import get_conn

load_dotenv()

JWT_SECRET   = os.getenv("JWT_SECRET", "change_me")
JWT_EXP_HOURS = int(os.getenv("JWT_EXP_HOURS", 72))
PORT         = int(os.getenv("PORT", 5002))

app = Flask(__name__)
CORS(app)


def make_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def auth_required(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"hata": "Token gerekli"}), 401
        payload = decode_token(header[7:])
        if not payload:
            return jsonify({"hata": "Geçersiz veya süresi dolmuş token"}), 401
        request.user_id = payload["sub"]
        request.username = payload["username"]
        return f(*args, **kwargs)
    return wrapper


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify({"hata": "Kullanıcı adı, e-posta ve şifre zorunludur"}), 400
    if len(password) < 6:
        return jsonify({"hata": "Şifre en az 6 karakter olmalı"}), 400

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        conn = get_conn()
        conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, pw_hash),
        )
        conn.commit()
        user_id = conn.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()["id"]
        conn.close()
    except Exception as e:
        if "UNIQUE" in str(e):
            return jsonify({"hata": "Bu kullanıcı adı veya e-posta zaten kayıtlı"}), 409
        return jsonify({"hata": "Kayıt başarısız"}), 500

    token = make_token(user_id, username)
    return jsonify({"token": token, "kullanici": {"id": user_id, "username": username, "email": email}}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"hata": "Kullanıcı adı ve şifre zorunludur"}), 400

    conn = get_conn()
    row = conn.execute(
        "SELECT id, username, email, password_hash FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    conn.close()

    if not row or not bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        return jsonify({"hata": "Kullanıcı adı veya şifre hatalı"}), 401

    token = make_token(row["id"], row["username"])
    return jsonify({
        "token": token,
        "kullanici": {"id": row["id"], "username": row["username"], "email": row["email"]},
    })


@app.route("/api/auth/me", methods=["GET"])
@auth_required
def me():
    conn = get_conn()
    row = conn.execute(
        "SELECT id, username, email, created_at FROM users WHERE id = ?",
        (request.user_id,),
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"hata": "Kullanıcı bulunamadı"}), 404
    return jsonify({"kullanici": dict(row)})


if __name__ == "__main__":
    print(f"Vantag Auth Sunucusu >> http://127.0.0.1:{PORT}")
    app.run(port=PORT, debug=True)
