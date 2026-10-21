import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';
import { StudentService, StudentFilter } from '../../services/student.service';
import { UserContextService } from '../../user-context/user-context.service';
import { Student } from '../../entity/Student';

export type SortField = 'isuId' | 'fio' | 'stGroup' | 'dormitoryNumber' | 'room';
export type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-student-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './student-list.component.html',
  styleUrls: ['./student-list.component.css'],
})
export class StudentListComponent implements OnInit {
  private readonly studentService = inject(StudentService);
  private readonly userContext = inject(UserContextService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = 8;
  readonly isAdmin = this.userContext.isAdmin;

  readonly filterForm = this.fb.group({
    fio: [''],
    isuId: [''],
    stGroup: [''],
    dormitoryNumber: [''],
    room: [''],
    dateOfPlacement: [''],
    isNotRussian: [''],
  });

  readonly showFilters = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly currentPage = signal<number>(this.getInitialPage());
  readonly sortField = signal<SortField>('isuId');
  readonly sortDirection = signal<SortDirection>('asc');

  private readonly rawStudents = signal<Student[]>([]);
  private readonly page$ = new BehaviorSubject<number>(this.currentPage());
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly hasNextPage = computed(() => this.rawStudents().length >= this.pageSize);

  readonly students = computed<Student[]>(() => {
    const list = [...this.rawStudents()];
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    return list.sort((a, b) => {
      const valA = a[field];
      const valB = b[field];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
      }
      return String(valA).localeCompare(String(valB), 'ru') * dir;
    });
  });

  ngOnInit(): void {
    const filters$ = this.filterForm.valueChanges.pipe(
      startWith(this.filterForm.getRawValue()),
      debounceTime(300),
      map((raw) => this.normalizeFilters(raw)),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      tap(() => {
        if (this.currentPage() !== 1) {
          this.setPage(1);
        }
      })
    );

    combineLatest([filters$, this.page$.pipe(distinctUntilChanged()), this.reload$])
      .pipe(
        tap(() => {
          this.isLoading.set(true);
          this.errorMessage.set(null);
        }),
        switchMap(([filters, page]) =>
          this.studentService.getStudents(filters, page).pipe(
            map((items) => (items ?? []).map((raw) => new Student(
              Number(raw.isuId),
              String(raw.fio ?? ''),
              String(raw.stGroup ?? ''),
              Number(raw.dormitoryNumber),
              Number(raw.room),
              String(raw.dateOfPlacement ?? ''),
              Boolean(raw.isNotRussian),
              raw.notes ? String(raw.notes) : ''
            ))),
            catchError((err: HttpErrorResponse) => {
              const msg =
                err.status === 0
                  ? 'Не удалось связаться с сервером.'
                  : err.error?.error?.message || err.error?.message || 'Не удалось загрузить список студентов.';
              this.errorMessage.set(msg);
              return of([] as Student[]);
            }),
            finalize(() => this.isLoading.set(false))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data) => {
        this.rawStudents.set(data);
      });
  }

  toggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  onResetFilters(): void {
    this.filterForm.reset({
      fio: '',
      isuId: '',
      stGroup: '',
      dormitoryNumber: '',
      room: '',
      dateOfPlacement: '',
      isNotRussian: '',
    });
  }

  onSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  onPageChange(newPage: number): void {
    if (newPage < 1 || this.isLoading()) return;
    this.setPage(newPage);
  }

  onDelete(isuId: number): void {
    if (this.deletingId() !== null) return;

    this.deletingId.set(isuId);
    this.errorMessage.set(null);

    this.studentService
      .deleteStudent(isuId)
      .pipe(
        finalize(() => this.deletingId.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.flashSuccess('Студент успешно удален');
          this.reload$.next();
        },
        error: (err: HttpErrorResponse) => {
          const msg =
            err.status === 0
              ? 'Не удалось связаться с сервером.'
              : err.error?.error?.message || err.error?.message || 'Не удалось удалить студента.';
          this.errorMessage.set(msg);
        },
      });
  }

  private setPage(page: number): void {
    this.currentPage.set(page);
    localStorage.setItem('pageNumber', String(page));
    this.page$.next(page);
  }

  private getInitialPage(): number {
    const saved = Number(localStorage.getItem('pageNumber'));
    return Number.isInteger(saved) && saved > 0 ? saved : 1;
  }

  private normalizeFilters(raw: any): StudentFilter {
    return {
      fio: raw.fio?.trim() || undefined,
      isuId: raw.isuId ? Number(raw.isuId) : undefined,
      stGroup: raw.stGroup?.trim() || undefined,
      dormitoryNumber: raw.dormitoryNumber ? Number(raw.dormitoryNumber) : undefined,
      room: raw.room ? Number(raw.room) : undefined,
      dateOfPlacement: raw.dateOfPlacement || undefined,
      isNotRussian:
        raw.isNotRussian === 'true'
          ? true
          : raw.isNotRussian === 'false'
            ? false
            : undefined,
    };
  }

  private flashSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      if (this.successMessage() === msg) {
        this.successMessage.set(null);
      }
    }, 3000);
  }
}
