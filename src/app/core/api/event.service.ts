import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { Event, EventPayload, EventQuery, EventStatus } from '../models/event.model';
import { ListResponse } from '../models/pagination.model';

const ALL_PAGE_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);

  listMine(query: EventQuery = {}): Observable<ListResponse<Event>> {
    return this.http.get<ListResponse<Event>>('/events/mine', { params: toParams(query) });
  }

  /** Loads every owned event, following the page_size cap of 100. */
  listAllMine(): Observable<Event[]> {
    return this.listMine({ page: 1, pageSize: ALL_PAGE_SIZE }).pipe(
      expand((response) =>
        response.pagination.page < response.pagination.total_pages
          ? this.listMine({ page: response.pagination.page + 1, pageSize: ALL_PAGE_SIZE })
          : EMPTY,
      ),
      reduce((acc, response) => acc.concat(response.data), [] as Event[]),
    );
  }

  get(id: string): Observable<{ data: Event }> {
    return this.http.get<{ data: Event }>(`/events/${id}`);
  }

  create(payload: EventPayload): Observable<{ data: Event }> {
    return this.http.post<{ data: Event }>('/events', payload);
  }

  update(id: string, payload: EventPayload): Observable<{ data: Event }> {
    return this.http.patch<{ data: Event }>(`/events/${id}`, payload);
  }

  changeStatus(id: string, status: Exclude<EventStatus, 'draft'>): Observable<{ data: Event }> {
    return this.http.post<{ data: Event }>(`/events/${id}/status`, { status });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/events/${id}`);
  }
}

function toParams(query: EventQuery): HttpParams {
  let params = new HttpParams();
  if (query.q) {
    params = params.set('q', query.q);
  }
  if (query.type) {
    params = params.set('type', query.type);
  }
  if (query.city) {
    params = params.set('city', query.city);
  }
  if (query.status) {
    params = params.set('status', query.status);
  }
  if (query.from) {
    params = params.set('from', query.from);
  }
  if (query.to) {
    params = params.set('to', query.to);
  }
  if (query.page) {
    params = params.set('page', String(query.page));
  }
  if (query.pageSize) {
    params = params.set('page_size', String(query.pageSize));
  }
  return params;
}
