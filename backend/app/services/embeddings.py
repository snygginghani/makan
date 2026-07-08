"""Embedding generation with two providers:

- "openai_compatible": any OpenAI-compatible /embeddings endpoint (OpenAI,
  or a DeepSeek-compatible provider). Configure base_url/model/key in env.
- "local": deterministic feature-hashing embeddings (bag-of-words + character
  n-grams hashed into the vector space). No network or API key needed —
  intended for development and tests. Overlapping words between query and
  QA text still produce meaningful cosine similarity, so the RAG pipeline
  behaves sensibly end-to-end even offline.
"""

import hashlib
import math
import re

from openai import AsyncOpenAI

from app.core.config import get_settings

settings = get_settings()

_WORD_RE = re.compile(r"[\w؀-ۿ]+", re.UNICODE)

# Arabic normalization: unify alef/teh-marbuta/yeh variants and strip tashkeel
_AR_DIACRITICS = re.compile(r"[ً-ٰٟ]")
_AR_MAP = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه", "ى": "ي", "ٱ": "ا"})


def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = _AR_DIACRITICS.sub("", text)
    return text.translate(_AR_MAP)


def _tokens(text: str) -> list[str]:
    text = normalize_text(text)
    words = _WORD_RE.findall(text)
    grams: list[str] = list(words)
    for w in words:
        if len(w) >= 4:  # char trigrams help partial Arabic word matches
            grams.extend(w[i : i + 3] for i in range(len(w) - 2))
    return grams


def _local_embedding(text: str, dim: int) -> list[float]:
    vec = [0.0] * dim
    for tok in _tokens(text):
        digest = hashlib.md5(tok.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0:
        vec[0] = 1.0
        return vec
    return [v / norm for v in vec]


class EmbeddingService:
    def __init__(self) -> None:
        self.provider = settings.embedding_provider
        self.dim = settings.embedding_dim
        self._client: AsyncOpenAI | None = None
        if self.provider == "openai_compatible":
            self._client = AsyncOpenAI(
                api_key=settings.embedding_api_key,
                base_url=settings.embedding_base_url,
            )

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if self.provider == "local" or self._client is None:
            return [_local_embedding(t, self.dim) for t in texts]

        results: list[list[float]] = []
        batch_size = settings.embedding_batch_size
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            # encoding_format must be explicit: the SDK defaults to base64,
            # which OpenRouter's embeddings endpoint does not support.
            kwargs: dict = {
                "model": settings.embedding_model,
                "input": batch,
                "encoding_format": "float",
            }
            # OpenAI v3 and Gemini embedding models support MRL truncation
            if ("text-embedding-3" in settings.embedding_model
                    or "gemini-embedding" in settings.embedding_model):
                kwargs["dimensions"] = self.dim
            response = await self._client.embeddings.create(**kwargs)
            results.extend(item.embedding for item in response.data)
        return results

    async def embed_text(self, text: str) -> list[float]:
        return (await self.embed_texts([text]))[0]


embedding_service = EmbeddingService()
