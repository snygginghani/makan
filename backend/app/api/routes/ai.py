from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.schemas import AIQueryIn, AIQueryOut
from app.services.rag import rag_query

settings = get_settings()
router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/query", response_model=AIQueryOut)
@limiter.limit(settings.ai_rate_limit)
async def ai_query(
    request: Request,  # required by slowapi
    payload: AIQueryIn,
    db: AsyncSession = Depends(get_db),
) -> AIQueryOut:
    """RAG-powered place intelligence: retrieves knowledge chunks from pgvector,
    applies geo/metadata filters, and asks the LLM for a grounded, structured answer."""
    return await rag_query(db, payload)
