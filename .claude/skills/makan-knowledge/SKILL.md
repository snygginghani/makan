---
name: makan-knowledge
description: Generate a makan knowledge JSON file for a place (RAG knowledge base). Use when the user asks to create, write, or update a knowledge file / ملف معرفة for a place on the makan map. Produces bilingual (Arabic + English) QA pairs — 3 Arabic + 3 English QA pairs per fact — in the exact schema the makan admin upload endpoint accepts.
---

# makan Knowledge File Generator

You generate the JSON knowledge file that powers makan's RAG assistant for ONE place.
The admin uploads this file in لوحة الإدارة → الأماكن → رفع ملف معرفة JSON
(`POST /admin/knowledge/upload-json?place_id=…` — admin only). The backend chunks
each QA pair, embeds it with **google/gemini-embedding-2** (via OpenRouter,
1536-dim) into pgvector, and **deepseek/deepseek-v4-flash** answers user
questions strictly from these chunks. Quality of retrieval = quality of this file.

## Exact output schema (nothing else is accepted)

```json
{
  "place_id": 123,
  "name": "مطل عجلون",
  "category": "viewpoint",
  "location": { "lat": 32.333, "lng": 35.751 },
  "qa": [
    { "q": "سؤال؟", "a": "جواب مفصل." },
    { "q": "Question?", "a": "Detailed answer." }
  ],
  "tags": ["غروب", "تصوير", "sunset", "photography"]
}
```

Rules:
- `qa` is a flat array of `{q, a}` objects only — no language field, no nesting.
- `place_id` optional if the admin passes it as a query param, but include it when known.
- 1–500 QA pairs; file must stay under 2 MB; UTF-8 (BOM tolerated).
- `tags`: mix Arabic and English keywords users would actually search.

## The 3×2 rule (core requirement)

For **every single piece of information** (each distinct fact about the place),
write **3 Arabic QA pairs + 3 English QA pairs** — six total. The three phrasings
per language must ask about the same fact in genuinely different ways (different
vocabulary, formality, angle), because retrieval matches user wording:

Fact: "أفضل وقت للزيارة هو الغروب" →
1. `{"q": "أفضل وقت للزيارة؟", "a": "وقت الغروب هو الأفضل…"}`
2. `{"q": "أيمتى أروح عشان يكون الجو حلو؟", "a": "قبل الغروب بساعة تقريباً…"}`
3. `{"q": "هل الزيارة الصباحية جيدة؟", "a": "الصباح هادئ لكن الغروب هو الأجمل…"}`
4. `{"q": "What is the best time to visit?", "a": "Sunset is the best time…"}`
5. `{"q": "When should I go for the best experience?", "a": "Arrive about an hour before sunset…"}`
6. `{"q": "Is it worth visiting in the morning?", "a": "Mornings are quiet, but sunset is the highlight…"}`

## Facts to cover (gather from the user; ask if missing)

Work through these information pieces — each one gets its 3×2 QA treatment:
1. What the place is / what makes it special
2. Best time to visit (time of day + season)
3. Family suitability (kids, seating, safety)
4. Access: road condition, parking, walking distance, 4x4 needed?
5. Costs: entry fees, typical prices (Jordan Pass if relevant)
6. Facilities: bathrooms, food/drinks, shade, camping allowed?
7. Activities: what to do there (hike, swim, photograph, study…)
8. What to bring / wear
9. Crowds: busy times vs quiet times
10. Nearby places worth combining
11. Safety notes / warnings (flash floods, cliffs, closing times)
12. How to get there from the nearest city (duration, route)

Skip facts the user has no information for — NEVER invent facts, prices,
opening hours, or coordinates. Answers must be detailed (1–3 sentences),
concrete, and self-contained (the answer is what the AI will quote).

## Answer style

- Arabic answers: natural Jordanian-friendly فصحى بسيطة, warm but factual.
- English answers: clear, traveler-oriented, same facts as the Arabic ones.
- Include numbers where known (distances, fees, temperatures, durations).
- Each answer must stand alone — repeat the place name or subject when useful;
  never write "as mentioned above".

## Workflow

1. Ask the user for the place's facts (list above) unless already provided.
2. Draft the QA array: (number of facts) × 6 pairs, Arabic pairs first per fact.
3. Fill `name`, `category` (existing category slug), `location` if known, bilingual `tags`.
4. Validate: valid JSON, flat qa array, no invented information.
5. Save as `<place-slug>.json` and remind the user: upload it from
   لوحة الإدارة → الأماكن → أيقونة رفع ملف المعرفة (admin only), then the
   assistant answers about this place immediately.
