export type MediaType = "image" | "video" | "thumbnail";

export type Media = {
  id: string;
  type: MediaType;
  storage_path: string | null;
  thumbnail_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  source_url: string | null;
  source_title: string | null;
  author: string | null;
  license: string | null;
  license_url: string | null;
  attribution_required: boolean;
  commercial_use_allowed: boolean;
  modification_allowed: boolean;
};

export type LinkedMedia = Media & {
  role: "cover" | "step" | "thumb";
  sort_order: number;
};
