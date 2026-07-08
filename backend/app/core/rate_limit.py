from slowapi import Limiter

from app.core.net import client_ip

# Key by the real client IP (honours X-Forwarded-For behind the Caddy proxy),
# so limits/bans apply per user rather than per proxy socket.
limiter = Limiter(key_func=lambda request: client_ip(request) or "anon")
