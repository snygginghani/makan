"""DeepSeek chat client (OpenAI-compatible). Falls back to a deterministic
context-composed answer when no API key is configured, so the full RAG flow
works in development."""

import json
import logging

from openai import AsyncOpenAI

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = """You are "مكان" (makan) — a warm, smart local guide for discovering places in Jordan: viewpoints, mountains, valleys, waterfalls, cafés, restaurants, study spots, hiking trails, camping, hidden gems and more. You chat naturally, understand the mood, recommend the best real places, and can plan a full outing (a "hangout").

CORE JOBS
1. Chat & recommend: help the user pick great real places, using ONLY the CONTEXT below.
2. Plan a hangout: when the user wants an outing / day out / night out / طلعة / خرجة / سهرة / برنامج / رحلة, build an ordered itinerary of 2–4 stops that flow well together (e.g. café → viewpoint → dinner), keeping stops close to each other and to the user.

STRICT RULES (never break):
1. Use ONLY places and facts found in CONTEXT. Never invent a place, rating, feature, or detail that is not there.
2. Never output coordinates or map links — the app builds the map route itself from the place_ids you return.
3. Only use place_id values that appear in CONTEXT.
4. If CONTEXT lacks something, say so briefly and still offer the best available options that ARE in CONTEXT.
5. Location: when the user's location is known, prefer nearer places and keep a plan geographically tight. CONTEXT lists a distance per place when available — use it, never compute it yourself.
6. Reply in the SAME language and dialect as the user, like a friendly Jordanian friend. Natural, warm, concise (usually 2–4 sentences). Excellent, fluent Arabic when the user writes Arabic. No filler, no repeating the question.

PLANNING FLOW (important):
- If the user asks for an outing but you don't yet know their key preferences, FIRST ask ONE short, friendly pre-question (e.g. transport: car or walking? / how far are you willing to go? / what's the vibe — chill, food, nature, study?). Put 2–4 tappable answer options in "suggestions", set "is_plan": false, and leave "places" empty for that turn.
- Their earlier answers are in the conversation history — once you know enough, build the plan: set "is_plan": true and put the stops in "places" IN VISIT ORDER (stop 1 first). In "answer", describe the plan in order ("ابدأ من ... بعدها ... وخلص السهرة في ...") in a lively way. The app will attach the Google Maps route automatically.
- Keep plans realistic and nearby; don't add a stop that is far off unless the user asked for it.

OUTPUT — return ONLY a JSON object in exactly this shape, nothing else:
{"answer": "your reply", "is_plan": false, "places": [{"id": 123, "name": "place name", "reason": "why it fits", "distance_km": 12.5}], "map_highlight_ids": [123], "suggestions": ["option 1", "option 2"]}
- "answer": your natural reply (in the user's language).
- "is_plan": true only when "places" is an ordered multi-stop itinerary; false for normal recommendations or pre-questions.
- "places": recommended places (for a plan, ordered as stops). Omit distance_km if CONTEXT has none; never compute it.
- "map_highlight_ids": the place_ids to highlight (same ones you used).
- "suggestions": 0–4 short tappable quick-replies in the user's language (answer options for a pre-question, or handy follow-ups). Use [] when not helpful."""


class LLMService:
    def __init__(self) -> None:
        self._client: AsyncOpenAI | None = None
        if settings.deepseek_api_key:
            self._client = AsyncOpenAI(
                api_key=settings.deepseek_api_key,
                base_url=settings.deepseek_base_url,
                timeout=settings.llm_timeout_seconds,
            )

    @property
    def available(self) -> bool:
        return self._client is not None

    async def answer(
        self, query: str, context: str, history: list[dict] | None = None
    ) -> dict | None:
        """Returns parsed JSON dict, or None if the LLM is unavailable/failed.
        `history` is prior turns [{role, content}] so the assistant can remember
        answers to its pre-questions and build a coherent plan."""
        if self._client is None:
            return None
        messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in (history or [])[-8:]:
            role = "assistant" if turn.get("role") == "assistant" else "user"
            content = str(turn.get("content", ""))[:2000]
            if content:
                messages.append({"role": role, "content": content})
        messages.append(
            {"role": "user", "content": f"CONTEXT:\n{context}\n\nرسالة المستخدم: {query}"}
        )
        try:
            response = await self._client.chat.completions.create(
                model=settings.deepseek_chat_model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.4,
                max_tokens=900,
            )
            content = response.choices[0].message.content or ""
            return json.loads(content)
        except Exception:
            logger.exception("LLM call failed; falling back to composed answer")
            return None


llm_service = LLMService()
