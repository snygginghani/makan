"use client";

import { Ban, Loader2, MapPin, Shield, ShieldOff, Trophy, User2, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { AdminUser } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

export function UsersPanel() {
  const { t, lang } = useLang();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    api
      .adminUsers()
      .then(setUsers)
      .catch(() => toast.error(t("loadUsersError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = query
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase()) ||
          (u.username?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : users;

  async function toggleRole(u: AdminUser) {
    const next = u.role === "admin" ? "user" : "admin";
    const msg = next === "admin" ? t("confirmMakeAdmin", { name: u.name }) : t("confirmRemoveAdmin", { name: u.name });
    if (!confirm(msg)) return;
    setBusyId(u.id);
    try {
      const updated = await api.setUserRole(u.id, next);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
      toast.success(t("roleUpdated"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("roleUpdateFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBan(u: AdminUser) {
    setBusyId(u.id);
    try {
      let updated: AdminUser;
      if (u.banned) {
        if (!confirm(t("confirmUnban", { name: u.username ?? u.name }))) return;
        updated = await api.unbanUser(u.id);
        toast.success(t("userUnbanned"));
      } else {
        if (!confirm(t("confirmBan", { name: u.username ?? u.name }))) return;
        const include_ip = u.last_ip
          ? confirm(t("confirmBanIp", { ip: u.last_ip }))
          : false;
        updated = await api.banUser(u.id, { include_ip });
        toast.success(t("userBanned"));
      }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("banFailed"));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} aria-hidden /> {t("loading")}
      </div>
    );
  }

  function actionButtons(u: AdminUser, busy: boolean, labelClass: string) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => toggleRole(u)}
          className={u.role === "admin" ? "text-destructive" : ""}
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : u.role === "admin" ? (
            <ShieldOff size={14} aria-hidden />
          ) : (
            <Shield size={14} aria-hidden />
          )}
          <span className={labelClass}>
            {u.role === "admin" ? t("removeAdmin") : t("makeAdmin")}
          </span>
        </Button>
        {u.role !== "admin" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => toggleBan(u)}
            className={u.banned ? "" : "text-destructive"}
            title={u.banned ? t("unbanUser") : t("banUser")}
          >
            {u.banned ? <UserCheck size={14} aria-hidden /> : <Ban size={14} aria-hidden />}
            <span className={labelClass}>{u.banned ? t("unbanUser") : t("banUser")}</span>
          </Button>
        )}
      </div>
    );
  }

  function locationCell(u: AdminUser) {
    if (u.last_lat == null || u.last_lng == null) {
      return <span className="text-sm text-muted-foreground">{t("noLocation")}</span>;
    }
    return (
      <a
        href={`https://www.google.com/maps?q=${u.last_lat},${u.last_lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        title={
          u.location_at
            ? new Date(u.location_at).toLocaleString(lang === "ar" ? "ar-JO" : "en-GB")
            : undefined
        }
      >
        <MapPin size={13} aria-hidden />
        {t("viewLocation")}
      </a>
    );
  }

  function avatar(u: AdminUser) {
    return u.picture ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={u.picture}
        alt=""
        referrerPolicy="no-referrer"
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    ) : (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
        <User2 size={16} aria-hidden />
      </span>
    );
  }

  function roleBadge(u: AdminUser) {
    return u.role === "admin" ? (
      <Badge className="bg-[#E2725B]/15 text-[#E2725B]">{t("admin_role")}</Badge>
    ) : (
      <Badge variant="secondary">{t("user_role")}</Badge>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchUsers")}
        aria-label={t("searchUsers")}
        className="max-w-xs"
      />

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-start">{t("user")}</TableHead>
              <TableHead className="text-start max-md:hidden">{t("regionCol")}</TableHead>
              <TableHead className="text-start max-lg:hidden">{t("locationCol")}</TableHead>
              <TableHead className="text-start">{t("points")}</TableHead>
              <TableHead className="text-start">{t("role")}</TableHead>
              <TableHead className="text-start max-sm:hidden">{t("joined")}</TableHead>
              <TableHead className="text-start" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => {
              const isMe = me?.id === u.id;
              const busy = busyId === u.id;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {u.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.picture}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                          <User2 size={16} aria-hidden />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          <span className="truncate">{u.username ?? u.name}</span>
                          {isMe && <span className="text-xs text-primary">· {t("you")}</span>}
                          {u.banned && (
                            <Badge className="bg-destructive/15 text-destructive">
                              {t("bannedBadge")}
                            </Badge>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-md:hidden">
                    {u.home_region ?? "—"}
                  </TableCell>
                  <TableCell className="max-lg:hidden">
                    {u.last_lat != null && u.last_lng != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${u.last_lat},${u.last_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        title={
                          u.location_at
                            ? new Date(u.location_at).toLocaleString(
                                lang === "ar" ? "ar-JO" : "en-GB",
                              )
                            : undefined
                        }
                      >
                        <MapPin size={13} aria-hidden />
                        {t("viewLocation")}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t("noLocation")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm font-medium tabular-nums">
                      <Trophy size={13} className="text-primary" aria-hidden />
                      {u.points}
                    </span>
                  </TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      <Badge className="bg-[#E2725B]/15 text-[#E2725B]">{t("admin_role")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("user_role")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-sm:hidden">
                    {new Date(u.created_at).toLocaleDateString(lang === "ar" ? "ar-JO" : "en-GB")}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {!isMe && actionButtons(u, busy, "max-lg:hidden")}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards with every field + actions */}
      <ul className="space-y-2.5 md:hidden">
        {filtered.map((u) => {
          const isMe = me?.id === u.id;
          const busy = busyId === u.id;
          return (
            <li key={u.id} className="rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-start gap-3">
                {avatar(u)}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    <span className="truncate">{u.username ?? u.name}</span>
                    {isMe && <span className="text-xs text-primary">· {t("you")}</span>}
                    {u.banned && (
                      <Badge className="bg-destructive/15 text-destructive">{t("bannedBadge")}</Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    {u.email}
                  </p>
                </div>
                {roleBadge(u)}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">{t("points")}:</dt>
                  <dd className="flex items-center gap-1 font-medium tabular-nums">
                    <Trophy size={13} className="text-primary" aria-hidden />
                    {u.points}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">{t("regionCol")}:</dt>
                  <dd className="truncate">{u.home_region ?? "—"}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">{t("locationCol")}:</dt>
                  <dd className="min-w-0 truncate">{locationCell(u)}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">{t("joined")}:</dt>
                  <dd className="tabular-nums">
                    {new Date(u.created_at).toLocaleDateString(lang === "ar" ? "ar-JO" : "en-GB")}
                  </dd>
                </div>
              </dl>

              {!isMe && (
                <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-2.5">
                  {actionButtons(u, busy, "")}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
