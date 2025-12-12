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
}

export interface Link {
  id: number;
  item: number;
  url: string;
}
