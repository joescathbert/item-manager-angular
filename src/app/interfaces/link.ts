import { SafeResourceUrl } from "@angular/platform-browser";
import { MediaURL } from "./item";

export type MediaType = 'video' | 'image'

export interface LinkPreviewMedia {
  hd_url: string;
  sd_url: string;
  media_type: MediaType;

}

export interface SafeLinkPreviewMedia extends LinkPreviewMedia {
  safe_hd_url?: SafeResourceUrl;
  safe_sd_url?: SafeResourceUrl;

}

export interface LinkPreview {
  original_url: string;
  media: LinkPreviewMedia[];
}

export interface SafeLinkPreview extends LinkPreview {
  currentIndex?: number;
  safe_media?: SafeLinkPreviewMedia[];
}

export interface UploadPreviewMedia {
  file: File;
  file_url: string;
  media_type: MediaType;
}

export interface UploadPreview {
  currentIndex: number;
  media: UploadPreviewMedia[];
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

export interface LinkCheckResponse {
  exists: boolean;
  matched_item_id: number | null;
  matched_url: string | null;
}