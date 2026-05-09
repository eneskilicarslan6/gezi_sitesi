import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from api_part import TravelSearchAPI

load_dotenv()

app = Flask(__name__)
CORS(app)

api = TravelSearchAPI()


@app.route("/api/search", methods=["POST"])
def search():
    data = request.get_json() or {}
    query_type = data.get("query_type", "")
    params     = data.get("params", {})

    if not query_type:
        return jsonify({"ok": False, "error": "query_type zorunludur"}), 400

    result = api.search_all(query_type, params)
    status = 200 if result["ok"] else 422
    return jsonify(result), status


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "vantag-search"})


if __name__ == "__main__":
    port = int(os.getenv("SEARCH_PORT", 5001))
    print(f"Vantag Search Sunucusu >> http://127.0.0.1:{port}")
    app.run(port=port, debug=True)
