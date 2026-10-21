import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Student, StudentFilter } from '../entity/Student';

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/students';

  private static readonly ERROR_MESSAGES: Record<number, string> = {
    0: 'Не удалось связаться с сервером.',
    400: 'Некорректный запрос. Проверьте введённые данные.',
    401: 'Требуется авторизация для выполнения операции.',
    403: 'У вас недостаточно прав для выполнения этой операции.',
    404: 'Студент не найден.',
    409: 'Студент с таким ИСУ ID уже существует.',
    422: 'Сервер отклонил данные. Проверьте значения полей.',
    500: 'Ошибка со стороны сервера.',
  };

  getStudents(filters: StudentFilter = {}, pageNumber = 1, pageSize = 8): Observable<Student[]> {
    let params = new HttpParams()
      .set('pageSize', String(pageSize))
      .set('pageNumber', String(pageNumber > 0 ? pageNumber : 1));

    const allowedKeys: (keyof StudentFilter)[] = [
      'isuId',
      'fio',
      'stGroup',
      'dormitoryNumber',
      'room',
      'dateOfPlacement',
      'isNotRussian',
    ];

    for (const key of allowedKeys) {
      const val = filters[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        params = params.set(key, String(val).trim());
      }
    }

    return this.http
      .get<any[]>(this.baseUrl, { headers: this.getAuthHeaders(), params })
      .pipe(
        map((list) => (list ?? []).map(Student.fromJSON)),
        catchError(this.handleError)
      );
  }

  getStudent(isuId: number | string): Observable<Student> {
    return this.http
      .get<any>(`${this.baseUrl}/${encodeURIComponent(String(isuId))}`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        map(Student.fromJSON),
        catchError(this.handleError)
      );
  }

  createStudent(student: Student): Observable<Student> {
    return this.http
      .post<any>(this.baseUrl, student, { headers: this.getAuthHeaders() })
      .pipe(
        map(Student.fromJSON),
        catchError(this.handleError)
      );
  }

  updateStudent(isuId: number | string, student: Student): Observable<Student> {
    return this.http
      .patch<any>(`${this.baseUrl}/${encodeURIComponent(String(isuId))}`, student, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        map(Student.fromJSON),
        catchError(this.handleError)
      );
  }

  deleteStudent(isuId: number | string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${encodeURIComponent(String(isuId))}`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ Accept: 'application/json' });
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const status = error.status ?? 0;
    const serverMessage = error.error?.error?.message || error.error?.message;
    const code = error.error?.error?.code || (status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR');

    const message =
      status === 0
        ? StudentService.ERROR_MESSAGES[0]
        : serverMessage || StudentService.ERROR_MESSAGES[status] || 'Произошла ошибка при обработке запроса.';

    return throwError(() => ({ status, code, message } as ApiError));
  }
}
