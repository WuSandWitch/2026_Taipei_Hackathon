"""
Thin TDX client: OAuth2 client-credentials token + cached OData GETs.

Verified against the live OpenAPI spec of 公共運輸-公車 (2026/11/07):
  https://tdx.transportdata.tw/webapi/File/Swagger/V3/2998e851-81d0-40f5-b26d-77e2f5ac4118
Base URL, token URL and the City enum all come from that document; see README
for the endpoints and field names we rely on.
"""
import asyncio
import time

import httpx

from app import config
from app.cache import cache


class TdxError(RuntimeError):
    """Upstream TDX failure, or missing credentials."""


class TdxClient:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._token: str | None = None
        self._token_expires_at: float = 0.0
        self._token_lock = asyncio.Lock()

    # --- lifecycle -------------------------------------------------------
    async def start(self) -> None:
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=8.0),
            headers={"accept-encoding": "gzip"},
            follow_redirects=True,
        )

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    @property
    def configured(self) -> bool:
        return bool(config.TDX_CLIENT_ID and config.TDX_CLIENT_SECRET)

    # --- auth ------------------------------------------------------------
    async def _access_token(self) -> str:
        if not self.configured:
            raise TdxError(
                "TDX_CLIENT_ID / TDX_CLIENT_SECRET 未設定。請到 TDX 會員專區取得服務金鑰，"
                "填進 backend/.env（參考 .env.example）。"
            )
        if self._token and time.monotonic() < self._token_expires_at:
            return self._token

        async with self._token_lock:
            if self._token and time.monotonic() < self._token_expires_at:
                return self._token
            assert self._client is not None
            try:
                res = await self._client.post(
                    config.TDX_TOKEN_URL,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": config.TDX_CLIENT_ID,
                        "client_secret": config.TDX_CLIENT_SECRET,
                    },
                    headers={"content-type": "application/x-www-form-urlencoded"},
                )
            except httpx.HTTPError as exc:
                raise TdxError(f"無法連線 TDX 取得 token：{exc}") from exc
            if res.status_code != 200:
                raise TdxError(f"TDX token 失敗（{res.status_code}）：{res.text[:200]}")
            payload = res.json()
            token = payload.get("access_token")
            if not token:
                raise TdxError("TDX token 回應沒有 access_token")
            # Tokens last 86400 s; refresh a minute early.
            self._token = token
            self._token_expires_at = time.monotonic() + max(60, int(payload.get("expires_in", 86400)) - 60)
            return token

    # --- requests --------------------------------------------------------
    async def get(self, path: str, params: dict[str, str] | None = None) -> list | dict:
        """GET an API path such as `/v2/Bus/Station/City/Taipei`."""
        assert self._client is not None, "TdxClient.start() was not awaited"
        query = {"$format": "JSON", **(params or {})}
        token = await self._access_token()
        url = config.TDX_API_BASE + path

        try:
            res = await self._client.get(url, params=query, headers={"authorization": f"Bearer {token}"})
            if res.status_code == 401:
                # Token revoked or rotated; drop it and retry once.
                self._token = None
                token = await self._access_token()
                res = await self._client.get(url, params=query, headers={"authorization": f"Bearer {token}"})
        except httpx.HTTPError as exc:
            raise TdxError(f"TDX 連線失敗（{path}）：{exc}") from exc

        if res.status_code == 429:
            # TDX throttles at 50 requests/sec per source IP, shared across every
            # API key, so a burst can be rejected even when we are well behaved.
            # One short backoff clears it; anything worse is reported upstream and
            # the cache serves its stale copy.
            await asyncio.sleep(1.5)
            try:
                res = await self._client.get(
                    url, params=query, headers={"authorization": f"Bearer {token}"}
                )
            except httpx.HTTPError as exc:
                raise TdxError(f"TDX 連線失敗（{path}）：{exc}") from exc
            if res.status_code == 429:
                raise TdxError("TDX 回報流量超限（429），請稍後再試")
        if res.status_code != 200:
            raise TdxError(f"TDX {path} 回應 {res.status_code}：{res.text[:200]}")
        return res.json()

    async def get_cached(
        self, key: str, path: str, params: dict[str, str] | None = None, *, ttl: float
    ) -> list | dict:
        return await cache.get(key, ttl, lambda: self.get(path, params))


tdx = TdxClient()


def odata_str(value: str) -> str:
    """Quote a string for an OData $filter ('' escapes a single quote)."""
    return "'" + value.replace("'", "''") + "'"
