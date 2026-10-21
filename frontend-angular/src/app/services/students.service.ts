import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { STUDENTS_URL } from './api.constants';
import {Student} from '../entity/Student';

export interface StudentFilters {
  isuId?: string | number;
  fio?: string;
  stGroup?: string;
  dormitoryNumber?: string | number;
  room?: string | number;
  dateOfPlacement?: string;
  isNotRussian?: boolean;
}

@Injectable({ providedIn: 'root' })
export class StudentsService {
  private http = inject(HttpClient);
  private readonly pageSize = 8;

  getStudents (filters: StudentFilters = {},
               pageNumber: number = 1): Observable<Student[]> {
    let params: HttpParams = new HttpParams()
    const allowedFilters: (keyof StudentFilters)[] = [
      'isuId', 'fio', 'stGroup', 'dormitoryNumber',
      'room', 'dateOfPlacement', 'isNotRussian'
    ];

    for (const key of allowedFilters) {
      const value = filters[key];

      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    params = params.set('pageSize', this.pageSize)
                   .set('pageNumber', pageNumber);

    return this.http.get<Student[]>(STUDENTS_URL, { params });
  }

  getStudent (id: number): Observable<Student> {
    return this.http.get<Student>(
      `${STUDENTS_URL}/${encodeURIComponent(id)}`
    );
  }

  addStudent<T>(student: Student): Observable<T> {
    return this.http.post<T>(STUDENTS_URL, student);
  }

  updateStudent<T>(id: number, student: Student): Observable<T> {
    return this.http.patch<T>(
      `${STUDENTS_URL}/${encodeURIComponent(id)}`,
      student
    );
  }

  deleteStudent(id: number): Observable<void> {
    return this.http.delete<void>(
      `${STUDENTS_URL}/${encodeURIComponent(id)}`
    );
  }
}
