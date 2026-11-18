import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RT_URL } from './api.constants';
import { AuditFilter, AuditPageResponse } from '../entity/AuditEvent';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http: HttpClient = inject(HttpClient);

  getAuditLogs(filters: AuditFilter = {}): Observable<AuditPageResponse> {
    let params = new HttpParams();

    if (filters.page !== undefined && Number.isInteger(filters.page) && filters.page > 0) {
      params = params.set('page', String(filters.page));
    }

    if (
      filters.pageSize !== undefined &&
      Number.isInteger(filters.pageSize) &&
      filters.pageSize > 0
    ) {
      params = params.set('pageSize', String(filters.pageSize));
    }

    if (filters.action && filters.action.trim().length > 0) {
      params = params.set('action', filters.action.trim());
    }

    if (filters.isuId !== undefined && Number.isInteger(filters.isuId) && filters.isuId > 0) {
      params = params.set('isuId', String(filters.isuId));
    }

    if (filters.actorLogin && filters.actorLogin.trim().length > 0) {
      params = params.set('actorLogin', filters.actorLogin.trim());
    }

    return this.http.get<AuditPageResponse>(`${RT_URL}/audit`, { params });
  }
}
