"use client";

import { BrainCircuit, FileUp, ImageIcon, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PlaceForm } from "@/components/admin/place-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError, mediaUrl } from "@/lib/api";
import { categoryColor, categoryName, useCategories } from "@/lib/categories";
import { placeName, useLang } from "@/lib/i18n";
import type { Place } from "@/lib/types";

export function PlacesTable() {
  const { lang, t } = useLang();
  const { bySlug } = useCategories();
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Place | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<number | null>(null);

  useEffect(() => {
    api
      .listPlaces({ page_size: 200, include_unapproved: true })
      .then((page) => setPlaces(page.items))
      .catch(() => toast.error(t("loadPlacesError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = query
    ? places.filter(
        (p) =>
          p.name_ar.includes(query) ||
          p.name_en.toLowerCase().includes(query.toLowerCase()),
      )
    : places;

  async function remove(place: Place) {
    if (!confirm(t("deleteConfirmPlace", { name: placeName(place, lang) }))) return;
    setBusyId(place.id);
    try {
      await api.deletePlace(place.id);
      setPlaces((prev) => prev.filter((p) => p.id !== place.id));
      toast.success(t("deleted"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deleteFailed"));
    } finally {
      setBusyId(null);
    }
  }

  function pickKnowledgeFile(placeId: number) {
    uploadTargetRef.current = placeId;
    fileInputRef.current?.click();
  }

  async function uploadKnowledge(file: File) {
    const placeId = uploadTargetRef.current;
    if (!placeId) return;
    setBusyId(placeId);
    try {
      const result = await api.uploadKnowledge(placeId, file);
      toast.success(t("chunksIndexed", { n: result.chunk_count }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("knowledgeUploadFailed"));
    } finally {
      setBusyId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function reindex(place: Place) {
    setBusyId(place.id);
    try {
      const result = await api.reindexKnowledge(place.id);
      toast.success(t("reindexed", { n: result.chunk_count }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("noKnowledgeFile"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadKnowledge(file);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchByName")}
          aria-label={t("searchByName")}
          className="max-w-xs"
        />
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} aria-hidden />
          {t("newPlace")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} aria-hidden /> {t("loading")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-start">{t("place")}</TableHead>
                <TableHead className="text-start max-md:hidden">{t("category")}</TableHead>
                <TableHead className="text-start max-md:hidden">{t("region")}</TableHead>
                <TableHead className="text-start">{t("status")}</TableHead>
                <TableHead className="text-start">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((place) => {
                const category = bySlug.get(place.category);
                const color = categoryColor(category);
                const busy = busyId === place.id;
                const thumb = place.images[0];
                return (
                  <TableRow key={place.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaUrl(thumb)}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                            <ImageIcon size={16} aria-hidden />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{place.name_ar}</p>
                          <p className="truncate text-xs text-muted-foreground" dir="ltr">
                            {place.name_en}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-md:hidden">
                      <Badge variant="secondary" style={{ color }}>
                        {categoryName(category, lang) || place.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-md:hidden">
                      {place.region ?? "—"}
                    </TableCell>
                    <TableCell>
                      {place.approved ? (
                        <Badge className="bg-[#4ADE80]/15 text-[#4ADE80]">{t("published")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("draft")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("edit")}
                          title={t("edit")}
                          disabled={busy}
                          onClick={() => {
                            setEditing(place);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("uploadKnowledge")}
                          title={t("uploadKnowledge")}
                          disabled={busy}
                          onClick={() => pickKnowledgeFile(place.id)}
                        >
                          <FileUp size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("reindexKnowledge")}
                          title={t("reindexKnowledge")}
                          disabled={busy}
                          onClick={() => reindex(place)}
                        >
                          {busy ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <BrainCircuit size={15} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("delete")}
                          title={t("delete")}
                          className="text-destructive"
                          disabled={busy}
                          onClick={() => remove(place)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("editPlace", { name: placeName(editing, lang) }) : t("newPlace")}
            </DialogTitle>
            <DialogDescription>
              {editing ? t("editPlaceHint") : t("newPlaceHint")}
            </DialogDescription>
          </DialogHeader>
          <PlaceForm
            key={editing?.id ?? "new"}
            place={editing}
            onSaved={(saved) => {
              setFormOpen(false);
              setPlaces((prev) => {
                const exists = prev.some((p) => p.id === saved.id);
                return exists
                  ? prev.map((p) => (p.id === saved.id ? saved : p))
                  : [saved, ...prev];
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
