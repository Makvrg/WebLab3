import {
  Component,
  OnInit,
  inject,
  signal,
  DestroyRef,
  Signal,
  WritableSignal,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, timer } from 'rxjs';
import { catchError, exhaustMap, filter, finalize, map, tap } from 'rxjs/operators';
import { StudentService } from '../../services/student.service';
import { UserContextService } from '../../user-context/user-context.service';
import { WebRtcService } from '../../services/webrtc.service';
import { StudentRealtimeEvent } from '../../entity/RealtimeEvents';
import { Student } from '../../entity/Student';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './[id].page.html',
  styleUrls: ['./[id].page.css'],
})
export default class StudentDetailPage implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly studentService: StudentService = inject(StudentService);
  private readonly userContext: UserContextService = inject(UserContextService);
  private readonly webRtcService: WebRtcService = inject(WebRtcService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly platformId: Object = inject(PLATFORM_ID);

  readonly isAdmin: Signal<boolean> = this.userContext.isAdmin;
  readonly student: WritableSignal<Student | null> = signal<Student | null>(null);
  readonly isLoading: WritableSignal<boolean> = signal<boolean>(true);
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);
  readonly isNotFound: WritableSignal<boolean> = signal<boolean>(false);

  ngOnInit(): void {
    const rawId: string | null = this.route.snapshot.paramMap.get('id');
    const studentId: number = Number(rawId);

    if (!rawId || !Number.isInteger(studentId) || studentId <= 0) {
      this.isLoading.set(false);
      this.isNotFound.set(true);
      this.errorMessage.set('Некорректный идентификатор студента.');
      return;
    }

    this.loadStudentData(studentId, false);

    if (isPlatformBrowser(this.platformId)) {
      this.webRtcService.studentEvents$
        .pipe(
          filter((event: StudentRealtimeEvent) => Number(event.isuId) === studentId),
          exhaustMap((event: StudentRealtimeEvent) => {
            this.studentService.invalidateCache();

            if (event.action === 'DELETE') {
              this.isNotFound.set(true);
              this.student.set(null);
              this.errorMessage.set('Студент был удален из базы данных.');
              return of(null);
            }

            if (event.action === 'UPDATE' || event.action === 'CREATE') {
              return this.refreshStudentSilently(studentId);
            }

            return of(null);
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe();

      // Резервный HTTP-поллинг запускается только при отсутствии активного WebRTC-соединения
      timer(5000, 5000)
        .pipe(
          filter(() => this.webRtcService.status() !== 'connected'),
          exhaustMap(() => this.refreshStudentSilently(studentId)),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe();
    }
  }

  private refreshStudentSilently(studentId: number): Observable<Student | null> {
    return this.studentService.getStudent(studentId, true).pipe(
      map((raw: Student): Student => this.mapToStudent(raw)),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.isNotFound.set(true);
          this.student.set(null);
          this.errorMessage.set('Студент был удален из базы данных.');
        }
        return of(null);
      }),
      tap((loaded: Student | null) => {
        if (loaded) {
          this.isNotFound.set(false);
          this.student.set(loaded);
          this.errorMessage.set(null);
        }
      })
    );
  }

  private loadStudentData(id: number, bypassCache: boolean): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.isNotFound.set(false);

    this.studentService
      .getStudent(id, bypassCache)
      .pipe(
        map((raw: Student): Student => this.mapToStudent(raw)),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) {
            this.isNotFound.set(true);
            this.errorMessage.set('Студент с указанным ИСУ не найден в системе.');
          } else if (err.status === 0) {
            this.errorMessage.set('Не удалось связаться с сервером. Проверьте сеть.');
          } else {
            this.errorMessage.set(
              err.error?.error?.message ||
              err.error?.message ||
              'Не удалось загрузить данные студента.'
            );
          }
          return of(null);
        }),
        tap((loaded: Student | null) => {
          if (loaded) {
            this.student.set(loaded);
          }
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private mapToStudent(raw: any): Student {
    return new Student(
      Number(raw.isuId),
      String(raw.fio ?? ''),
      String(raw.stGroup ?? ''),
      Number(raw.dormitoryNumber),
      Number(raw.room),
      String(raw.dateOfPlacement ?? ''),
      Boolean(raw.isNotRussian),
      raw.notes ? String(raw.notes) : ''
    );
  }
}
