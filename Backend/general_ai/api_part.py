# travel_search_api.py

import os
import time
import logging
import requests
from typing import Any
from typing import TypedDict
from dotenv import load_dotenv
import time

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# TYPE DEFINITIONS
# ─────────────────────────────────────────────────────────────

class TravelItem(TypedDict, total=False):
    """
    Tüm kategoriler için normalize edilmiş standart veri şablonu.
    AI modülü her zaman bu formatta veri alır.
    total=False → tüm alanlar optional (kategori farklılıkları için)
    """
    id:          str
    title:       str
    price:       float
    currency:    str
    rating:      float
    thumbnail:   str
    source:      str        # "google_flights", "flixbus", "obilet", vs.
    details:     dict       # kategoriye özel alanlar buraya
    booking_url: str


class APIResponse(TypedDict):
    """
    _make_request ve tüm public metodların döndüğü standart yapı.
    Normalizasyon metodları her zaman bunu döner → AI tutarlı veri alır.
    """
    ok:     bool            # True = başarılı, False = hata var
    source: str             # hangi API/engine
    count:  int             # bulunan sonuç sayısı (hata durumunda 0)
    data:   list[TravelItem]
    error:  str             # ok=True ise "" boş string


# Retry yapılmayacak "kalıcı hata" kodları
_NO_RETRY_STATUS = {
    400,  # Bad Request      → parametremiz yanlış, retry faydasız
    401,  # Unauthorized     → API key geçersiz
    403,  # Forbidden        → erişim yok
    404,  # Not Found        → endpoint yanlış
    422,  # Unprocessable    → validation hatası
}

# Retry yapılacak "geçici hata" kodları
_RETRY_STATUS = {
    429,  # Too Many Requests
    500,  # Internal Server Error
    502,  # Bad Gateway
    503,  # Service Unavailable
    504,  # Gateway Timeout
}


class TravelSearchAPI:
    """
    Tatil sitesi için merkezi seyahat arama API sınıfı.
    Uçak, otel, kiralık ev, kiralık araç, otobüs aramalarını destekler.
    AI modülüyle search_all() üzerinden entegre edilebilir.
    """

    SERPAPI_BASE = "https://serpapi.com/search"
    FLIXBUS_BASE = "https://global.api.flixbus.com/search/service/v4/search"
    OBILET_BASE  = "https://obilet.com/api/v2"

    MIN_REQUEST_INTERVAL = 3.0   # istekler arası minimum süre (saniye)
    MAX_RETRIES          = 3
    RETRY_BACKOFF        = 2.0   # 429/5xx'te her retry'da bu kadar çarp (üstel)

    def __init__(
        self,
        serpapi_key: str | None = None,
        currency: str = "TRY",
        language: str = "tr",
        country: str = "tr",
    ):
        self.serpapi_key = serpapi_key or os.getenv("SERPAPI_KEY")
        self.currency    = currency
        self.language    = language
        self.country     = country

        self._last_request_time: dict[str, float] = {}
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        })

        if not self.serpapi_key:
            logger.warning("SERPAPI_KEY bulunamadı! .env dosyasını kontrol et.")

    # ─────────────────────────────────────────
    # PRIVATE: Rate limiter
    # ─────────────────────────────────────────

    def _rate_limit(self, source: str) -> None:
        """İki istek arasında MIN_REQUEST_INTERVAL kadar bekler."""
        now  = time.time()
        last = self._last_request_time.get(source, 0)
        gap  = now - last
        if gap < self.MIN_REQUEST_INTERVAL:
            time.sleep(self.MIN_REQUEST_INTERVAL - gap)
        self._last_request_time[source] = time.time()

    # ─────────────────────────────────────────
    # PRIVATE: Merkezi HTTP katmanı
    # ─────────────────────────────────────────

    def _make_request(
        self,
        url: str,
        params: dict[str, Any],
        source: str = "serpapi",
        method: str = "GET",
        json_body: dict | None = None,
    ) -> APIResponse:
        """
        Tüm HTTP isteklerinin geçtiği merkezi metod.
        - SerpApi için ortak parametreleri otomatik ekler
        - Status koduna göre akıllı retry uygular
        - Her zaman APIResponse döner (ok=False → hata, ok=True → veri)
        """

        # SerpApi için zorunlu parametreleri otomatik ekle
        if source == "serpapi":
            params = {
                "api_key":  self.serpapi_key,
                "hl":       self.language,
                "gl":       self.country,
                "currency": self.currency,
                **params,   # caller'ın parametreleri override edebilir
            }

        self._rate_limit(source)

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                if method == "POST":
                    resp = self._session.post(
                        url, params=params, json=json_body, timeout=15
                    )
                else:
                    resp = self._session.get(url, params=params, timeout=15)

                resp.raise_for_status()

                # Başarılı: ham JSON'u wrapper içinde döndür
                # (normalizasyon caller'da yapılır)
                return APIResponse(
                    ok=True,
                    source=source,
                    count=0,        # caller normalize ettikten sonra set eder
                    data=[],        # caller doldurur
                    error="",
                )

                # NOT: ham JSON'a ihtiyaç var, ayrı döndür
                # → aşağıda _make_request_raw olarak refactor edilecek
                # şimdilik ham veriyi _raw alanında taşı:

            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response else 0

                # Kalıcı hata → retry yapma, direkt dön
                if status in _NO_RETRY_STATUS:
                    msg = f"HTTP {status} - {'API key geçersiz' if status in (401, 403) else 'İstek hatası'}"
                    logger.error(f"[{source}] {msg}. Retry yapılmıyor.")
                    return APIResponse(ok=False, source=source, count=0, data=[], error=msg)

                # Geçici hata → retry
                if status in _RETRY_STATUS:
                    wait = self.RETRY_BACKOFF ** attempt
                    logger.warning(
                        f"[{source}] HTTP {status} (deneme {attempt}/{self.MAX_RETRIES}). "
                        f"{wait:.1f}s bekleniyor..."
                    )
                    time.sleep(wait)
                    continue

                # Tanımlanmamış hata kodu
                logger.error(f"[{source}] Beklenmeyen HTTP {status}")
                return APIResponse(ok=False, source=source, count=0, data=[], error=str(e))

            except requests.exceptions.Timeout:
                wait = self.RETRY_BACKOFF * attempt
                logger.warning(
                    f"[{source}] Timeout (deneme {attempt}/{self.MAX_RETRIES}). "
                    f"{wait:.1f}s bekleniyor..."
                )
                time.sleep(wait)

            except requests.exceptions.RequestException as e:
                # Bağlantı hatası, DNS vs. → retry faydasız
                logger.error(f"[{source}] Bağlantı hatası: {e}")
                return APIResponse(ok=False, source=source, count=0, data=[], error=str(e))

        return APIResponse(
            ok=False, source=source, count=0, data=[],
            error=f"Maksimum retry sayısına ulaşıldı ({self.MAX_RETRIES})"
        )

    # ─────────────────────────────────────────
    # PRIVATE: Raw JSON + normalize helper
    # ─────────────────────────────────────────

    def _fetch_json(
        self,
        url: str,
        params: dict[str, Any],
        source: str = "serpapi",
        method: str = "GET",
        json_body: dict | None = None,
    ) -> tuple[bool, dict | list | None, str]:
        """
        Ham JSON'a ihtiyaç duyulan yerler için yardımcı metod.
        _make_request'in auth/retry logic'ini kullanır.

        Returns:
            (ok: bool, raw_data: dict|list|None, error_msg: str)
        """
        self._rate_limit(source)
        

        if source == "serpapi":
            params = {
                "api_key":  self.serpapi_key,
                "hl":       self.language,
                "gl":       self.country,
                "currency": self.currency,
                **params,
            }

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                if method == "POST":
                    resp = self._session.post(
                        url, params=params, json=json_body, timeout=15
                    )
                else:
                    resp = self._session.get(url, params=params, timeout=15)

                resp.raise_for_status()
                return True, resp.json(), ""

            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response else 0
                logger.error(f"[{source}] Response: {e.response.text[:200] if e.response else 'None'}")
                logger.error(f"[{source}] Exception type: {type(e).__name__}")
                if status in _NO_RETRY_STATUS:
                    msg = f"HTTP {status}"
                    logger.error(f"[{source}] {msg}. Retry yapılmıyor.")
                    return False, None, msg
                if status in _RETRY_STATUS:
                    wait = self.RETRY_BACKOFF ** attempt
                    logger.warning(f"[{source}] HTTP {status}, {wait:.1f}s bekle...")
                    time.sleep(wait)
                    continue
                return False, None, str(e)

            except requests.exceptions.Timeout:
                time.sleep(self.RETRY_BACKOFF * attempt)

            except requests.exceptions.RequestException as e:
                return False, None, str(e)

        return False, None, f"Max retry ({self.MAX_RETRIES}) aşıldı"

   # travel_search_api.py
# ──────────────────────────────────────────────────────────────────────────────
# Tatil sitesi için merkezi seyahat arama modülü.
# Desteklenen kategoriler: uçak, otel, kiralık ev, kiralık araç, otobüs
# Kurulum: pip install requests python-dotenv
# ──────────────────────────────────────────────────────────────────────────────

import os
import re
import time
import logging
import requests
from collections import deque
from datetime import date as _date
from typing import Any, TypedDict
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# TYPE DEFINITIONS
# ──────────────────────────────────────────────────────────────────────────────

class TravelItem(TypedDict, total=False):
    id:          str
    title:       str
    price:       float
    currency:    str
    rating:      float
    thumbnail:   str
    source:      str
    details:     dict
    booking_url: str


class APIResponse(TypedDict):
    ok:     bool
    source: str
    count:  int
    data:   list
    error:  str


_NO_RETRY_STATUS = {400, 401, 403, 404, 422}
_RETRY_STATUS    = {429, 500, 502, 503, 504}


# ──────────────────────────────────────────────────────────────────────────────
# ANA SINIF
# ──────────────────────────────────────────────────────────────────────────────

class TravelSearchAPI:
    """
    Tatil sitesi için merkezi seyahat arama API sınıfı.

    Kullanım:
        api = TravelSearchAPI()
        result = api.search_flights("IST", "AMS", "2026-06-01")
        result = api.search_hotels("Amsterdam", "2026-06-01", "2026-06-07")
        result = api.search_all("flights", {...})

    Her metod APIResponse döner:
        {"ok": True, "source": "google_flights", "count": 12, "data": [...], "error": ""}
    """

    SERPAPI_BASE = "https://serpapi.com/search"
    FLIXBUS_BASE = "https://global.api.flixbus.com/search/service/v4/search"
    OBILET_BASE  = "https://api.obilet.com/api/v2"

    MIN_REQUEST_INTERVAL = 2.5
    MAX_RETRIES          = 3
    RETRY_BACKOFF        = 2.0

    def __init__(
        self,
        serpapi_key: str | None = None,
        obilet_key:  str | None = None,
        currency:    str = "TRY",
        language:    str = "tr",
        country:     str = "tr",
    ):
        self.serpapi_key = serpapi_key or os.getenv("SERPAPI_KEY", "")
        self.obilet_key  = obilet_key  or os.getenv("OBILET_KEY", "")
        self.rapidapi_key = os.getenv("RAPIDAPI_KEY", "")
        if not self.rapidapi_key:
            logger.info("RAPIDAPI_KEY bulunamadı, FlixBus RapidAPI atlanacak.")
        self.currency    = currency
        self.language    = language
        self.country     = country

        self._last_request_time: dict[str, float] = {}
        self._user_rate_limit:   dict[str, deque] = {}
        self._iata_cache:        dict[str, str]   = {}

        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
            "Accept":          "application/json",
        })

        if not self.serpapi_key:
            logger.warning("SERPAPI_KEY bulunamadı! .env dosyasına ekle.")
        if not self.obilet_key:
            logger.info("OBILET_KEY bulunamadı, otobüs araması sadece FlixBus kullanacak.")

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Rate limiter
    # ──────────────────────────────────────────────────────────────────────────

    def _rate_limit(self, source: str) -> None:
        now  = time.time()
        last = self._last_request_time.get(source, 0.0)
        gap  = now - last
        if gap < self.MIN_REQUEST_INTERVAL:
            time.sleep(self.MIN_REQUEST_INTERVAL - gap)
        self._last_request_time[source] = time.time()

        # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Yardımcı metodlar
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_duration(value: int | str) -> int:
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            # "20:45" formatı → dakika
            if ":" in value and "h" not in value:
                parts = value.split(":")
                return int(parts[0]) * 60 + int(parts[1])
            total = 0
            if "h" in value:
                parts = value.split("h")
                total += int(parts[0].strip()) * 60
                value = parts[1]
            if "m" in value:
                total += int(value.replace("m", "").strip())
            return total
        return 0
    def _resolve_iata(self, location: str) -> str:
        """
        Verilen değer zaten IATA koduysa (3 harf, büyük) direkt döner.
        Şehir ismi gelirse önce _CITY_TO_IATA sözlüğüne, sonra in-memory cache'e,
        son olarak SerpApi'ye bakar. Bulunan sonuç cache'lenir.
        """
        cleaned = location.strip()

        if len(cleaned) == 3 and cleaned.isalpha():
            return cleaned.upper()

        key = cleaned.replace("İ", "i").replace("I", "i").replace("ı", "i").lower()

        # 1) Statik sözlük
        static = self._CITY_TO_IATA.get(key)
        if static:
            return static

        # 2) In-memory cache (başarısız aramalar None ile kayıtlı)
        if key in self._iata_cache:
            cached = self._iata_cache[key]
            return cached if cached else cleaned

        # 3) SerpApi
        params = {
            "engine": "google_flights_locations",
            "q":      cleaned,
        }
        ok, raw, _ = self._fetch_json(self.SERPAPI_BASE, params, source="serpapi")

        if ok and isinstance(raw, dict):
            locations = raw.get("locations", [])
            if locations:
                code = locations[0].get("id", "")
                if code:
                    logger.info(f"_resolve_iata: '{cleaned}' → '{code}'")
                    self._iata_cache[key] = code
                    return code

        self._iata_cache[key] = ""  # başarısız → cache'e işaretle
        logger.warning(f"_resolve_iata: '{cleaned}' için IATA kodu bulunamadı, orijinal kullanılıyor.")
        return cleaned

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Merkezi HTTP katmanı
    # ──────────────────────────────────────────────────────────────────────────

    def _fetch_json(
        self,
        url:       str,
        params:    dict[str, Any],
        source:    str = "serpapi",
        method:    str = "GET",
        json_body: dict | None = None,
        headers:   dict | None = None,
    ) -> tuple[bool, dict | list | None, str]:
        """
        Ham JSON döndüren merkezi HTTP istek metodu.
        Returns: (ok, raw_data, error_message)
        """
        if source == "serpapi":
            params = {
                "api_key":  self.serpapi_key,
                "hl":       self.language,
                "gl":       self.country,
                "currency": self.currency,
                **params,
            }

        self._rate_limit(source)

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                req_headers = {**self._session.headers, **(headers or {})}

                if method == "POST":
                    resp = self._session.post(
                        url, params=params, json=json_body,
                        headers=req_headers, timeout=15
                    )
                else:
                    resp = self._session.get(
                        url, params=params,
                        headers=req_headers, timeout=15
                    )

                resp.raise_for_status()
                return True, resp.json(), ""

            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response else 0

                if status in _NO_RETRY_STATUS:
                    detail = {
                        401: "API key geçersiz veya eksik",
                        403: "Erişim reddedildi",
                        404: "Endpoint bulunamadı",
                        400: f"Geçersiz parametre: {e.response.text[:200] if e.response else ''}",  # ← güncelle
                        422: "Parametre doğrulama hatası",
                    }.get(status, f"HTTP {status}")
                    logger.error(f"[{source}] {detail}. Retry yapılmıyor.")
                    return False, None, detail

                if status in _RETRY_STATUS:
                    wait = self.RETRY_BACKOFF ** attempt
                    logger.warning(
                        f"[{source}] HTTP {status} "
                        f"(deneme {attempt}/{self.MAX_RETRIES}), "
                        f"{wait:.1f}s bekleniyor..."
                    )
                    time.sleep(wait)
                    continue

                logger.error(f"[{source}] Beklenmeyen HTTP {status}")
                return False, None, f"HTTP {status}"

            except requests.exceptions.Timeout:
                wait = self.RETRY_BACKOFF * attempt
                logger.warning(
                    f"[{source}] Timeout "
                    f"(deneme {attempt}/{self.MAX_RETRIES}), "
                    f"{wait:.1f}s bekleniyor..."
                )
                time.sleep(wait)

            except requests.exceptions.RequestException as e:
                safe_err = self._sanitize_log(str(e))
                logger.error(f"[{source}] Bağlantı hatası: {safe_err}")
                return False, None, safe_err

        return False, None, f"Maksimum retry sayısına ulaşıldı ({self.MAX_RETRIES})"

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Response factory
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _ok(source: str, data: list[TravelItem]) -> APIResponse:
        return APIResponse(ok=True, source=source, count=len(data), data=data, error="")

    @staticmethod
    def _err(source: str, error: str) -> APIResponse:
        return APIResponse(ok=False, source=source, count=0, data=[], error=error)

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Normalize metodları
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_serpapi_time(raw_time: str) -> tuple[str, str]:
        """Split SerpAPI time string 'YYYY-MM-DD HH:MM' into (date, time)."""
        if not raw_time:
            return '', ''
        if ' ' in raw_time:
            parts = raw_time.split(' ', 1)
            return parts[0], parts[1][:5]
        return '', raw_time[:5]

    @staticmethod
    def _offset_to_time(offset) -> str:
        """Convert FlixBus dep_offset/arr_offset (Unix ts, ms, minutes, or ISO str) to HH:MM."""
        if not offset:
            return ''
        if isinstance(offset, str):
            # ISO datetime: "2026-06-15T08:00:00+02:00" or "2026-06-15 08:00"
            clean = offset[:19].replace('T', ' ')
            if len(clean) >= 16 and clean[13] == ':':
                return clean[11:16]
            if len(clean) >= 5 and clean[2] == ':':
                return clean[:5]
            try:
                val = int(offset)
            except ValueError:
                return offset
        else:
            val = int(offset)
        if val >= 1_000_000_000:          # Unix seconds (post-2001)
            from datetime import datetime
            return datetime.fromtimestamp(val).strftime('%H:%M')
        elif val >= 100_000_000:          # Unix milliseconds
            from datetime import datetime
            return datetime.fromtimestamp(val / 1000).strftime('%H:%M')
        elif val < 1440:                  # minutes from midnight
            return f"{val // 60:02d}:{val % 60:02d}"
        return str(offset)

    @staticmethod
    def _offset_to_date(offset, fallback: str = '') -> str:
        """Extract YYYY-MM-DD date from a Unix timestamp offset; fall back to given date."""
        try:
            val = int(offset)
            if val >= 1_000_000_000:
                from datetime import datetime
                return datetime.fromtimestamp(val).strftime('%Y-%m-%d')
            elif val >= 100_000_000:
                from datetime import datetime
                return datetime.fromtimestamp(val / 1000).strftime('%Y-%m-%d')
        except Exception:
            pass
        return fallback

    def _normalize_flights(self, raw: dict, depart_date: str = '', return_date: str = '') -> list[TravelItem]:
        items: list[TravelItem] = []
        all_flights = raw.get("best_flights", []) + raw.get("other_flights", [])

        for idx, flight_group in enumerate(all_flights):
            legs = flight_group.get("flights", [])
            if not legs:
                continue

            first_leg = legs[0]
            last_leg  = legs[-1]
            airlines  = ", ".join(
                leg.get("airline", "") for leg in legs if leg.get("airline")
            )

            # Parse times from SerpAPI format "YYYY-MM-DD HH:MM"
            raw_dep = first_leg.get("departure_airport", {}).get("time", "")
            raw_arr = last_leg.get("arrival_airport", {}).get("time", "")
            dep_date_parsed, dep_time = self._parse_serpapi_time(raw_dep)
            _,                arr_time = self._parse_serpapi_time(raw_arr)
            departure_date = dep_date_parsed or depart_date

            # Booking URL from booking_options (first available)
            booking_opts = flight_group.get("booking_options", [])
            booking_url = ''
            if booking_opts:
                booking_url = (
                    booking_opts[0].get("url", "")
                    or booking_opts[0].get("book_with_data", {}).get("url", "")
                )

            # Google Flights URL using #flt= deep-link format (preserves trip type & dates)
            dep_id = first_leg.get("departure_airport", {}).get("id", "")
            arr_id = last_leg.get("arrival_airport", {}).get("id", "")
            if dep_id and arr_id and departure_date:
                if return_date:
                    google_flights_url = (
                        f"https://www.google.com/travel/flights"
                        f"#flt={dep_id}.{arr_id}.{departure_date}*{arr_id}.{dep_id}.{return_date}"
                        f";e:1;sd:1;t:r"
                    )
                else:
                    google_flights_url = (
                        f"https://www.google.com/travel/flights"
                        f"#flt={dep_id}.{arr_id}.{departure_date}"
                        f";e:1;sd:1;t:f"
                    )
            else:
                google_flights_url = ''

            item: TravelItem = {
                "id":          f"flight_{idx}",
                "title": (
                    f"{dep_id} → {arr_id} | {airlines}"
                ),
                "price":       float(flight_group.get("price", 0)),
                "currency":    self.currency,
                "rating":      float(flight_group.get("score", 0.0)),
                "thumbnail":   first_leg.get("airline_logo", ""),
                "source":      "google_flights",
                "booking_url": booking_url,
                "details": {
                    "departure_airport":  first_leg.get("departure_airport", {}),
                    "arrival_airport":    last_leg.get("arrival_airport", {}),
                    "departure_time":     dep_time,
                    "arrival_time":       arr_time,
                    "departure_date":     departure_date,
                    "total_duration_min": self._parse_duration(flight_group.get("total_duration", 0)),
                    "stops":              len(legs) - 1,
                    "layovers":           flight_group.get("layovers", []),
                    "travel_class":       first_leg.get("travel_class", ""),
                    "airline":            airlines,
                    "flight_numbers":     [leg.get("flight_number", "") for leg in legs],
                    "airplane":           first_leg.get("airplane", ""),
                    "legroom":            first_leg.get("legroom", ""),
                    "extensions":         first_leg.get("extensions", []),
                    "carbon_emissions":   flight_group.get("carbon_emissions", {}),
                    "is_best":            idx < len(raw.get("best_flights", [])),
                    "departure_token":    flight_group.get("departure_token", ""),
                    "google_flights_url": google_flights_url,
                },
            }
            items.append(item)

        return items

    def _normalize_hotels(self, raw: dict) -> list[TravelItem]:
        items: list[TravelItem] = []

        for idx, prop in enumerate(raw.get("properties", [])):
            price_info  = prop.get("rate_per_night", {})
            total_info  = prop.get("total_rate", {})
            raw_price   = price_info.get("lowest", total_info.get("lowest", "0"))
            price = self._clean_price(raw_price)

            item: TravelItem = {
                "id":          prop.get("property_token", f"hotel_{idx}"),
                "title":       prop.get("name", ""),
                "price":       price,
                "currency":    self.currency,
                "rating":      float(prop.get("overall_rating", 0)),
                "thumbnail":   prop.get("thumbnail", ""),
                "source":      "google_hotels",
                "booking_url": prop.get("link", ""),
                "details": {
                    "type":               prop.get("type", ""),
                    "hotel_class":        prop.get("hotel_class", 0),
                    "check_in_time":      prop.get("check_in_time", ""),
                    "check_out_time":     prop.get("check_out_time", ""),
                    "reviews_count":      prop.get("reviews", 0),
                    "location":           prop.get("gps_coordinates", {}),
                    "amenities":          prop.get("amenities", []),
                    "nearby_places":      prop.get("nearby_places", []),
                    "images":             prop.get("images", []),
                    "free_cancellation":  prop.get("free_cancellation", False),
                    "sustainability":     prop.get("eco_certified", False),
                    "price_per_night":    price_info.get("lowest", ""),
                    "total_price":        total_info.get("lowest", ""),
                    "price_before_taxes": total_info.get("before_taxes_fees", ""),
                },
            }
            items.append(item)

        return items

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: Uçak arama
    # ──────────────────────────────────────────────────────────────────────────

    def search_flights(
        self,
        origin:       str,
        destination:  str,
        depart_date:  str,
        return_date:  str = "",
        adults:       int = 1,
        children:     int = 0,
        travel_class: int = 1,
        stops:        int = 0,
        trip_type:    int = 1,
        currency:     str = "",
    ) -> APIResponse:
        """
        Uçak bileti arar (Google Flights via SerpApi).

        Args:
            origin:       Kalkış IATA kodu (örn: "IST", "ESB", "ADB")
            destination:  Varış IATA kodu  (örn: "AMS", "LHR", "CDG")
            depart_date:  Gidiş tarihi YYYY-MM-DD
            return_date:  Dönüş tarihi YYYY-MM-DD (boş → tek yön)
            adults:       Yetişkin sayısı
            children:     Çocuk sayısı
            travel_class: 1=Economy 2=Premium Economy 3=Business 4=First
            stops:        0=Hepsi 1=Direkt 2=Max 1 aktarma 3=Max 2 aktarma
            trip_type:    1=Gidiş-dönüş 2=Tek yön 3=Multi-city
            currency:     Para birimi (boş → __init__'teki currency kullanılır)
        """
        if not return_date and trip_type == 1:
            trip_type = 2   # tek yön

        params: dict[str, Any] = {
            "engine":        "google_flights",
            "departure_id":  self._resolve_iata(origin),
            "arrival_id":    self._resolve_iata(destination),
            "outbound_date": depart_date,
            "type":          trip_type,
            "adults":        adults,
            "children":      children,
            "travel_class":  travel_class,
            "stops":         stops,
            "currency":      currency or self.currency,
            "deep_search":   True,
        }

        if return_date:
            params["return_date"] = return_date

        ok, raw, error = self._fetch_json(self.SERPAPI_BASE, params, source="serpapi")
        if not ok:
            return self._err("google_flights", error)

        items = self._normalize_flights(raw, depart_date, return_date)
        if not items:
            return self._err("google_flights", "Sonuç bulunamadı")

        logger.info(f"search_flights: {len(items)} uçuş bulundu ({origin}→{destination})")
        return self._ok("google_flights", items)

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: Otel arama
    # ──────────────────────────────────────────────────────────────────────────

    def search_hotels(
        self,
        location:    str,
        checkin:     str,
        checkout:    str,
        adults:      int = 2,
        children:    int = 0,
        sort_by:     int = 3,
        min_price:   int = 0,
        max_price:   int = 0,
        min_rating:  int = 0,
        hotel_class: int = 0,
        currency:    str = "",
    ) -> APIResponse:
        """
        Otel arar (Google Hotels via SerpApi).

        Args:
            location:    Şehir veya bölge (örn: "Amsterdam", "Paris Fransa")
            checkin:     Giriş tarihi YYYY-MM-DD
            checkout:    Çıkış tarihi YYYY-MM-DD
            adults:      Yetişkin sayısı
            children:    Çocuk sayısı
            sort_by:     3=En ucuz 8=En yüksek puan 13=En çok yorumlanan
            min_price:   Minimum gecelik fiyat (0 → filtre yok)
            max_price:   Maksimum gecelik fiyat (0 → filtre yok)
            min_rating:  Minimum puan 1-5 (0 → filtre yok)
            hotel_class: Yıldız sayısı 2-5 (0 → filtre yok)
            currency:    Para birimi (boş → __init__'teki currency kullanılır)
        """
        params: dict[str, Any] = {
            "engine":         "google_hotels",
            "q":              location,
            "check_in_date":  checkin,
            "check_out_date": checkout,
            "adults":         adults,
            "children":       children,
            "sort":           sort_by,
            "currency":       currency or self.currency,
        }

        if min_price > 0:   params["min_price"]   = min_price
        if max_price > 0:   params["max_price"]   = max_price
        if min_rating > 0:  params["min_rating"]  = min_rating
        if hotel_class > 0: params["hotel_class"] = hotel_class

        ok, raw, error = self._fetch_json(self.SERPAPI_BASE, params, source="serpapi")
        if not ok:
            return self._err("google_hotels", error)

        items = self._normalize_hotels(raw)
        if not items:
            return self._err("google_hotels", "Sonuç bulunamadı")

        logger.info(f"search_hotels: {len(items)} otel bulundu ({location})")
        return self._ok("google_hotels", items)
    
    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Normalize - Kiralık Ev & Araç
    # ──────────────────────────────────────────────────────────────────────────

    def _normalize_vacation_rentals(self, raw: dict) -> list[TravelItem]:
        """
        SerpApi google_vacation_rentals response'unu TravelItem listesine dönüştürür.
        """
        items: list[TravelItem] = []

        # Önemli amenity'leri boolean olarak ayır, geri kalanları kırp (AI token limiti)
        PRIORITY_AMENITIES = {"wifi", "kitchen", "parking", "pool", "air conditioning",
                               "washer", "dryer", "heating", "tv", "elevator"}

        # Google bazen "rentals" yerine "properties" anahtarı kullanır
        rental_list = raw.get("rentals") or raw.get("properties", [])

        for idx, prop in enumerate(rental_list):
            raw_price   = prop.get("rate_per_night", {}).get("extracted_lowest", 0)
            price = self._clean_price(raw_price)

            # Koordinat güvenli erişim
            gps = prop.get("gps_coordinates", {})
            location = {
                "latitude":  gps.get("latitude")  if isinstance(gps, dict) else None,
                "longitude": gps.get("longitude") if isinstance(gps, dict) else None,
                "region":    prop.get("location", ""),
            }

            # Amenities: priority boolean'lar + max 15 item liste
            raw_amenities = [a.lower() for a in prop.get("amenities", [])]
            priority_flags = {a: (a in raw_amenities) for a in PRIORITY_AMENITIES}
            extra_amenities = [a for a in raw_amenities if a not in PRIORITY_AMENITIES][:15]

            item: TravelItem = {
                "id":          prop.get("property_token", f"rental_{idx}"),
                "title":       prop.get("name", ""),
                "price":       price,
                "currency":    self.currency,
                "rating":      float(prop.get("overall_rating", 0.0)),
                "thumbnail":   prop.get("thumbnail", ""),
                "source":      "google_vacation_rentals",
                "booking_url": prop.get("link", ""),
                "details": {
                    "type":              prop.get("type", ""),
                    "guests":            prop.get("guests", 0),
                    "bedrooms":          prop.get("bedrooms", 0),
                    "bathrooms":         prop.get("bathrooms", 0),
                    "beds":              prop.get("beds", 0),
                    "amenities":         priority_flags,
                    "extra_amenities":   extra_amenities,
                    "reviews_count":     prop.get("reviews", 0),
                    "location":          location,
                    "images":            prop.get("images", []),
                    "free_cancellation": prop.get("free_cancellation", False),
                    "price_per_night":   prop.get("rate_per_night", {}).get("lowest", ""),
                    "total_price":       prop.get("total_rate", {}).get("lowest", ""),
                    "check_in_time":     prop.get("check_in_time", ""),
                    "check_out_time":    prop.get("check_out_time", ""),
                    "host":              prop.get("host", {}),
                },
            }
            items.append(item)

        return items

    def _normalize_car_rentals_maps(
        self, raw: dict, pickup_date: str, dropoff_date: str
    ) -> list[TravelItem]:
        items: list[TravelItem] = []

        for idx, place in enumerate(raw.get("local_results", [])):
            gps = place.get("gps_coordinates", {})

            item: TravelItem = {
                "id":          place.get("place_id", f"car_{idx}"),
                "title":       place.get("title", ""),
                "price":       0.0,         # Maps fiyat vermez, booking_url üzerinden gidilir
                "currency":    self.currency,
                "rating":      float(place.get("rating", 0.0)),
                "thumbnail":   place.get("thumbnail", ""),
                "source":      "google_maps_cars",
                "booking_url": place.get("website", ""),
                "details": {
                    "address":       place.get("address", ""),
                    "phone":         place.get("phone", ""),
                    "pickup_date":   pickup_date,
                    "dropoff_date":  dropoff_date,
                    "pickup_time":   "10:00",
                    "dropoff_time":  "10:00",
                    "rating_count":  place.get("reviews", 0),
                    "open_now":      place.get("open_state", ""),
                    "location": {
                        "latitude":  gps.get("latitude")  if isinstance(gps, dict) else None,
                        "longitude": gps.get("longitude") if isinstance(gps, dict) else None,
                    },
                    "hours":         place.get("hours", ""),
                    "service_options": place.get("service_options", {}),
                },
            }
            items.append(item)

        return items
    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: Kiralık ev arama
    # ──────────────────────────────────────────────────────────────────────────

    def search_vacation_rentals(
        self,
        location:  str,
        checkin:   str,
        checkout:  str,
        adults:    int = 2,
        children:  int = 0,
        min_price: int = 0,
        max_price: int = 0,
        min_beds:  int = 0,
        currency:  str = "",
    ) -> APIResponse:
        # "apartments vacation rentals" eklenerek Google'ın ev motorunu daha iyi tetikle
        query = f"{location} apartments vacation rentals"

        params: dict[str, Any] = {
            "engine":            "google_hotels",   # ayrı engine yok, hotels altında
            "q":                 query,
            "check_in_date":     checkin,
            "check_out_date":    checkout,
            "adults":            adults,
            "children":          children,
            "vacation_rentals":  True,              # bu parametre kiralık evleri filtreler
            "currency":          currency or self.currency,
        }

        if min_price > 0: params["min_price"] = min_price
        if max_price > 0: params["max_price"] = max_price
        if min_beds > 0:  params["bedrooms"]  = min_beds

        ok, raw, error = self._fetch_json(self.SERPAPI_BASE, params, source="serpapi")
        if not ok:
            return self._err("google_vacation_rentals", error)

        items = self._normalize_vacation_rentals(raw)
        if not items:
            return self._err("google_vacation_rentals", "Sonuç bulunamadı")

        logger.info(f"search_vacation_rentals: {len(items)} kiralık ev bulundu ({location})")
        return self._ok("google_vacation_rentals", items)

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: Kiralık araç arama
    # ──────────────────────────────────────────────────────────────────────────

    def search_car_rentals(
        self,
        location:     str,
        pickup_date:  str,
        dropoff_date: str,
        pickup_time:  str = "10:00",
        dropoff_time: str = "10:00",
        currency:     str = "",
    ) -> APIResponse:
        # Google Maps ile araç kiralama noktalarını ara
        params: dict[str, Any] = {
            "engine": "google_maps",
            "q":      f"car rental {location}",
            "type":   "search",
        }

        ok, raw, error = self._fetch_json(self.SERPAPI_BASE, params, source="serpapi")
        if not ok:
            return self._err("google_cars_rental", error)

        items = self._normalize_car_rentals_maps(raw, pickup_date, dropoff_date)
        if not items:
            return self._err("google_cars_rental", "Sonuç bulunamadı")

        logger.info(f"search_car_rentals: {len(items)} araç kiralama yeri bulundu ({location})")
        return self._ok("google_cars_rental", items)
    
    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Fiyat temizleme helper (DRY)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _clean_price(raw: Any) -> float:
        """
        Her formattaki fiyatı float'a çevirir.
        "₺7.520"     → 7520.0   (TR/EU binlik nokta)
        "₺1.250,50"  → 1250.5   (TR/EU binlik nokta + virgül ondalık)
        "$1,250.50"  → 1250.5   (ABD binlik virgül + nokta ondalık)
        "1.5"        → 1.5      (gerçek ondalık)
        """
        s = str(raw).strip()
        if not s:
            return 0.0
        s = re.sub(r"[^\d.,]", "", s)
        if not s:
            return 0.0
        if "," in s and "." in s:
            if s.rfind(",") > s.rfind("."):
                # "1.250,50" → TR/EU formatı
                s = s.replace(".", "").replace(",", ".")
            else:
                # "1,250.50" → ABD formatı
                s = s.replace(",", "")
        elif "," in s:
            # "1250,50" veya "1.250" yok ama virgül var
            s = s.replace(",", ".")
        elif s.count(".") > 1:
            # "1.250.000" → tüm noktalar binlik
            s = s.replace(".", "")
        elif "." in s:
            head, tail = s.rsplit(".", 1)
            if len(tail) == 3 and head:
                # "7.520" → binlik nokta
                s = head + tail
            # len(tail) != 3 → gerçek ondalık, dokunma
        try:
            return float(s)
        except ValueError:
            return 0.0

    @staticmethod                          # ← buraya ekle
    def _normalize_tr(text: str) -> str:
        """Türkçe karakterleri ASCII'ye çevirir, küçük harfe dönüştürür."""
        return (
            text.strip()
            .replace("İ", "i").replace("I", "i")
            .replace("ı", "i").replace("i̇", "i")
            .replace("Ğ", "g").replace("ğ", "g")
            .replace("Ü", "u").replace("ü", "u")
            .replace("Ş", "s").replace("ş", "s")
            .replace("Ö", "o").replace("ö", "o")
            .replace("Ç", "c").replace("ç", "c")
            .lower()
        )

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Normalize - Otobüs (FlixBus & Obilet)
    # ──────────────────────────────────────────────────────────────────────────

    def _normalize_flixbus(self, raw: dict, date: str = '') -> list[TravelItem]:
        items: list[TravelItem] = []
        all_journeys = raw.get("journeys", [])

        for idx, journey in enumerate(all_journeys):
            if "error" in journey:
                continue

            price = 0.0
            fares = journey.get("fares", [])
            if fares:
                price = float(fares[0].get("price", 0))

            dep_raw = journey.get("dep_offset", "")
            arr_raw = journey.get("arr_offset", "")
            dep_time = self._offset_to_time(dep_raw)
            arr_time = self._offset_to_time(arr_raw)
            # If offset is a Unix timestamp, extract the actual date from it
            dep_date = self._offset_to_date(dep_raw, date)

            item: TravelItem = {
                "id":          f"flixbus_{idx}",
                "title":       f"{journey.get('dep_name', '')} → {journey.get('arr_name', '')}",
                "price":       price,
                "currency":    journey.get("fares", [{}])[0].get("currency", "EUR") if fares else "EUR",
                "rating":      0.0,
                "thumbnail":   "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/FlixBus_logo.svg/320px-FlixBus_logo.svg.png",
                "source":      "flixbus",
                "booking_url": journey.get("deeplink", ""),
                "details": {
                    "departure_city":  journey.get("dep_name", ""),
                    "arrival_city":    journey.get("arr_name", ""),
                    "departure_time":  dep_time,
                    "arrival_time":    arr_time,
                    "departure_date":  dep_date,
                    "duration_min":    self._parse_duration(journey.get("duration", 0)),
                    "transfers":       journey.get("changeovers", 0),
                    "bus_company":     "FlixBus",
                },
            }
            items.append(item)

        return items

    def _normalize_obilet(self, raw: dict) -> list[TravelItem]:
        items: list[TravelItem] = []

        for idx, journey in enumerate(raw.get("data", {}).get("journeys", [])):
            item: TravelItem = {
                "id":          f"obilet_{idx}",
                "title": (
                    f"{journey.get('origin_name', '')} → "
                    f"{journey.get('destination_name', '')}"
                ),
                "price":       self._clean_price(journey.get("pricing", {}).get("list_price", 0)),
                "currency":    self.currency,
                "rating":      float(journey.get("partner", {}).get("rating", 0.0)),
                "thumbnail":   journey.get("partner", {}).get("logo", ""),
                "source":      "obilet",
                "booking_url": "https://www.obilet.com",
                "details": {
                    "departure_city":  journey.get("origin_name", ""),
                    "arrival_city":    journey.get("destination_name", ""),
                    "departure_time":  journey.get("departure_time", ""),
                    "arrival_time":    journey.get("arrival_time", ""),
                    "duration_min":    self._parse_duration(journey.get("duration", 0)),
                    "bus_company":     journey.get("partner", {}).get("name", ""),
                    "bus_type":        journey.get("bus_type", ""),
                    "available_seats": journey.get("quota", 0),
                    "amenities": {
                        "wifi":          journey.get("features", {}).get("wifi", False),
                        "power_outlet":  journey.get("features", {}).get("power_outlet", False),
                        "refreshment":   journey.get("features", {}).get("refreshment", False),
                        "entertainment": journey.get("features", {}).get("entertainment", False),
                    },
                    "journey_id":      journey.get("journey_id", ""),
                },
            }
            items.append(item)

        return items

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: FlixBus & Obilet istek metodları
    # ──────────────────────────────────────────────────────────────────────────

    FLIXBUS_RAPIDAPI_BASE = "https://flixbus2.p.rapidapi.com"

    def _get_flixbus_id_rapidapi(self, city_name: str) -> str:
        """
        RapidAPI FlixBus Autocomplete ile şehir ismi → FlixBus city ID çevirir.
        """
        ok, raw, error = self._fetch_json(
            url=f"{self.FLIXBUS_RAPIDAPI_BASE}/autocomplete",
            params={"query": city_name, "locale": "tr"},
            source="flixbus_rapidapi",
            headers={
                "x-rapidapi-key":  self.rapidapi_key,
                "x-rapidapi-host": "flixbus2.p.rapidapi.com",
            },
        )

        if not ok or not isinstance(raw, list) or not raw:
            logger.warning(f"FlixBus autocomplete: '{city_name}' için ID bulunamadı.")
            return ""

        # İlk sonuç en alakalı şehir
        city_id = str(raw[0].get("id", ""))
        logger.info(f"FlixBus autocomplete: '{city_name}' → '{city_id}'")
        return city_id

    def _search_flixbus(self, origin: str, destination: str, date: str) -> list[TravelItem]:
        """
        RapidAPI üzerinden FlixBus trip arama.
        Tarih formatı: YYYY-MM-DD → DD.MM.YYYY çevrimi yapılır.
        """
        if not self.rapidapi_key:
            logger.info("RAPIDAPI_KEY yok, FlixBus atlanıyor.")
            return []

        # Şehir ismi → FlixBus ID
        from_id = self._get_flixbus_id_rapidapi(origin)
        to_id   = self._get_flixbus_id_rapidapi(destination)

        if not from_id or not to_id:
            logger.warning(f"FlixBus: ID çözümlenemedi ({origin}→{destination})")
            return []

        # Tarih formatı: YYYY-MM-DD → DD.MM.YYYY
        try:
            parts     = date.split("-")
            flix_date = f"{parts[2]}.{parts[1]}.{parts[0]}"
        except Exception:
            flix_date = date

        ok, raw, error = self._fetch_json(
            url=f"{self.FLIXBUS_RAPIDAPI_BASE}/trips",
            params={
                 "from_id":   from_id,
                 "to_id":     to_id,
                 "date":      flix_date,
                 "adult":     1,
                 "search_by": "stations",   # ← "cities" değil "stations"
                 "children":  0,
                 "bikes":     0,
                 "currency":  "EUR",
                 "locale":    "en",
            },
            source="flixbus_rapidapi",
            headers={
                "x-rapidapi-key":  self.rapidapi_key,
                "x-rapidapi-host": "flixbus2.p.rapidapi.com",
            },
        )

        if not ok:
            logger.warning(f"FlixBus trips başarısız ({origin}→{destination}): {error}")
            return []

        return self._normalize_flixbus(raw, date)

    def _search_obilet(self, origin: str, destination: str, date: str) -> list[TravelItem]:
        """
        Obilet'e POST isteği atar. Şehir isimlerini Türkçe olarak kabul eder.
        OBILET_KEY yoksa direkt boş liste döner.
        """
        if not self.obilet_key:
            logger.info("Obilet key yok, bu kaynak atlanıyor.")
            return []

        headers = {
            "Authorization": f"Bearer {self.obilet_key}",
            "Content-Type":  "application/json",
        }

        json_body = {
            "origin":      origin,
            "destination": destination,
            "date":        date,          # Obilet YYYY-MM-DD kabul eder
            "currency":    self.currency,
        }

        ok, raw, error = self._fetch_json(
            url=f"{self.OBILET_BASE}/journeys",
            params={},
            source="obilet",
            method="POST",
            json_body=json_body,
            headers=headers,
        )

        if not ok:
            logger.warning(f"Obilet isteği başarısız: {error}")
            return []

        return self._normalize_obilet(raw)

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: Otobüs bileti arama
    # ──────────────────────────────────────────────────────────────────────────

    # Türkiye şehirleri seti
    _TR_CITIES = {
    # A-B
    "adana", "adiyaman", "afyonkarahisar", "agri", "aksaray", "amasya",
    "ankara", "antalya", "ardahan", "artvin", "aydin", "balikesir",
    "bartin", "batman", "bayburt", "bilecik", "bingol", "bitlis",
    "bolu", "burdur", "bursa",
    # C-E
    "canakkale", "cankiri", "corum", "denizli", "diyarbakir", "duzce",
    "edirne", "elazig", "erzincan", "erzurum", "eskisehir",
    # G-K
    "gaziantep", "giresun", "gumushane", "hakkari", "hatay", "igdir",
    "isparta", "istanbul", "izmir", "kahramanmaras", "karabuk",
    "karaman", "kars", "kastamonu", "kayseri", "kirikkale", "kirklareli",
    "kirsehir", "kilis", "kocaeli", "konya",
    # M-S
    "malatya", "manisa", "mardin", "mersin", "mugla", "mus", "nevsehir",
    "nigde", "ordu", "osmaniye", "rize", "sakarya", "samsun", "siirt",
    "sinop", "sivas",
    # S-Z
    "sanliurfa", "sirnak", "tekirdag", "tokat", "trabzon", "tunceli",
    "usak", "van", "yalova", "yozgat", "zonguldak",
    }

    def search_buses(
        self,
        origin:      str,
        destination: str,
        date:        str,
        currency:    str = "",
    ) -> APIResponse:
        if currency:
            self.currency = currency

        # Türkiye rotası kontrolü
        origin_key      = self._normalize_tr(origin)
        destination_key = self._normalize_tr(destination)

        if origin_key in self._TR_CITIES or destination_key in self._TR_CITIES:
            logger.info(f"search_buses: Türkiye rotası desteklenmiyor ({origin}→{destination})")
            return self._err("buses", f"Türkiye iç hatları şu an desteklenmiyor. Obilet üzerinden arama yapabilirsiniz: obilet.com")

        flixbus_items = self._search_flixbus(origin, destination, date)
        obilet_items  = self._search_obilet(origin, destination, date)

        merged = flixbus_items + obilet_items

        if not merged:
            return self._err("buses", "FlixBus'tan sonuç bulunamadı")

        merged.sort(key=lambda x: x.get("price", 0))

        logger.info(
            f"search_buses: {len(merged)} sefer bulundu "
            f"(FlixBus: {len(flixbus_items)}, Obilet: {len(obilet_items)}) "
            f"({origin}→{destination})"
        )
        return self._ok("buses", merged)
    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Lokasyon çözümleme (IATA ↔ Şehir ismi)
    # ──────────────────────────────────────────────────────────────────────────

    # Sık kullanılan şehir ↔ IATA eşlemesi
    _CITY_TO_IATA: dict[str, str] = {
        # Türkiye
        "istanbul":       "IST", "ankara":      "ESB", "izmir":        "ADB",
        "antalya":        "AYT", "bodrum":      "BJV", "dalaman":      "DLM",
        "adana":          "ADA", "trabzon":     "TZX", "gaziantep":    "GZT",
        "kayseri":        "ASR", "samsun":      "SZF", "erzurum":      "ERZ",
        "diyarbakir":     "DIY", "konya":       "KYA", "eskisehir":    "AOE",
        "nevsehir":       "NAV", "kapadokya":   "NAV", "mardin":       "MQM",
        "van":            "VAN", "malatya":     "MLX",
        # Avrupa
        "amsterdam":      "AMS", "london":      "LHR", "paris":        "CDG",
        "berlin":         "BER", "rome":        "FCO", "madrid":       "MAD",
        "barcelona":      "BCN", "vienna":      "VIE", "prague":       "PRG",
        "budapest":       "BUD", "warsaw":      "WAW", "brussels":     "BRU",
        "lisbon":         "LIS", "athens":      "ATH", "stockholm":    "ARN",
        "oslo":           "OSL", "copenhagen":  "CPH", "helsinki":     "HEL",
        "munich":         "MUC", "frankfurt":   "FRA", "hamburg":      "HAM",
        "zurich":         "ZRH", "geneva":      "GVA", "milan":        "MXP",
        "venice":         "VCE", "naples":      "NAP", "nice":         "NCE",
        "lyon":           "LYS", "manchester":  "MAN", "edinburgh":    "EDI",
        "dublin":         "DUB", "riga":        "RIX", "tallinn":      "TLL",
        "vilnius":        "VNO", "sofia":       "SOF", "bucharest":    "OTP",
        "zagreb":         "ZAG", "belgrade":    "BEG", "sarajevo":     "SJJ",
        "skopje":         "SKP", "tirana":      "TIA", "podgorica":    "TGD",
        "thessaloniki":   "SKG", "heraklion":   "HER", "rhodes":       "RHO",
        "santorini":      "JTR", "mykonos":     "JMK",
        # Orta Doğu / Afrika
        "dubai":          "DXB", "abu dhabi":   "AUH", "doha":         "DOH",
        "riyadh":         "RUH", "jeddah":      "JED", "kuwait":       "KWI",
        "muscat":         "MCT", "amman":       "AMM", "beirut":       "BEY",
        "cairo":          "CAI", "tel aviv":    "TLV",
        # Asya / Pasifik
        "tokyo":          "NRT", "osaka":       "KIX", "seoul":        "ICN",
        "beijing":        "PEK", "shanghai":    "PVG", "hong kong":    "HKG",
        "bangkok":        "BKK", "singapore":   "SIN", "kuala lumpur": "KUL",
        "bali":           "DPS", "jakarta":     "CGK", "manila":       "MNL",
        "delhi":          "DEL", "mumbai":      "BOM", "kolkata":      "CCU",
        "colombo":        "CMB", "kathmandu":   "KTM",
        # Amerika
        "new york":       "JFK", "los angeles": "LAX", "chicago":      "ORD",
        "miami":          "MIA", "dallas":      "DFW", "san francisco": "SFO",
        "seattle":        "SEA", "toronto":     "YYZ", "montreal":     "YUL",
        "vancouver":      "YVR", "mexico city": "MEX", "cancun":       "CUN",
        "sao paulo":      "GRU", "rio de janeiro": "GIG", "buenos aires": "EZE",
        "bogota":         "BOG",
    }

    _IATA_TO_CITY: dict[str, str] = {v: k.title() for k, v in _CITY_TO_IATA.items()}

    def _to_iata(self, location: str) -> str:
        cleaned = location.strip()
        if len(cleaned) == 3 and cleaned.isalpha():
            return cleaned.upper()
        # Türkçe büyük İ ve I için güvenli lower
        key = cleaned.replace("İ", "i").replace("I", "i").replace("ı", "i").lower()
        result = self._CITY_TO_IATA.get(key)
        if result:
            return result
        logger.warning(f"_to_iata: '{cleaned}' için IATA kodu bulunamadı, orijinal kullanılıyor.")
        return cleaned   # _resolve_iata çağrılmıyor artık

    def _to_city_name(self, location: str) -> str:
        """
        IATA kodunu şehir ismine çevirir.
        Zaten şehir ismiyse direkt döner.
        """
        cleaned = location.strip()
        if len(cleaned) == 3 and cleaned.isalpha():
            return self._IATA_TO_CITY.get(cleaned.upper(), cleaned)
        return cleaned.title()

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Security helpers
    # ──────────────────────────────────────────────────────────────────────────

    _LOG_SENSITIVE_KEYS = {"api_key", "key", "Authorization", "token", "obilet_key"}

    _REDACT_PATTERNS = [
        re.compile(r"(?i)(api_key|key|token|authorization)=[^\s&]+"),
        re.compile(r"\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b"),        # e-posta
        re.compile(r"\b(?:\d[ -]?){13,16}\b"),                   # kredi kartı
        re.compile(r"\b(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b"),  # telefon
    ]

    @classmethod
    def _sanitize_log(cls, value: Any) -> Any:
        """Loglara yazılmadan önce hassas alanları maskeler."""
        if isinstance(value, dict):
            return {
                k: ("***REDACTED***" if k in cls._LOG_SENSITIVE_KEYS else cls._sanitize_log(v))
                for k, v in value.items()
            }
        if isinstance(value, str):
            s = value
            for pat in cls._REDACT_PATTERNS:
                s = pat.sub(lambda m: m.group(0).split("=")[0] + "=***REDACTED***"
                            if "=" in m.group(0) else "***REDACTED***", s)
            return s
        return value

    _DATE_RE    = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    _UNSAFE_RE  = re.compile(r"[<>\"'%;()&+\\]")

    def _validate_input(self, query_type: str, params: dict) -> str | None:
        """Geçersiz girdi varsa hata mesajı döner, geçerliyse None."""
        for field in ("origin", "destination", "location"):
            val = params.get(field, "")
            if not val:
                continue
            if len(val) > 64:
                return f"'{field}' çok uzun (max 64 karakter)"
            if self._UNSAFE_RE.search(val):
                return f"'{field}' geçersiz karakter içeriyor"

        for field in ("depart_date", "return_date", "checkin", "checkout",
                      "pickup_date", "dropoff_date", "date"):
            val = params.get(field, "")
            if not val:
                continue
            if not self._DATE_RE.match(val):
                return f"'{field}' geçersiz format (YYYY-MM-DD bekleniyor)"
            try:
                y, m, d = (int(x) for x in val.split("-"))
                if _date(y, m, d) < _date.today():
                    return f"'{field}' geçmiş bir tarih olamaz"
            except ValueError:
                return f"'{field}' geçersiz tarih"

        for field in ("adults", "children", "rooms"):
            val = params.get(field)
            if val is None:
                continue
            try:
                n = int(val)
                min_val = 1 if field == "adults" else 0
                if not (min_val <= n <= 9):
                    return f"'{field}' {min_val}-9 arasında olmalı"
            except (TypeError, ValueError):
                return f"'{field}' sayısal bir değer olmalı"

        return None

    _RATE_WINDOW  = 30   # saniye
    _RATE_MAX_REQ = 10   # pencere başına max istek

    def _check_rate_limit(self, user_id: str = "global") -> bool:
        """True → limit aşıldı. False → istek kabul edilebilir."""
        now = time.time()
        bucket = self._user_rate_limit.setdefault(user_id, deque())
        # Eski istekleri temizle
        while bucket and now - bucket[0] > self._RATE_WINDOW:
            bucket.popleft()
        if len(bucket) >= self._RATE_MAX_REQ:
            return True
        bucket.append(now)
        return False

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: search_all — AI entegrasyon metodu
    # ──────────────────────────────────────────────────────────────────────────

    def search_all(
        self,
        query_type: str,
        params:     dict[str, Any],
    ) -> APIResponse:
        """
        AI modülü için tek giriş noktası.
        query_type'a göre ilgili search metodunu çağırır.

        Args:
            query_type: "flights" | "hotels" | "rentals" | "cars" | "buses" | "all"
            params:     İlgili search metodunun parametreleri (dict olarak)

        Desteklenen query_type ve beklenen params:

            "flights" → {
                "origin":       str,   # IATA kodu veya şehir ismi
                "destination":  str,   # IATA kodu veya şehir ismi
                "depart_date":  str,   # YYYY-MM-DD
                "return_date":  str,   # opsiyonel
                "adults":       int,   # opsiyonel, default 1
                "children":     int,   # opsiyonel, default 0
                "travel_class": int,   # opsiyonel, default 1
                "stops":        int,   # opsiyonel, default 0
                "trip_type":    int,   # opsiyonel, default 1
            }

            "hotels" → {
                "location":     str,   # şehir ismi veya IATA kodu
                "checkin":      str,   # YYYY-MM-DD
                "checkout":     str,   # YYYY-MM-DD
                "adults":       int,   # opsiyonel, default 2
                "children":     int,   # opsiyonel, default 0
                "sort_by":      int,   # opsiyonel, default 3
                "min_price":    int,   # opsiyonel
                "max_price":    int,   # opsiyonel
                "min_rating":   int,   # opsiyonel
                "hotel_class":  int,   # opsiyonel
            }

            "rentals" → {
                "location":     str,   # şehir ismi veya IATA kodu
                "checkin":      str,   # YYYY-MM-DD
                "checkout":     str,   # YYYY-MM-DD
                "adults":       int,   # opsiyonel, default 2
                "children":     int,   # opsiyonel, default 0
                "min_price":    int,   # opsiyonel
                "max_price":    int,   # opsiyonel
                "min_beds":     int,   # opsiyonel
            }

            "cars" → {
                "location":     str,   # şehir ismi veya IATA kodu
                "pickup_date":  str,   # YYYY-MM-DD
                "dropoff_date": str,   # YYYY-MM-DD
                "pickup_time":  str,   # opsiyonel, default "10:00"
                "dropoff_time": str,   # opsiyonel, default "10:00"
            }

            "buses" → {
                "origin":       str,   # şehir ismi (örn: "İstanbul")
                "destination":  str,   # şehir ismi (örn: "Ankara")
                "date":         str,   # YYYY-MM-DD
            }

            "all" → Tüm kategoriler aynı anda çalışır (paralel).
                    params içinde hem uçuş hem otel hem otobüs
                    parametrelerini birlikte gönder:
                    {
                        "origin":       str,  # uçuş + otobüs kalkış
                        "destination":  str,  # uçuş + otobüs varış (şehir ismi veya IATA)
                        "depart_date":  str,  # YYYY-MM-DD
                        "return_date":  str,  # opsiyonel
                        "adults":       int,  # opsiyonel
                        "children":     int,  # opsiyonel
                        # otel/ev/araç için ayrıca:
                        "location":     str,  # opsiyonel, yoksa destination kullanılır
                        "checkin":      str,  # opsiyonel, yoksa depart_date kullanılır
                        "checkout":     str,  # opsiyonel, yoksa return_date kullanılır
                    }

        Returns:
            APIResponse — tek kategori için standart format.
                          "all" için data bir dict olur:
                          {
                              "flights": APIResponse,
                              "hotels":  APIResponse,
                              "rentals": APIResponse,
                              "cars":    APIResponse,
                              "buses":   APIResponse,
                          }
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        # Rate limit kontrolü (global — kullanıcı kimliği yoksa "global" anahtarı kullan)
        user_id = params.get("user_id", "global")
        if self._check_rate_limit(user_id):
            logger.warning(f"Rate limit aşıldı: user={self._sanitize_log(user_id)}")
            return self._err("search_all", "RATE_LIMIT_USER: Çok fazla istek, lütfen bekleyin.")

        # Input validation
        validation_error = self._validate_input(query_type, params)
        if validation_error:
            logger.warning(f"Geçersiz girdi: {validation_error}")
            return self._err("search_all", f"INVALID_INPUT: {validation_error}")

        query_type = query_type.strip().lower()

        # ── Tek kategori sorguları ────────────────────────────────────────────

        if query_type == "flights":
            missing = [k for k in ("origin", "destination", "depart_date") if k not in params]
            if missing:
                return self._err("google_flights", f"Eksik parametre: {', '.join(missing)}")
            return self.search_flights(
                origin       = self._to_iata(params["origin"]),
                destination  = self._to_iata(params["destination"]),
                depart_date  = params["depart_date"],
                return_date  = params.get("return_date", ""),
                adults       = params.get("adults", 1),
                children     = params.get("children", 0),
                travel_class = params.get("travel_class", 1),
                stops        = params.get("stops", 0),
                trip_type    = params.get("trip_type", 1),
            )

        if query_type == "hotels":
            missing = [k for k in ("location", "checkin", "checkout") if k not in params]
            if missing:
                return self._err("google_hotels", f"Eksik parametre: {', '.join(missing)}")
            return self.search_hotels(
                location    = self._to_city_name(params["location"]),
                checkin     = params["checkin"],
                checkout    = params["checkout"],
                adults      = params.get("adults", 2),
                children    = params.get("children", 0),
                sort_by     = params.get("sort_by", 3),
                min_price   = params.get("min_price", 0),
                max_price   = params.get("max_price", 0),
                min_rating  = params.get("min_rating", 0),
                hotel_class = params.get("hotel_class", 0),
            )

        if query_type == "rentals":
            missing = [k for k in ("location", "checkin", "checkout") if k not in params]
            if missing:
                return self._err("google_vacation_rentals", f"Eksik parametre: {', '.join(missing)}")
            return self.search_vacation_rentals(
                location  = self._to_city_name(params["location"]),
                checkin   = params["checkin"],
                checkout  = params["checkout"],
                adults    = params.get("adults", 2),
                children  = params.get("children", 0),
                min_price = params.get("min_price", 0),
                max_price = params.get("max_price", 0),
                min_beds  = params.get("min_beds", 0),
            )

        if query_type == "cars":
            missing = [k for k in ("location", "pickup_date", "dropoff_date") if k not in params]
            if missing:
                return self._err("google_cars_rental", f"Eksik parametre: {', '.join(missing)}")
            return self.search_car_rentals(
                location     = self._to_city_name(params["location"]),
                pickup_date  = params["pickup_date"],
                dropoff_date = params["dropoff_date"],
                pickup_time  = params.get("pickup_time", "10:00"),
                dropoff_time = params.get("dropoff_time", "10:00"),
            )

        if query_type == "buses":
            missing = [k for k in ("origin", "destination", "date") if k not in params]
            if missing:
                return self._err("buses", f"Eksik parametre: {', '.join(missing)}")
            return self.search_buses(
                origin      = self._to_city_name(params["origin"]),
                destination = self._to_city_name(params["destination"]),
                date        = params["date"],
            )

        # ── Tüm kategoriler (paralel) ─────────────────────────────────────────

        if query_type == "all":
            # Ortak parametreleri çöz
            destination  = params.get("destination", "")
            origin       = params.get("origin", "")
            depart_date  = params.get("depart_date", "")
            return_date  = params.get("return_date", "")
            location     = params.get("location", destination)
            checkin      = params.get("checkin",  depart_date)
            checkout     = params.get("checkout", return_date)
            pickup_date  = params.get("pickup_date",  depart_date)
            dropoff_date = params.get("dropoff_date", return_date)
            bus_date     = params.get("date", depart_date)
            adults       = params.get("adults", 2)
            children     = params.get("children", 0)

            # Boş kritik parametre uyarısı (crash değil, log)
            if not destination:
                logger.warning("search_all 'all': 'destination' parametresi boş.")
            if not depart_date:
                logger.warning("search_all 'all': 'depart_date' parametresi boş.")

            # Her kategori için çağrılacak fonksiyon ve argümanlar
            tasks = {
                "flights": lambda: self.search_flights(
                    origin       = self._to_iata(origin),
                    destination  = self._to_iata(destination),
                    depart_date  = depart_date,
                    return_date  = return_date,
                    adults       = adults,
                    children     = children,
                ),
                "hotels": lambda: self.search_hotels(
                    location  = self._to_city_name(location),
                    checkin   = checkin,
                    checkout  = checkout,
                    adults    = adults,
                    children  = children,
                ),
                "rentals": lambda: self.search_vacation_rentals(
                    location  = self._to_city_name(location),
                    checkin   = checkin,
                    checkout  = checkout,
                    adults    = adults,
                    children  = children,
                ),
                "cars": lambda: self.search_car_rentals(
                    location     = self._to_city_name(location),
                    pickup_date  = pickup_date,
                    dropoff_date = dropoff_date,
                ),
                "buses": lambda: self.search_buses(
                    origin      = self._to_city_name(origin),
                    destination = self._to_city_name(destination),
                    date        = bus_date,
                ),
            }

            results: dict[str, APIResponse] = {}

            # ThreadPoolExecutor ile 5 sorgu paralel çalışır
            with ThreadPoolExecutor(max_workers=5) as executor:
                future_to_key = {
                    executor.submit(fn): key
                    for key, fn in tasks.items()
                }
                for future in as_completed(future_to_key):
                    key = future_to_key[future]
                    try:
                        results[key] = future.result()
                    except Exception as e:
                        logger.error(f"search_all '{key}' thread hatası: {e}")
                        results[key] = self._err(key, str(e))

            total_count = sum(r["count"] for r in results.values())
            any_ok      = any(r["ok"] for r in results.values())

            return APIResponse(
                ok=any_ok,
                source="all",
                count=total_count,
                data=results,
                error="" if any_ok else "Tüm kaynaklar hata döndürdü",
            )

        # ── Geçersiz query_type ───────────────────────────────────────────────

        valid = ("flights", "hotels", "rentals", "cars", "buses", "all")
        return self._err(
            "search_all",
            f"Geçersiz query_type: '{query_type}'. Geçerli seçenekler: {valid}"
        )


# ──────────────────────────────────────────────────────────────────────────────
# TEST BLOĞU
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    api = TravelSearchAPI()

    def print_result(label: str, result: APIResponse) -> None:
        print(f"\n{'='*60}")
        print(f"TEST: {label}")
        print(f"{'='*60}")
        print(f"ok: {result['ok']} | count: {result['count']} | error: {result['error']}")
        if result["ok"] and result["data"]:
            # "all" durumunda data dict of APIResponse olur
            if isinstance(result["data"], dict):
                for category, cat_result in result["data"].items():
                    print(f"  [{category}] ok:{cat_result['ok']} count:{cat_result['count']}")
            else:
                first = result["data"][0]
                print("İlk sonuç:", json.dumps(first, indent=2, ensure_ascii=False))

    # Test 1: Uçak (IATA kodu ile)
    print_result("Uçak — IST → AMS", api.search_all("flights", {
        "origin":      "IST",
        "destination": "AMS",
        "depart_date": "2026-06-01",
        "return_date": "2026-06-10",
        "adults":      2,
    }))
    time.sleep(3) 

    # Test 2: Uçak (şehir ismi ile — _to_iata devreye girer)
    print_result("Uçak — İstanbul → Amsterdam (şehir ismi)", api.search_all("flights", {
        "origin":      "İstanbul",
        "destination": "Amsterdam",
        "depart_date": "2026-06-01",
    }))
    time.sleep(3) 

    # Test 3: Otel
    print_result("Otel — Amsterdam", api.search_all("hotels", {
        "location": "Amsterdam",
        "checkin":  "2026-06-01",
        "checkout": "2026-06-10",
        "adults":   2,
    }))

    # Test 4: Otobüs
    print_result("Otobüs — Paris → Berlin", api.search_all("buses", {
        "origin":      "Paris",
        "destination": "Berlin",
        "date":        "2026-06-01",
    }))

    # Test 5: ALL (paralel)
    print_result("ALL — İstanbul → Amsterdam", api.search_all("all", {
        "origin":      "İstanbul",
        "destination": "Amsterdam",
        "depart_date": "2026-06-01",
        "return_date": "2026-06-10",
        "adults":      2,
    }))

    # Test 6: Eksik parametre kontrolü
    print_result("Eksik parametre", api.search_all("flights", {
        "origin": "IST",
    }))

    # Test 7: Geçersiz query_type
    print_result("Geçersiz query_type", api.search_all("tren", {}))