"use client";

import { AtSign, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, storeUser } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/use-auth";

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useLang();
  const { user, ready } = useAuth();
  const [username, setUsername] = useState("");
  const [region, setRegion] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.onboarded) router.replace("/");
    else setUsername(user.username ?? "");
  }, [ready, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await api.updateProfile({
        username: username.trim(),
        home_region: region.trim() || null,
        bio: bio.trim() || null,
      });
      storeUser(updated);
      toast.success(t("welcome", { name: updated.username ?? updated.name }));
      router.push("/");
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 409 ? t("usernameTaken") : t("error");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} aria-hidden />
      </div>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="glass w-full max-w-md rounded-3xl p-7 sm:p-8">
        <div className="mb-6 text-center">
          <LogoMark size={48} className="mx-auto" />
          <h1 className="mt-3 font-heading text-2xl font-bold">{t("onboardTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("onboardSubtitle")}</p>
        </div>

        {user.picture && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.picture}
              alt=""
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {user.email}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">{t("username")}</Label>
            <div className="relative">
              <AtSign
                size={16}
                className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="username"
                dir="ltr"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_.]+"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 ps-9"
                placeholder="explorer_jo"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("usernameHint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="region">{t("homeRegion")}</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-11"
              placeholder={t("regionPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">{t("bio")}</Label>
            <Textarea
              id="bio"
              rows={2}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={loading || username.trim().length < 3}
            className="h-11 w-full gap-1.5 rounded-xl"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <Sparkles size={16} aria-hidden />
            )}
            {t("finishOnboarding")}
          </Button>
        </form>
      </div>
    </main>
  );
}
