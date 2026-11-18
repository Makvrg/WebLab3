import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RT_URL } from './api.constants';
import { StudentFilter } from './student.service';
import { CsvImportResponse } from '../entity/CsvJob';

@Injectable({ providedIn: 'root' })
export class CsvService {
  private readonly http: HttpClient = inject(HttpClient);

  exportCsv(filters: StudentFilter = {}): Observable<Blob> {
    let params = new HttpParams();

    const allowedFilters: (keyof StudentFilter)[] = [
      'isuId',
      'fio',
      'stGroup',
      'dormitoryNumber',
      'room',
      'dateOfPlacement',
      'isNotRussian',
    ];

    for (const key of allowedFilters) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http.get(`${RT_URL}/csv/export`, {
      params,
      responseType: 'blob',
    });
  }

  importCsv(file: File): Observable<CsvImportResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const params = new HttpParams().set('strategy', 'SKIP');

    return this.http.post<CsvImportResponse>(`${RT_URL}/csv/import`, formData, {
      params,
    });
  }
}
