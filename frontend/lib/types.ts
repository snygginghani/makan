export interface Place {
  id: number;
  name_ar: string;
  name_en: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  coords_verified: boolean;
  category: string;
  tags: string[];
  region: string | null;
  rating: number;
  rating_count: number;
  images: string[];
  approved: boolean;
  created_at: string;
}

export interface QAPair {
  q: string;
  a: string;
}

export interface PlaceDetail extends Place {
  qa: QAPair[];
  is_favorite: boolean;
}

export interface PageOut {
  items: Place[];
  total: number;
  page: number;
  page_size: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  picture?: string | null;
  username?: string | null;
  home_region?: string | null;
  bio?: string | null;
  onboarded: boolean;
  points: number;
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  name: string;
  username: string | null;
  picture: string | null;
  points: number;
  is_me: boolean;
}

export interface UserStats {
  points: number;
  rank: number;
  total_contributors: number;
  reviews_count: number;
  favorites_count: number;
  submissions_count: number;
  approved_count: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  username: string | null;
  picture: string | null;
  role: "user" | "admin";
  points: number;
  home_region: string | null;
  bio: string | null;
  onboarded: boolean;
  banned: boolean;
  last_ip: string | null;
  last_lat: number | null;
  last_lng: number | null;
  location_at: string | null;
  created_at: string;
}

export interface GeoSearchResult {
  name: string;
  label: string;
  lat: number;
  lng: number;
}

export interface Ban {
  id: number;
  ban_type: "email" | "ip";
  value: string;
  reason: string | null;
  created_at: string;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterOut {
  email: string;
  verification_required: boolean;
  dev_code: string | null;
}

export interface AIPlaceRef {
  id: number;
  name: string;
  reason: string;
  distance_km: number | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
}

export interface AIQueryOut {
  answer: string;
  places: AIPlaceRef[];
  map_highlight_ids: number[];
  sources: number[];
  is_plan: boolean;
  route_url: string | null;
  suggestions: string[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Submission {
  id: number;
  user_id: number;
  place_json: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Report {
  id: number;
  user_id: number;
  place_id: number;
  reason: string;
  resolved: boolean;
  created_at: string;
}

export interface Analytics {
  total_places: number;
  approved_places: number;
  total_users: number;
  pending_submissions: number;
  indexed_places: number;
  total_chunks: number;
  open_reports: number;
  places_by_category: Record<string, number>;
}

export interface Category {
  id: number;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  color: string | null;
}

export interface Review {
  id: number;
  user_id: number;
  user_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  is_mine: boolean;
}

export interface ReviewsPage {
  items: Review[];
  total: number;
  average: number;
}
