from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    app_name: str = "makan"
    debug: bool = False
    api_v1_prefix: str = ""

    # --- Database ---
    database_url: str = "postgresql+asyncpg://makan:makan@localhost:5433/makan"
    db_echo: bool = False

    # --- Auth ---
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h

    # --- Google Sign-In ---
    google_client_id: str = ""
    # Comma-separated emails granted admin on Google sign-in.
    admin_emails: str = ""

    # --- Email verification (SMTP; optional) ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Makan <no-reply@makan.jo>"
    smtp_starttls: bool = True
    verify_code_ttl_minutes: int = 15
    # When SMTP is not configured (dev), return the code in the API response so
    # sign-up can be tested without an email server. Never enable in production.
    expose_verify_code_in_dev: bool = True

    # --- CORS ---
    cors_origins: str = "http://localhost:3000"
    # Allow localhost and private-LAN origins on any port by default so the app
    # works from other devices (phones/tablets) on the same network in dev.
    cors_origin_regex: str = (
        r"https?://(localhost|127\.0\.0\.1|"
        r"192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?"
    )

    # --- LLM (DeepSeek is OpenAI-compatible) ---
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_chat_model: str = "deepseek-chat"
    llm_timeout_seconds: float = 60.0

    # --- Embeddings ---
    # provider: "openai_compatible" (any OpenAI-compatible /embeddings endpoint)
    #           or "local" (deterministic hash-based vectors — dev/test only, no API needed)
    embedding_provider: str = "local"
    embedding_api_key: str = ""
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    embedding_batch_size: int = 64

    # --- Knowledge file storage (local dir; swap for S3 in prod) ---
    knowledge_dir: str = "./data/knowledge"

    # --- Place photo storage (local dir served at /media; Cloudinary if set) ---
    media_dir: str = "./data/media"

    # --- Cloudinary (images/videos) ---
    cloudinary_url: str = ""  # cloudinary://key:secret@cloud_name

    # --- Rate limiting ---
    ai_rate_limit: str = "10/minute"

    # --- RAG tuning ---
    rag_top_k_chunks: int = 8
    rag_max_places: int = 5
    rag_default_radius_km: float = 25.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)


@lru_cache
def get_settings() -> Settings:
    return Settings()
