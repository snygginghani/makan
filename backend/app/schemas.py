from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ---------------------------------------------------------------- auth


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthIn(BaseModel):
    """The ID token (JWT credential) returned by Google Identity Services."""

    credential: str = Field(min_length=10)


class VerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)


class ResendIn(BaseModel):
    email: EmailStr


class RegisterOut(BaseModel):
    """After sign-up: the account exists but must verify the emailed code."""

    email: EmailStr
    verification_required: bool = True
    # only present in dev when SMTP isn't configured, so the flow is testable
    dev_code: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: str
    picture: str | None = None
    username: str | None = None
    home_region: str | None = None
    bio: str | None = None
    onboarded: bool = False
    points: int = 0


class OnboardingIn(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.]+$")
    home_region: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=300)


class LeaderboardEntry(BaseModel):
    rank: int
    id: int
    name: str
    username: str | None
    picture: str | None
    points: int
    is_me: bool = False


class UserStats(BaseModel):
    points: int
    rank: int
    total_contributors: int
    reviews_count: int
    favorites_count: int
    submissions_count: int
    approved_count: int


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    username: str | None
    picture: str | None
    role: str
    points: int
    home_region: str | None
    bio: str | None
    onboarded: bool
    banned: bool
    last_ip: str | None
    last_lat: float | None
    last_lng: float | None
    location_at: datetime | None
    created_at: datetime


class LocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class RoleUpdateIn(BaseModel):
    role: Literal["user", "admin"]


# ---------------------------------------------------------------- bans


class BanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ban_type: Literal["email", "ip"]
    value: str
    reason: str | None
    created_at: datetime


class BanCreateIn(BaseModel):
    ban_type: Literal["email", "ip"]
    value: str = Field(min_length=1, max_length=255)
    reason: str | None = Field(default=None, max_length=500)


class UserBanIn(BaseModel):
    # also block the account's last-known IP address, not just the email
    include_ip: bool = False
    reason: str | None = Field(default=None, max_length=500)


class GeoResolveOut(BaseModel):
    lat: float
    lng: float


class GeoSearchResult(BaseModel):
    name: str          # primary label (place name)
    label: str         # secondary line (city, state, country)
    lat: float
    lng: float


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------- places
# NOTE: category slugs are validated against the categories table in the
# routes (admins manage categories dynamically), not against a fixed set.


class PlaceBase(BaseModel):
    name_ar: str = Field(min_length=1, max_length=200)
    name_en: str = Field(min_length=1, max_length=200)
    description: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    coords_verified: bool = False
    category: str = Field(min_length=1, max_length=60)
    tags: list[str] = []
    region: str | None = None
    images: list[str] = []

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, v: list[str]) -> list[str]:
        return [t.strip()[:50] for t in v if t.strip()][:20]


class PlaceCreate(PlaceBase):
    approved: bool = True  # admin-created places are live immediately


class PlaceUpdate(BaseModel):
    name_ar: str | None = None
    name_en: str | None = None
    description: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    coords_verified: bool | None = None
    category: str | None = None
    tags: list[str] | None = None
    region: str | None = None
    images: list[str] | None = None
    approved: bool | None = None


class PlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_ar: str
    name_en: str
    description: str | None
    lat: float | None
    lng: float | None
    coords_verified: bool
    category: str
    tags: list[str]
    region: str | None
    rating: float
    rating_count: int
    images: list[str]
    approved: bool
    created_at: datetime


class QAPair(BaseModel):
    q: str
    a: str


class PlaceDetailOut(PlaceOut):
    qa: list[QAPair] = []
    is_favorite: bool = False


class PageOut(BaseModel):
    items: list[PlaceOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------- knowledge


class KnowledgeQA(BaseModel):
    q: str = Field(min_length=1, max_length=2000)
    a: str = Field(min_length=1, max_length=8000)


class KnowledgeLocation(BaseModel):
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class KnowledgeFile(BaseModel):
    """Schema of the admin-uploaded knowledge JSON document."""

    place_id: int | str | None = None
    name: str | None = None
    category: str | None = None
    location: KnowledgeLocation | None = None
    qa: list[KnowledgeQA] = Field(min_length=1, max_length=500)
    tags: list[str] = []


class KnowledgeOut(BaseModel):
    place_id: int
    chunk_count: int
    indexed_at: datetime | None
    status: str = "indexed"


# ---------------------------------------------------------------- AI / RAG


class AIFilters(BaseModel):
    category: str | None = None
    tags: list[str] | None = None
    radius_km: float | None = Field(default=None, gt=0, le=500)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class AIQueryIn(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    filters: AIFilters | None = None
    # recent conversation so the assistant can remember answers to its
    # pre-questions (car? nearby? vibe?) and build a coherent plan.
    history: list[ChatTurn] = Field(default_factory=list)


class AIPlaceRef(BaseModel):
    id: int
    name: str
    reason: str = ""
    distance_km: float | None = None
    lat: float | None = None
    lng: float | None = None
    category: str | None = None


class AIQueryOut(BaseModel):
    answer: str
    places: list[AIPlaceRef] = []
    map_highlight_ids: list[int] = []
    sources: list[int] = []  # chunk ids used as context (transparency/debug)
    # Itinerary/hangout planning
    is_plan: bool = False
    route_url: str | None = None  # Google Maps directions chaining the stops
    suggestions: list[str] = []  # quick-reply chips (e.g. answers to a pre-question)


# ---------------------------------------------------------------- reviews


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class ReviewOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    rating: int
    comment: str | None
    created_at: datetime
    is_mine: bool = False


class ReviewsPage(BaseModel):
    items: list[ReviewOut]
    total: int
    average: float


# ---------------------------------------------------------------- submissions / reports


class SubmissionCreate(BaseModel):
    place_json: PlaceBase

    @field_validator("place_json")
    @classmethod
    def require_photo(cls, v: PlaceBase) -> PlaceBase:
        if not v.images:
            raise ValueError("صورة واحدة على الأقل مطلوبة لاقتراح مكان / at least one photo is required")
        return v


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    place_json: dict[str, Any]
    status: str
    review_note: str | None
    created_at: datetime
    reviewed_at: datetime | None


class SubmissionReviewIn(BaseModel):
    action: Literal["approve", "reject"]
    note: str | None = None


class ReportCreate(BaseModel):
    place_id: int
    reason: str = Field(min_length=3, max_length=2000)


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    place_id: int
    reason: str
    resolved: bool
    created_at: datetime


# ---------------------------------------------------------------- categories / analytics


class CategoryIn(BaseModel):
    slug: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9_]+$")
    name_ar: str = Field(min_length=1, max_length=120)
    name_en: str = Field(min_length=1, max_length=120)
    icon: str | None = None
    color: str | None = Field(default=None, max_length=20)


class CategoryOut(CategoryIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class AnalyticsOut(BaseModel):
    total_places: int
    approved_places: int
    total_users: int
    pending_submissions: int
    indexed_places: int
    total_chunks: int
    open_reports: int
    places_by_category: dict[str, int]
