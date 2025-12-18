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
  file_id: number | null;
  url?: string;
  url_domain?: string;
  media_url?: string;
  media_url_domain?: string;
}

export interface PagedItems {
  count: number;
  next: string | null;
  previous: string | null;
  results: Item[];
}

export interface Link {
  id: number;
  item: number;
  url: string;
  url_domain: string;
  media_url: string;
  media_url_domain: string;
}


export interface ItemPayload {
  name: string;
  type: string;
  date_of_origin: string; // Django expects snake_case
  tag_names: string[];
}

export interface LinkPayload {
  item: number; // The ID of the newly created item
  url: string;
}
