"""Works out the real visitor IP, so the rate limit counts each visitor separately.

On Render every request arrives through Cloudflare + Render's own proxy, so the socket address is
always a proxy, never the visitor. Cloudflare puts the real visitor IP in `CF-Connecting-IP`
(and overwrites it if a visitor tries to fake it), so that is the header we trust.

We deliberately do NOT trust the first `X-Forwarded-For` entry: Render only appends to that header,
so a visitor could send their own and dodge the limit.
"""

# Checked in this order; the first one that holds a value wins.
TRUSTED_IP_HEADERS = ("cf-connecting-ip", "true-client-ip")


def client_ip(request) -> str:
    for name in TRUSTED_IP_HEADERS:
        value = request.headers.get(name, "").strip()
        if value:
            return value
    # Running locally (no proxy): the socket address is the visitor.
    return request.client.host if request.client else "unknown"
