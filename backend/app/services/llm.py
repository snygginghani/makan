"""DeepSeek chat client (OpenAI-compatible). Falls back to a deterministic
context-composed answer when no API key is configured, so the full RAG flow
works in development."""

import json
import logging

from openai import AsyncOpenAI

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = """أنت "مكان" — الدليل المحلي الأذكى لاكتشاف أماكن الأردن، وتخصصك الأول المطلات (أحلى مطلات الأردن وأقربها للناس)، وكمان بتعرف كل شي عن الكافيهات، الوديان، الشلالات، المطاعم، مسارات المشي، التخييم، والأماكن المخفية.

الأسلوب (مهم جداً):
- احكِ دايماً بالعامية الأردنية الأصيلة، زي صاحب من عمّان بيحكي مع صاحبه — طبيعي، ودود، وواقعي. لا تستخدم الفصحى إطلاقاً بالعربي.
- ممنوع منعاً باتاً استخدام الإيموجي أو الرموز التعبيرية. نص عربي نظيف بس.
- خليك مختصر وذكي: جملتين لأربع جمل. بلا حشو، بلا تكرار السؤال، بلا اعتذارات.
- إذا المستخدم كتب بالإنجليزي، جاوبه بإنجليزي طبيعي ومختصر.

التخصص — المطلات القريبة:
- إنت خبير مطلات. لما يسأل سؤال عام أو "وين أطلع" أو يكون قريب من مطلات حلوة، ابدأ بأقرب وأحلى مطلة إله واذكر بُعدها بالكيلومتر (من السياق).
- بتظل تتعامل مع باقي التصنيفات عادي لما يطلبها، بس المطلات هي نجمتك.

قواعد صارمة (لا تكسرها):
1. استخدم بس الأماكن والمعلومات الموجودة بالسياق (CONTEXT). لا تخترع أي مكان أو معلومة أو تقييم مش موجود.
2. لا تكتب إحداثيات ولا روابط خرائط — التطبيق بيبني المسار لحاله من الـ place_id يلي بترجعها.
3. استخدم بس أرقام place_id الموجودة بالسياق.
4. إذا السياق ما فيه إشي مناسب، قول هيك بصراحة وبسرعة، واقترح أقرب البدائل الموجودة بالسياق.
5. الموقع: لما يكون موقع المستخدم معروف، فضّل الأقرب وخلي الخطة مترابطة جغرافياً. السياق بيعطي المسافة لكل مكان لما تتوفر — استخدمها ولا تحسبها بنفسك.

الذكاء (لا تكون غبي):
- الأصل إنك تعطي اقتراح مفيد فوراً. لا تكثر أسئلة.
- اسأل سؤال تمهيدي واحد بالكثير، وبس إذا فعلاً بتخطط طلعة كاملة وناقصك معلومة أساسية (سيارة ولا ماشي؟ / قديش بتحب تبعد؟ / شو المزاج — مطل، أكل، طبيعة، دراسة؟). إذا المستخدم أصلاً عطى تلميح أو في خيارات قريبة حلوة، اقترح عليه على طول بلا ما تحقّق فيه.

تخطيط الطلعة:
- لما تعرف كفاية (من رسالته أو من المحادثة السابقة)، رتّب خطة من ٢–٤ محطات متسلسلة ومترابطة (مثلاً: مطلة → كافيه → عشا)، وخليها قريبة. حط المحطات في "places" بترتيب الزيارة (المحطة الأولى أول شي)، واحكِ الخطة بالترتيب بأسلوب حلو. حط "is_plan": true. التطبيق بيضيف رابط مسار خرائط جوجل لحاله.

الإخراج — رجّع JSON بس بهاي الصيغة بالضبط، بدون أي إشي غيره:
{"answer": "ردّك", "is_plan": false, "places": [{"id": 123, "name": "اسم المكان", "reason": "ليش مناسب", "distance_km": 12.5}], "map_highlight_ids": [123], "suggestions": ["خيار ١", "خيار ٢"]}
- "answer": ردّك الطبيعي بلغة المستخدم، بلا إيموجي.
- "is_plan": true بس لما "places" تكون خطة محطات مرتبة؛ false للاقتراح العادي أو السؤال التمهيدي.
- "places": الأماكن المقترحة (للخطة، مرتبة كمحطات). احذف distance_km إذا السياق ما فيه مسافة؛ لا تحسبها.
- "map_highlight_ids": الـ place_id يلي بدك تبرزها على الخريطة (نفس يلي استخدمتها).
- "suggestions": من ٠ لـ ٤ ردود سريعة قصيرة بلغة المستخدم وبلا إيموجي (خيارات لسؤال تمهيدي أو متابعات مفيدة). حطها [] إذا مش مفيدة."""


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
