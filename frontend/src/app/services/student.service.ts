import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { STUDENTS_URL } from './api.constants';
import { Student } from '../entity/Student';

export interface StudentFilter {
  isuId?: string | number;
  fio?: string;
  stGroup?: string;
  dormitoryNumber?: string | number;
  room?: string | number;
  dateOfPlacement?: string;
  isNotRussian?: boolean;
}

@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly pageSize: number = 8;

  // In-memory кэш
  private readonly listCache: Map<string, Student[]> = new Map<string, Student[]>();
  private readonly studentCache: Map<number, Student> = new Map<number, Student>();

  // Поток событий инвалидации кэша
  readonly cacheInvalidated$: Subject<void> = new Subject<void>();

  getStudents(
    filters: StudentFilter = {},
    pageNumber: number = 1,
    bypassCache: boolean = false
  ): Observable<Student[]> {
    const cacheKey = JSON.stringify({ ...filters, pageNumber });

    if (!bypassCache && this.listCache.has(cacheKey)) {
      return of(this.listCache.get(cacheKey)!);
    }

    const query: Partial<StudentFilter> & {
      pageSize: number;
      pageNumber: number;
    } = {
      pageSize: this.pageSize,
      pageNumber,
    };

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
      const value: string | number | boolean | undefined = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        Object.assign(query, { [key]: value });
      }
    }

    const hasFilters: boolean = Object.keys(query).some(
      (k) => !['pageSize', 'pageNumber'].includes(k)
    );

    const request$: Observable<Student[]> = !hasFilters
      ? this.http.get<Student[]>(STUDENTS_URL, {
        params: new HttpParams()
          .set('pageSize', this.pageSize)
          .set('pageNumber', pageNumber),
      })
      : this.http.request<Student[]>('QUERY', STUDENTS_URL, {
        body: query,
        headers: { 'Content-Type': 'application/json' },
      });

    return request$.pipe(
      tap((students) => {
        this.listCache.set(cacheKey, students);
        students.forEach((s) => this.studentCache.set(Number(s.isuId), s));
      })
    );
  }

  getStudent(id: number, bypassCache: boolean = false): Observable<Student> {
    if (!bypassCache && this.studentCache.has(id)) {
      return of(this.studentCache.get(id)!);
    }

    return this.http
      .get<Student>(`${STUDENTS_URL}/${encodeURIComponent(id)}`)
      .pipe(
        tap((student) => {
          this.studentCache.set(id, student);
        })
      );
  }

  addStudent<T>(student: Student): Observable<T> {
    return this.http.post<T>(STUDENTS_URL, student).pipe(
      tap(() => this.invalidateCache())
    );
  }

  updateStudent<T>(id: number, student: Student): Observable<T> {
    return this.http
      .patch<T>(`${STUDENTS_URL}/${encodeURIComponent(id)}`, student)
      .pipe(
        tap(() => {
          this.studentCache.delete(id);
          this.invalidateCache();
        })
      );
  }

  deleteStudent(id: number): Observable<void> {
    return this.http
      .delete<void>(`${STUDENTS_URL}/${encodeURIComponent(id)}`)
      .pipe(
        tap(() => {
          this.studentCache.delete(id);
          this.invalidateCache();
        })
      );
  }

  invalidateCache(): void {
    this.listCache.clear();
    this.cacheInvalidated$.next();
  }
}
