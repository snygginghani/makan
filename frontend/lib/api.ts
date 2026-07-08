import type {
  AdminUser,
  AIQueryOut,
  Analytics,
  Ban,
  Category,
  GeoSearchResult,
  PageOut,
  LeaderboardEntry,
  Place,
  PlaceDetail,
  RegisterOut,
  Report,
  Review,
  ReviewsPage,
  Submission,
  TokenOut,
  User,
  UserStats,
} from "./types";

/** Resolve the backend base URL.
 *  - explicit NEXT_PUBLIC_API_URL always wins (e.g. a deployed API);
 *  - in the browser, talk to the backend on the SAME host that served the
 *    page, so the app works over the LAN (192.168.x.x) as well as localhost
 *    without hardcoding an IP;
 *  - during server-side render, the backend is local to the host. */
function resolveApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

export const API_BASE = resolveApiBase();

const TOKEN_KEY = "makan_token";
const USER_KEY = "makan_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function storeSession(token: TokenOut) {
  localStorage.setItem(TOKEN_KEY, token.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(token.user));
  window.dispatchEvent(new Event("makan-auth"));
}

export function storeUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("makan-auth"));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Resolve stored image URLs: local uploads are relative (/media/...). */
export function mediaUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // A 401 while we were holding a token means the session expired or the token
  // is no longer valid. Drop the dead session and send the user to log in again
  // instead of leaving the UI stuck (e.g. an admin page spinning forever).
  if (resp.status === 401 && token) {
    clearSession();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("makan-auth"));
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=1";
      }
    }
    throw new ApiError(401, "انتهت الجلسة — سجّل الدخول من جديد / Session expired — please sign in again");
  }

  if (resp.status === 204) return undefined as T;
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : JSON.stringify(data?.detail ?? "خطأ غير متوقع");
    throw new ApiError(resp.status, detail);
  }
  return data as T;
}

// ---------------------------------------------------------------- auth

export const api = {
  // Google Sign-In: exchange the Google ID token (credential) for a makan JWT.
  googleLogin: (credential: string) =>
    request<TokenOut>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),

  // email + password with email verification code
  register: (name: string, email: string, password: string) =>
    request<RegisterOut>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  verifyEmail: (email: string, code: string) =>
    request<TokenOut>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  resendCode: (email: string) =>
    request<RegisterOut>("/auth/resend-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  login: (email: string, password: string) =>
    request<TokenOut>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>("/me"),

  updateProfile: (payload: { username: string; home_region?: string | null; bio?: string | null }) =>
    request<User>("/me", { method: "PATCH", body: JSON.stringify(payload) }),

  myStats: () => request<UserStats>("/me/stats"),

  // Share the user's current location with the server (map GPS grant).
  reportLocation: (lat: number, lng: number) =>
    request<void>("/me/location", {
      method: "POST",
      body: JSON.stringify({ lat, lng }),
    }),

  leaderboard: (limit = 20) =>
    request<LeaderboardEntry[]>(`/leaderboard?limit=${limit}`),

  // -------------------------------------------------------------- places

  listPlaces: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") qs.set(key, String(value));
    }
    return request<PageOut>(`/places?${qs.toString()}`);
  },

  getPlace: (id: number | string) => request<PlaceDetail>(`/places/${id}`),

  createPlace: (payload: Partial<Place>) =>
    request<Place>("/places", { method: "POST", body: JSON.stringify(payload) }),

  updatePlace: (id: number, payload: Partial<Place>) =>
    request<Place>(`/places/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  deletePlace: (id: number) => request<void>(`/places/${id}`, { method: "DELETE" }),

  listCategories: () => request<Category[]>("/categories"),

  // reviews
  listReviews: (placeId: number, limit = 20) =>
    request<ReviewsPage>(`/places/${placeId}/reviews?limit=${limit}`),

  postReview: (placeId: number, rating: number, comment?: string) =>
    request<Review>(`/places/${placeId}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    }),

  deleteMyReview: (placeId: number) =>
    request<void>(`/places/${placeId}/reviews/mine`, { method: "DELETE" }),

  // suggestion photo uploads (any authenticated user)
  uploadSuggestionImages: (files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    return request<string[]>("/uploads/images", { method: "POST", body: form });
  },

  uploadPlaceImages: (id: number, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    return request<Place>(`/places/${id}/images`, { method: "POST", body: form });
  },

  deletePlaceImage: (id: number, url: string) =>
    request<Place>(`/places/${id}/images?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
    }),

  addFavorite: (id: number) =>
    request<void>(`/places/${id}/favorite`, { method: "POST" }),

  removeFavorite: (id: number) =>
    request<void>(`/places/${id}/favorite`, { method: "DELETE" }),

  myFavorites: () => request<Place[]>("/me/favorites"),

  // -------------------------------------------------------------- AI

  aiQuery: (payload: {
    query: string;
    lat?: number;
    lng?: number;
    filters?: { category?: string; tags?: string[]; radius_km?: number };
    history?: { role: "user" | "assistant"; content: string }[];
  }) =>
    request<AIQueryOut>("/ai/query", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // -------------------------------------------------------------- submissions & reports

  submitPlace: (place_json: Record<string, unknown>) =>
    request<Submission>("/submissions", {
      method: "POST",
      body: JSON.stringify({ place_json }),
    }),

  mySubmissions: () => request<Submission[]>("/submissions/mine"),

  reportPlace: (place_id: number, reason: string) =>
    request<Report>("/reports", {
      method: "POST",
      body: JSON.stringify({ place_id, reason }),
    }),

  // -------------------------------------------------------------- admin

  adminSubmissions: (status?: string) =>
    request<Submission[]>(
      `/admin/submissions${status ? `?status_filter=${status}` : ""}`,
    ),

  reviewSubmission: (id: number, action: "approve" | "reject", note?: string) =>
    request<Submission>(`/admin/submissions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, note }),
    }),

  adminReports: () => request<Report[]>("/admin/reports"),

  resolveReport: (id: number) =>
    request<Report>(`/admin/reports/${id}/resolve`, { method: "POST" }),

  adminAnalytics: () => request<Analytics>("/admin/analytics"),

  adminUsers: (q?: string) =>
    request<AdminUser[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  setUserRole: (id: number, role: "user" | "admin") =>
    request<AdminUser>(`/admin/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  banUser: (id: number, opts: { include_ip?: boolean; reason?: string } = {}) =>
    request<AdminUser>(`/admin/users/${id}/ban`, {
      method: "POST",
      body: JSON.stringify({ include_ip: opts.include_ip ?? false, reason: opts.reason }),
    }),

  unbanUser: (id: number) =>
    request<AdminUser>(`/admin/users/${id}/unban`, { method: "POST" }),

  adminBans: () => request<Ban[]>("/admin/bans"),

  createBan: (payload: { ban_type: "email" | "ip"; value: string; reason?: string }) =>
    request<Ban>("/admin/bans", { method: "POST", body: JSON.stringify(payload) }),

  deleteBan: (id: number) =>
    request<void>(`/admin/bans/${id}`, { method: "DELETE" }),

  // resolve a Google Maps URL to coordinates
  resolveGeoLink: (url: string) =>
    request<{ lat: number; lng: number }>(`/geo/resolve?url=${encodeURIComponent(url)}`),

  // search real-world places by name (keyless OSM geocoder, biased to Jordan)
  geoSearch: (q: string, opts: { lat?: number; lng?: number; lang?: string } = {}) => {
    const qs = new URLSearchParams({ q });
    if (opts.lat != null && opts.lng != null) {
      qs.set("lat", String(opts.lat));
      qs.set("lng", String(opts.lng));
    }
    if (opts.lang) qs.set("lang", opts.lang);
    return request<GeoSearchResult[]>(`/geo/search?${qs.toString()}`);
  },

  adminCategories: () => request<Category[]>("/admin/categories"),

  createCategory: (payload: {
    slug: string;
    name_ar: string;
    name_en: string;
    icon?: string | null;
    color?: string | null;
  }) =>
    request<Category>("/admin/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCategory: (
    id: number,
    payload: {
      slug: string;
      name_ar: string;
      name_en: string;
      icon?: string | null;
      color?: string | null;
    },
  ) =>
    request<Category>(`/admin/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteCategory: (id: number) =>
    request<void>(`/admin/categories/${id}`, { method: "DELETE" }),

  uploadKnowledge: (placeId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ place_id: number; chunk_count: number; indexed_at: string }>(
      `/admin/knowledge/upload-json?place_id=${placeId}`,
      { method: "POST", body: form },
    );
  },

  reindexKnowledge: (placeId: number) =>
    request<{ place_id: number; chunk_count: number; status: string }>(
      `/admin/knowledge/reindex/${placeId}`,
      { method: "POST" },
    ),
};
