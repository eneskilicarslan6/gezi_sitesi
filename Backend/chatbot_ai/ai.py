import json
import string
import os
import sqlite3
import datetime
from functools import wraps
from dotenv import load_dotenv
from google import genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from cryptography.fernet import Fernet
import jwt

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

_fernet = Fernet(os.getenv("FERNET_KEY").encode())

def encrypt(text: str) -> str:
    return _fernet.encrypt(text.encode()).decode()

def decrypt(token: str) -> str:
    return _fernet.decrypt(token.encode()).decode()

JWT_SECRET = os.getenv("JWT_SECRET", "vantag_super_secret_change_me_in_prod_2026")
DB_PATH    = os.path.abspath(
    os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "../../Database/vantag.db"))
)
RULES_PATH = os.path.join(os.path.dirname(__file__), "asistan_kurallari.json")


# ── DB yardımcıları ──────────────────────────────────────────────────────────

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# ── AI çekirdek ──────────────────────────────────────────────────────────────

def yerel_json_kontrol(kullanici_mesaji):
    temiz = kullanici_mesaji.lower().translate(str.maketrans("", "", string.punctuation)).strip()
    kelimeler = set(temiz.split())
    try:
        with open(RULES_PATH, "r", encoding="utf-8") as f:
            kurallar = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    for veri in kurallar.values():
        if any(k in kelimeler for k in veri["anahtar_kelimeler"]):
            return veri["cevap"]
    return None


def asistan_cevap_ver(kullanici_mesaji: str) -> str:
    json_cevabi = yerel_json_kontrol(kullanici_mesaji)
    if json_cevabi:
        return json_cevabi
    prompt = (
        "Sen Türkiye'deki tüm şehirlere hakim, profesyonel, güler yüzlü ve "
        "kısa cevaplar veren bir gezi asistanısın. "
        f"Kullanıcı sana şu soruyu sordu: '{kullanici_mesaji}' "
        "Lütfen ona en iyi gezi tavsiyesini ver."
    )
    response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    return response.text


# ── Auth middleware ───────────────────────────────────────────────────────────

def decode_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def auth_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"hata": "Token gerekli"}), 401
        payload = decode_token(header[7:])
        if not payload:
            return jsonify({"hata": "Geçersiz veya süresi dolmuş token"}), 401
        request.user_id  = int(payload["sub"])
        request.username = payload["username"]
        return f(*args, **kwargs)
    return wrapper


# ── Flask ─────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)


# Anonim / hızlı mesaj — eski endpoint, geriye uyumlu
@app.route("/api/asistan", methods=["POST"])
def asistan_api():
    gelen = request.get_json() or {}
    if "mesaj" not in gelen:
        return jsonify({"hata": "Mesaj bulunamadı"}), 400
    cevap = asistan_cevap_ver(gelen["mesaj"])
    return jsonify({"cevap": cevap})


# ── Sohbet oturumu endpoint'leri (JWT gerekli) ────────────────────────────────

@app.route("/api/chat/sessions", methods=["POST"])
@auth_required
def create_session():
    """Yeni sohbet oturumu oluştur."""
    data  = request.get_json() or {}
    title = (data.get("title") or "Yeni Sohbet")[:80]
    conn  = get_conn()
    cur   = conn.execute(
        "INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)",
        (request.user_id, title),
    )
    conn.commit()
    session_id = cur.lastrowid
    row = conn.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.route("/api/chat/sessions", methods=["GET"])
@auth_required
def list_sessions():
    """Kullanıcının tüm sohbet oturumlarını döner (yeniden eskiye)."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC",
        (request.user_id,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["title"] = decrypt(d["title"])
        except Exception:
            pass
        result.append(d)
    return jsonify(result)


@app.route("/api/chat/sessions/<int:session_id>", methods=["DELETE"])
@auth_required
def delete_session(session_id):
    """Sohbet oturumunu sil (cascade → mesajlar da silinir)."""
    conn = get_conn()
    row  = conn.execute(
        "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, request.user_id),
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"hata": "Oturum bulunamadı"}), 404
    conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    return jsonify({"mesaj": "Silindi"})


@app.route("/api/chat/sessions/<int:session_id>/messages", methods=["GET"])
@auth_required
def get_messages(session_id):
    """Bir oturumdaki tüm mesajları döner."""
    conn = get_conn()
    owner = conn.execute(
        "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, request.user_id),
    ).fetchone()
    if not owner:
        conn.close()
        return jsonify({"hata": "Oturum bulunamadı"}), 404
    rows = conn.execute(
        "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["content"] = decrypt(d["content"])
        except Exception:
            pass
        result.append(d)
    return jsonify(result)


@app.route("/api/chat/sessions/<int:session_id>/messages", methods=["POST"])
@auth_required
def send_message(session_id):
    """Kullanıcı mesajı ekle, AI cevabını al ve ikisini DB'ye yaz."""
    conn = get_conn()
    owner = conn.execute(
        "SELECT id, title FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, request.user_id),
    ).fetchone()
    if not owner:
        conn.close()
        return jsonify({"hata": "Oturum bulunamadı"}), 404

    data   = request.get_json() or {}
    mesaj  = (data.get("mesaj") or "").strip()
    if not mesaj:
        conn.close()
        return jsonify({"hata": "Mesaj boş olamaz"}), 400

    # Kullanıcı mesajını kaydet
    conn.execute(
        "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)",
        (session_id, encrypt(mesaj)),
    )

    # İlk mesajsa oturum başlığını güncelle
    msg_count = conn.execute(
        "SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ?", (session_id,)
    ).fetchone()["c"]
    if msg_count == 1 and owner["title"] == "Yeni Sohbet":
        conn.execute(
            "UPDATE chat_sessions SET title = ? WHERE id = ?",
            (encrypt(mesaj[:60]), session_id),
        )

    # AI cevabı
    cevap = asistan_cevap_ver(mesaj)

    # AI cevabını kaydet
    conn.execute(
        "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'assistant', ?)",
        (session_id, encrypt(cevap)),
    )
    conn.commit()
    conn.close()

    return jsonify({"cevap": cevap})


if __name__ == "__main__":
    print("Vantag AI Sunucusu >> http://127.0.0.1:5000")
    app.run(port=5000, debug=True)
