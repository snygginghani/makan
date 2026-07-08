"use client";

import { Loader2, MapPin, Navigation, Route, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { QUICK_PROMPTS, useLang } from "@/lib/i18n";
import type { AIPlaceRef, AIQueryOut } from "@/lib/types";

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  places?: AIPlaceRef[];
  isPlan?: boolean;
  routeUrl?: string | null;
  suggestions?: string[];
}

export function AIChat({
  open,
  onClose,
  category,
  userLocation,
  locating,
  onRequestLocation,
  onResult,
  onPickPlace,
}: {
  open: boolean;
  onClose: () => void;
  category: string | null;
  userLocation: { lat: number; lng: number } | null;
  locating: boolean;
  onRequestLocation: () => void;
  onResult: (result: AIQueryOut) => void;
  onPickPlace: (place: AIPlaceRef) => void;
}) {
  const { lang, t } = useLang();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(query: string) {
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    // conversation so far (before this turn) so the assistant remembers answers
    // to its pre-questions and can build a coherent plan.
    const history = messages
      .slice(-8)
      .map((m) => ({ role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant", content: m.text }));
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    try {
      const result = await api.aiQuery({
        query: trimmed,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
        filters: category ? { category } : undefined,
        history,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: result.answer,
          places: result.places,
          isPlan: result.is_plan,
          routeUrl: result.route_url,
          suggestions: result.suggestions,
        },
      ]);
      onResult(result);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: t("chatError") }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <aside
      aria-label={t("chatTitle")}
      className="glass pointer-events-auto absolute z-30 flex flex-col overflow-hidden rounded-t-2xl text-start max-md:inset-x-0 max-md:bottom-0 max-md:h-[64dvh] md:top-28 md:bottom-6 md:start-4 md:w-[380px] md:rounded-2xl"
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-primary" aria-hidden />
          {t("chatTitle")}
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("close")}>
          <X size={16} />
        </Button>
      </div>

      {/* location banner */}
      <button
        type="button"
        onClick={onRequestLocation}
        disabled={locating}
        className={`flex items-center gap-2 border-b border-border px-4 py-2 text-start text-xs transition-colors ${
          userLocation
            ? "text-accent"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        }`}
      >
        {locating ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : (
          <Navigation
            size={13}
            aria-hidden
            className={userLocation ? "fill-current" : ""}
          />
        )}
        <span className="flex-1">
          {locating
            ? t("locating")
            : userLocation
              ? t("chatLocationOn")
              : t("chatLocationOff")}
        </span>
        {!userLocation && !locating && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
            {t("enableLocation")}
          </span>
        )}
      </button>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("chatEmpty")}</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS[lang].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => ask(prompt)}
                  className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs transition-colors hover:border-[color:var(--accent)]/50 hover:text-accent"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) =>
          message.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-ee-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                {message.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-start gap-2">
              <div className="max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-es-sm bg-secondary px-3.5 py-2.5 text-sm leading-relaxed">
                {message.text}
              </div>
              {message.places && message.places.length > 0 && (
                <ul className="w-full max-w-[92%] space-y-1.5" aria-label={t("chatSuggestions")}>
                  {message.places.map((place, idx) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        onClick={() => onPickPlace(place)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-start transition-colors hover:border-[color:var(--primary)]/50"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          {message.isPlan ? (
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground tabular-nums">
                              {idx + 1}
                            </span>
                          ) : (
                            <MapPin size={14} className="shrink-0 text-primary" aria-hidden />
                          )}
                          <span className="truncate">{place.name}</span>
                        </span>
                        {place.distance_km != null && (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {place.distance_km} {t("km")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {message.routeUrl && (
                <a
                  href={message.routeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                  <Route size={15} aria-hidden />
                  {t("openRoute")}
                </a>
              )}

              {message.suggestions && message.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {message.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs transition-colors hover:border-[color:var(--accent)]/50 hover:text-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            {t("chatSearching")}
          </div>
        )}
      </div>

      {/* input */}
      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chatInputPlaceholder")}
          aria-label={t("chatInputPlaceholder")}
          className="h-11 flex-1 rounded-xl border border-input bg-background/60 px-3.5 text-start text-sm outline-none transition-colors focus:border-[color:var(--accent)]/60"
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || !input.trim()}
          aria-label={t("chatSend")}
          className="h-11 w-11 shrink-0 rounded-xl"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="rtl:-scale-x-100" />}
        </Button>
      </form>
    </aside>
  );
}
