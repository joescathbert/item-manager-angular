import { SafeResourceUrl } from "@angular/platform-browser";

export interface Tag {
  id: number;
  name: string;
}

export interface Item {
  id: number;
  owner: string;
  name: string;
  type: string;
  date_of_origin: string;
  tags: string[];
  created_at: string;
  link_id: number | null;
  file_group_id: number | null;
  url?: string;
  url_domain?: string;
  media_url?: string;
  media_url_domain?: string;
  media_urls: MediaURL[];
  files?: File[];
}

export interface SafeItem extends Item {
  safe_url?: SafeResourceUrl;
  safe_media_url?: SafeResourceUrl;
  safe_media_urls?: SafeMediaURL[];
  currentIndex?: number;
  safe_files?: SafeFile[];
}

export interface PagedItems {
  count: number;
  next: string | null;
  previous: string | null;
  results: Item[];
}

export interface ItemNeighbors {
  prev_id: number | null;
  next_id: number | null;
}

export interface Link {
  id: number;
  item: number;
  url: string;
  url_domain: string;
  media_url: string;
  media_url_domain: string;
  media_urls: MediaURL[];
}

export interface MediaURL {
  id: number;
  url: string;
  hd_url: string;
  hd_url_domain: string;
  sd_url: string;
  sd_url_domain: string;
  media_type: 'image' | 'video';
  order: number;
}

export interface SafeMediaURL extends MediaURL {
  safe_hd_url?: SafeResourceUrl;
  safe_sd_url?: SafeResourceUrl;
}

export interface FileGroup {
  id: number;
  item: number;
  description: string;
  files: File[];
}

export interface File {
  id: number;
  file_name: string;
  file_type: string;
  file_origin: string;
  file_url: string;
}

export interface SafeFile extends File {
  safe_file_serve_url?: SafeResourceUrl;
}

export interface ItemPayload {
  name: string;
  type: string;
  date_of_origin: string;
  tag_names: string[];
}

export interface LinkPayload {
  item: number;
  url: string;
}
