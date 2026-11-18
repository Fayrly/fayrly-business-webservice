import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EventReviewListResponse, Review } from '../models/review.model';
import { ListResponse } from '../models/pagination.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);

  listForEvent(
    eventId: string,
    page = 1,
    pageSize = 10,
  ): Observable<EventReviewListResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('page_size', String(pageSize));
    return this.http.get<EventReviewListResponse>(`/events/${eventId}/reviews`, { params });
  }

  listPublic(page = 1, pageSize = 100): Observable<ListResponse<Review>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('page_size', String(pageSize));
    return this.http.get<ListResponse<Review>>('/events/reviews', { params });
  }
}
