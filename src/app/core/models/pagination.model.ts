export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
}
