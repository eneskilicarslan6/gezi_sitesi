import subprocess
import sys
import os
import signal

BASE = os.path.dirname(os.path.abspath(__file__))

SERVICES = [
    {"name": "Auth API     (5002)", "dir": "auth_api",   "file": "app.py"},
    {"name": "Search API   (5001)", "dir": "chatbot_ai", "file": "app.py"},
    {"name": "AI Asistan   (5000)", "dir": "general_ai", "file": "ai.py"},
]

procs = []

def shutdown(sig=None, frame=None):
    print("\nServisler kapatılıyor...")
    for p in procs:
        p.terminate()
    sys.exit(0)

signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

print("=" * 40)
print("  Vantag Backend Başlatılıyor")
print("=" * 40)

for svc in SERVICES:
    path = os.path.join(BASE, svc["dir"])
    p = subprocess.Popen(
        [sys.executable, svc["file"]],
        cwd=path,
    )
    procs.append(p)
    print(f"  ✓ {svc['name']}  (PID {p.pid})")

print("=" * 40)
print("  Durdurmak için CTRL+C")
print("=" * 40)

try:
    for p in procs:
        p.wait()
except KeyboardInterrupt:
    shutdown()
