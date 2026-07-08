from starlette.requests import Request


def client_ip(request: Request) -> str:
    """Best-effort client IP.

    In production the app sits behind Caddy, which sets X-Forwarded-For; the
    left-most entry is the original client. Falls back to the socket peer for
    direct (dev) connections.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else ""
