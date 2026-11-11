import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ListResponse } from '../models/pagination.model';
import {
  Report,
  ReportPayload,
  ReportQuery,
  ReviewReportRequest,
} from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  list(query: ReportQuery = {}): Observable<ListResponse<Report>> {
    return this.http.get<ListResponse<Report>>('/reports', { params: toParams(query) });
  }

  get(id: string): Observable<{ data: Report }> {
    return this.http.get<{ data: Report }>(`/reports/${id}`);
  }

  create(payload: ReportPayload): Observable<{ data: Report }> {
    return this.http.post<{ data: Report }>('/reports', payload);
  }

  update(id: string, payload: ReportPayload): Observable<{ data: Report }> {
    return this.http.patch<{ data: Report }>(`/reports/${id}`, payload);
  }

  submit(id: string): Observable<{ data: Report }> {
    return this.http.post<{ data: Report }>(`/reports/${id}/submit`, {});
  }

  review(id: string, payload: ReviewReportRequest): Observable<{ data: Report }> {
    return this.http.post<{ data: Report }>(`/reports/${id}/review`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/reports/${id}`);
  }
}

function toParams(query: ReportQuery): HttpParams {
  let params = new HttpParams();
  if (query.q) {
    params = params.set('q', query.q);
  }
  if (query.type) {
    params = params.set('type', query.type);
  }
  if (query.status) {
    params = params.set('status', query.status);
  }
  if (query.eventId) {
    params = params.set('event_id', query.eventId);
  }
  if (query.mine) {
    params = params.set('mine', 'true');
  }
  if (query.page) {
    params = params.set('page', String(query.page));
  }
  if (query.pageSize) {
    params = params.set('page_size', String(query.pageSize));
  }
  return params;
}
