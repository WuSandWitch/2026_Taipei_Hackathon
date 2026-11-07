"""Settings, all from environment variables (see .env.example)."""
import os

from dotenv import load_dotenv

load_dotenv()


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "") or default)
    except ValueError:
        return default


# --- TDX credentials (https://tdx.transportdata.tw 會員專區 › 服務金鑰) ---
TDX_CLIENT_ID = os.getenv("TDX_CLIENT_ID", "").strip()
TDX_CLIENT_SECRET = os.getenv("TDX_CLIENT_SECRET", "").strip()

TDX_TOKEN_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"
TDX_API_BASE = "https://tdx.transportdata.tw/api/basic"

# One of the City values the Bus API accepts; see README.
CITY = os.getenv("TDX_CITY", "Taipei").strip() or "Taipei"

# Cloud Run supplies PORT.
PORT = _int("PORT", 8080)

# Comma-separated list of frontend origins, or "*" during development.
# An empty value falls back to "*" rather than to an empty list: a blank setting
# would otherwise block every browser request with no hint as to why, and a
# frontend that cannot call the backend is a worse failure than a permissive
# default on a read-only public-data API.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()] or ["*"]

# --- Cache lifetimes (seconds) ---
# Realtime feeds (N1/A1/A2) are refreshed by TDX about once a minute. One cached
# copy is shared by every phone so we never hammer TDX per client.
TTL_REALTIME = _int("TTL_REALTIME", 15)
# Timetable-ish data changes at most daily.
TTL_STATIC = _int("TTL_STATIC", 12 * 60 * 60)

# --- Tuning ---
# How close the user has to be to a bus to count as "on board".
BOARD_RADIUS_M = _int("BOARD_RADIUS_M", 60)
# A bus this much closer than the target one means the user likely boarded it.
WRONG_BUS_MARGIN_M = _int("WRONG_BUS_MARGIN_M", 30)
# An A2 enter/leave event older than this is ignored.
A2_EVENT_FRESH_SEC = _int("A2_EVENT_FRESH_SEC", 90)
# "Another bus is pulling in right now" threshold for the not-your-bus warning.
OTHER_ARRIVING_SEC = _int("OTHER_ARRIVING_SEC", 60)
