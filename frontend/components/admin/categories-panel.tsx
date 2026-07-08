"use client";

import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import {
  categoryIcon,
  categoryName,
  ICON_OPTIONS,
  invalidateCategories,
} from "@/lib/categories";
import { useLang } from "@/lib/i18n";
import type { Category } from "@/lib/types";

const EMPTY_FORM = {
  slug: "",
  name_ar: "",
  name_en: "",
  icon: "map-pin",
  color: "#E2725B",
};

export function CategoriesPanel() {
  const { lang, t } = useLang();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    api
      .adminCategories()
      .then(setCategories)
      .catch(() => toast.error(t("loadCategoriesError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(category: Category) {
    setEditingId(category.id);
    setForm({
      slug: category.slug,
      name_ar: category.name_ar,
      name_en: category.name_en,
      icon: category.icon ?? "map-pin",
      color: category.color ?? "#E2725B",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId != null) {
        const updated = await api.updateCategory(editingId, form);
        setCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        toast.success(t("categoryUpdated"));
      } else {
        const created = await api.createCategory(form);
        setCategories((prev) => [...prev, created]);
        toast.success(t("categoryAdded"));
      }
      invalidateCategories();
      resetForm();
    } catch (err) {
      const fallback = editingId != null ? t("categoryUpdateFailed") : t("categoryAddFailed");
      toast.error(err instanceof ApiError ? err.message : fallback);
    } finally {
      setSaving(false);
    }
  }

  async function remove(category: Category) {
    setBusyId(category.id);
    try {
      await api.deleteCategory(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      invalidateCategories();
      if (editingId === category.id) resetForm();
      toast.success(t("categoryDeleted"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("categoryDeleteFailed"));
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

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <ul className="space-y-2 lg:col-span-2">
        {categories.map((category) => {
          const Icon = categoryIcon(category);
          const isEditing = editingId === category.id;
          return (
            <li
              key={category.id}
              className={`flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 sm:px-4 sm:py-2.5 ${
                isEditing ? "border-primary/60" : "border-border"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{
                    backgroundColor: `${category.color ?? "#888"}22`,
                    color: category.color ?? undefined,
                  }}
                >
                  <Icon size={17} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{categoryName(category, lang)}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    {category.slug}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("edit")}
                  onClick={() => startEdit(category)}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label={t("delete")}
                  disabled={busyId === category.id}
                  onClick={() => remove(category)}
                >
                  {busyId === category.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <form
        ref={formRef}
        onSubmit={submit}
        className="h-fit space-y-3 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {editingId != null ? <Pencil size={15} aria-hidden /> : <Plus size={16} aria-hidden />}
            {editingId != null ? t("editCategory") : t("newCategory")}
          </h3>
          {editingId != null && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("cancel")}
              onClick={resetForm}
            >
              <X size={15} />
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-slug">{t("categorySlug")} *</Label>
          <Input
            id="cat-slug"
            dir="ltr"
            required
            pattern="[a-z0-9_]+"
            placeholder="beach"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-ar">{t("nameAr")} *</Label>
            <Input
              id="cat-ar"
              dir="rtl"
              required
              placeholder="شواطئ"
              value={form.name_ar}
              onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-en">{t("nameEn")} *</Label>
            <Input
              id="cat-en"
              dir="ltr"
              required
              placeholder="Beaches"
              value={form.name_en}
              onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            />
          </div>
        </div>

        {/* visual icon picker */}
        <div className="space-y-1.5">
          <Label>{t("categoryIcon")}</Label>
          <div className="grid grid-cols-7 gap-1.5 rounded-xl border border-input bg-background/40 p-2">
            {ICON_OPTIONS.map(({ name, Icon }) => {
              const selected = form.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  aria-pressed={selected}
                  title={name}
                  onClick={() => setForm((f) => ({ ...f, icon: name }))}
                  className={`grid aspect-square place-items-center rounded-lg border transition-colors ${
                    selected
                      ? "border-transparent text-white"
                      : "border-transparent text-muted-foreground hover:bg-secondary"
                  }`}
                  style={selected ? { backgroundColor: form.color } : undefined}
                >
                  <Icon size={16} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-color">{t("categoryColor")}</Label>
          <Input
            id="cat-color"
            type="color"
            className="h-9 w-full cursor-pointer p-1"
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
          />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {t("save")}
        </Button>
      </form>
    </div>
  );
}
