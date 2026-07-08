"use client";

import {
  LayoutDashboard,
  Languages,
  LogOut,
  PlusCircle,
  Shield,
  Trophy,
  User2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/use-auth";

export function TopNav({ floating = false }: { floating?: boolean }) {
  const { user, isAdmin, logout } = useAuth();
  const { t, toggleLang } = useLang();
  const router = useRouter();

  return (
    <header
      className={
        floating
          ? "glass pointer-events-auto absolute top-3 right-3 left-3 z-40 flex items-center justify-between rounded-xl px-3 py-1.5 md:right-4 md:left-auto md:w-auto md:gap-4"
          : "sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur-sm md:px-8"
      }
    >
      <Link href="/" className="flex items-center gap-2" aria-label={t("appName")}>
        <LogoMark size={30} />
        <span className="font-heading text-lg font-bold">{t("appName")}</span>
      </Link>

      <nav className="flex items-center gap-1" aria-label={t("map")}>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLang}
          aria-label={t("switchLanguage")}
          title={t("switchLanguage")}
          className="gap-1.5 border-primary/40 font-semibold text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Languages size={16} aria-hidden />
          {t("language")}
        </Button>
        <ThemeToggle />
        {isAdmin && (
          <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
            <Link href="/admin">
              <Shield size={15} aria-hidden />
              {t("admin")}
            </Link>
          </Button>
        )}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" aria-label={t("myAccount")} className="gap-1.5">
                {user.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.picture}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="-ms-1 h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <User2 size={15} aria-hidden />
                )}
                <span className="max-sm:hidden">{(user.username ?? user.name).split(" ")[0]}</span>
                <span className="flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 text-[11px] font-bold text-primary tabular-nums">
                  <Trophy size={10} aria-hidden />
                  {user.points ?? 0}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <p className="font-medium">{user.username ?? user.name}</p>
                <p className="text-muted-foreground text-xs font-normal">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <LayoutDashboard size={16} aria-hidden />
                  {t("dashboard")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/leaderboard">
                  <Trophy size={16} aria-hidden />
                  {t("leaderboard")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/suggest">
                  <PlusCircle size={16} aria-hidden />
                  {t("suggestPlace")}
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Shield size={16} aria-hidden />
                    {t("admin")}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  logout();
                  router.push("/");
                }}
              >
                <LogOut size={16} aria-hidden />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild size="sm" variant="secondary">
            <Link href="/login">{t("login")}</Link>
          </Button>
        )}
      </nav>
    </header>
  );
}
