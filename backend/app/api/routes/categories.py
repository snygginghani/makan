from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import Category
from app.schemas import CategoryOut

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)) -> list[CategoryOut]:
    """Public: category list for map filters and forms."""
    rows = (await db.scalars(select(Category).order_by(Category.id))).all()
    return [CategoryOut.model_validate(c) for c in rows]
