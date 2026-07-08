import { SafeResourceUrl } from "@angular/platform-browser";
import { MediaURL } from "./item";

export type MediaType = 'video' | 'image'

export interface PreviewMedia {
  hd_url: string;
  sd_url: string;
  media_type: MediaType;

}

export interface SafePreviewMedia extends PreviewMedia {
  safe_hd_url?: SafeResourceUrl;
  safe_sd_url?: SafeResourceUrl;

}

export interface PreviewLink {
  original_url: string;
  media: PreviewMedia[];
}

export interface SafePreviewLink extends PreviewLink {
  currentIndex?: number;
  safe_media?: SafePreviewMedia[];
}

export interface LinkPayload {
  item: number;
  url: string;
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