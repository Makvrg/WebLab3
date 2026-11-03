import {Component, OnInit, inject, signal, DestroyRef, Signal, WritableSignal} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, timer } from 'rxjs';
import { catchError, filter, finalize, map, switchMap, tap, exhaustMap } from 'rxjs/operators';
import { StudentService } from '../../services/student.service';
import { UserContextService } from '../../user-context/user-context.service';
import { Student } from '../../entity/Student';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './student-detail.component.html',
  styleUrls: ['./student-detail.component.css'],
})
export class StudentDetailComponent implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly studentService: StudentService = inject(StudentService);
  private readonly userContext: UserContextService = inject(UserContextService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly isAdmin: Signal<boolean> = this.userContext.isAdmin;
  readonly student: WritableSignal<Student | null> = signal<Student | null>(null);
  readonly isLoading: WritableSignal<boolean> = signal<boolean>(true);
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        filter((id): id is number => Number.isInteger(id) && id > 0),

        tap(() => {
          this.student.set(null);
          this.errorMessage.set(null);
        }),

        switchMap((id) =>
          timer(0, 5000).pipe(
            exhaustMap((tick) => {
              const isPolling = tick > 0;

              if (!isPolling) {
                this.isLoading.set(true);
                this.errorMessage.set(null);
              }

              return this.studentService.getStudent(id).pipe(
                map(
                  (raw) =>
                    new Student(
                      Number(raw.isuId),
                      String(raw.fio ?? ''),
                      String(raw.stGroup ?? ''),
                      Number(raw.dormitoryNumber),
                      Number(raw.room),
                      String(raw.dateOfPlacement ?? ''),
                      Boolean(raw.isNotRussian),
                      raw.notes ? String(raw.notes) : ''
                    )
                ),

                catchError((err: HttpErrorResponse) => {
                  if (!isPolling) {
                    const msg =
                      err.status === 0
                        ? 'Не удалось связаться с сервером.'
                        : err.error?.error?.message ||
                        err.error?.message ||
                        'Студент не найден.';

                    this.errorMessage.set(msg);
                  }

                  return of(null);
                }),

                tap((loaded) => {
                  if (loaded !== null) {
                    this.student.set(loaded);
                    this.errorMessage.set(null);
                  }
                }),

                finalize(() => {
                  if (!isPolling) {
                    this.isLoading.set(false);
                  }
                })
              );
            })
          )
        ),

        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }
}
