import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
  WritableSignal,
  Signal,
  TransferState,
  makeStateKey,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, Observable, of, timer } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  filter,
  finalize,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';
import { StudentService, StudentFilter } from '../../services/student.service';
import { UserContextService } from '../../user-context/user-context.service';
import { WebRtcService } from '../../services/webrtc.service';
import { CsvService } from '../../services/csv.service';
import { CsvModalComponent } from '../../components/csv-modal/csv-modal.component';
import { Student } from '../../entity/Student';
import { getErrorMessage } from '../../utils/error.util';

export type SortField = 'isuId' | 'fio' | 'stGroup' | 'dormitoryNumber' | 'room';
export type SortDirection = 'asc' | 'desc';

const STUDENTS_STATE_KEY = makeStateKey<Student[]>('STUDENTS_LIST');

@Component({
  selector: 'app-student-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, CsvModalComponent],
  templateUrl: './index.page.html',
  styleUrls: ['./index.page.css'],
})
export default class StudentListPage implements OnInit {
  private readonly studentService: StudentService = inject(StudentService);
  private readonly userContext: UserContextService = inject(UserContextService);
  private readonly webRtcService: WebRtcService = inject(WebRtcService);
  private readonly csvService: CsvService = inject(CsvService);
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly platformId: Object = inject(PLATFORM_ID);
  private readonly transferState: TransferState = inject(TransferState);

  readonly pageSize: number = 8;
  readonly isAdmin: Signal<boolean> = this.userContext.isAdmin;

  readonly filterForm = this.fb.group({
    fio: [''],
    isuId: [''],
    stGroup: [''],
    dormitoryNumber: [''],
    room: [''],
    dateOfPlacement: [''],
    isNotRussian: [''],
  });

  readonly showFilters: WritableSignal<boolean> = signal<boolean>(false);
  readonly isLoading: WritableSignal<boolean> = signal<boolean>(false);
  readonly isExportingCsv: WritableSignal<boolean> = signal<boolean>(false);
  readonly isCsvModalOpen: WritableSignal<boolean> = signal<boolean>(false);
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);
  readonly successMessage: WritableSignal<string | null> = signal<string | null>(null);
  readonly deletingId: WritableSignal<number | null> = signal<number | null>(null);

  readonly currentPage: WritableSignal<number> = signal<number>(this.getInitialPage());
  readonly sortField: WritableSignal<SortField> = signal<SortField>('isuId');
  readonly sortDirection: WritableSignal<SortDirection> = signal<SortDirection>('asc');

  private readonly rawStudents: WritableSignal<Student[]> = signal<Student[]>(
    this.getInitialStudents()
  );

  private readonly page$: BehaviorSubject<number> = new BehaviorSubject<number>(
    this.currentPage()
  );
  private readonly reload$: BehaviorSubject<void> = new BehaviorSubject<void>(undefined);

  readonly hasNextPage: Signal<boolean> = computed(
    () => this.rawStudents().length >= this.pageSize
  );

  readonly students: Signal<Student[]> = computed<Student[]>(() => {
    const list: Student[] = [...this.rawStudents()];
    const field: SortField = this.sortField();
    const dir: number = this.sortDirection() === 'asc' ? 1 : -1;

    return list.sort((a: Student, b: Student) => {
      const valA: number | string = a[field];
      const valB: number | string = b[field];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
      }
      return String(valA).localeCompare(String(valB), 'ru') * dir;
    });
  });

  ngOnInit(): void {
    const isBrowser: boolean = isPlatformBrowser(this.platformId);
    const filters$: Observable<StudentFilter> = this.filterForm.valueChanges.pipe(
      startWith(this.filterForm.getRawValue()),
      debounceTime(300),
      map((raw) => this.normalizeFilters(raw)),
      distinctUntilChanged(
        (prev: StudentFilter, curr: StudentFilter) =>
          JSON.stringify(prev) === JSON.stringify(curr)
      ),
      tap(() => {
        if (this.currentPage() !== 1) {
          this.setPage(1);
        }
      })
    );

    combineLatest([
      filters$,
      this.page$.pipe(distinctUntilChanged()),
      this.reload$,
    ])
      .pipe(
        switchMap(([filters, page]) => {
          const poll$ = isBrowser
            ? timer(0, 5000).pipe(
              filter(
                (tick: number) =>
                  tick === 0 || this.webRtcService.status() !== 'connected'
              )
            )
            : of(0);

          return poll$.pipe(
            exhaustMap((tick: number) => {
              const isPolling: boolean = tick > 0;

              if (!isPolling) {
                this.isLoading.set(true);
                this.errorMessage.set(null);
              }

              return this.studentService.getStudents(filters, page, isPolling).pipe(
                map((items) =>
                  (items ?? []).map(
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
                  )
                ),
                catchError((err: HttpErrorResponse): Observable<Student[] | null> => {
                  if (isPolling) {
                    return of(null);
                  }

                  const msg =
                    err.status === 0
                      ? 'Не удалось связаться с сервером.'
                      : err.error?.error?.message ||
                      err.error?.message ||
                      'Не удалось загрузить список студентов.';

                  this.errorMessage.set(msg);
                  return of([]);
                }),
                tap((data: Student[] | null) => {
                  if (data === null) {
                    return;
                  }

                  this.rawStudents.set(data);

                  if (!isBrowser && data.length > 0) {
                    this.transferState.set(STUDENTS_STATE_KEY, data);
                  }

                  if (isPolling) {
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
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    if (isBrowser) {
      this.webRtcService.studentEvents$
        .pipe(
          debounceTime(300),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => {
          this.studentService.invalidateCache();
        });
    }

    this.studentService.cacheInvalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.reload$.next();
      });
  }

  toggleFilters(): void {
    this.showFilters.update((v: boolean) => !v);
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

  onExportCsv(): void {
    if (!isPlatformBrowser(this.platformId) || this.isExportingCsv()) {
      return;
    }

    this.isExportingCsv.set(true);
    this.errorMessage.set(null);

    const activeFilters = this.normalizeFilters(this.filterForm.getRawValue());

    this.csvService
      .exportCsv(activeFilters)
      .pipe(
        finalize(() => this.isExportingCsv.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (blob: Blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = 'students.csv';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(objectUrl);

          this.flashSuccess('Список студентов экспортирован в CSV');
        },
        error: (err: HttpErrorResponse) => {
          void this.handleCsvExportError(err);
        },
      });
  }

  openCsvModal(): void {
    if (!this.isAdmin()) {
      return;
    }
    this.isCsvModalOpen.set(true);
  }

  closeCsvModal(): void {
    this.isCsvModalOpen.set(false);
  }

  onCsvImportCompleted(): void {
    this.studentService.invalidateCache();
    this.flashSuccess('Импорт CSV завершён');
  }

  onSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update((dir: 'asc' | 'desc') => (dir === 'asc' ? 'desc' : 'asc'));
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

  private async handleCsvExportError(err: HttpErrorResponse): Promise<void> {
    if (err.status === 0) {
      this.errorMessage.set('Не удалось связаться с сервером.');
      return;
    }

    if (err.error instanceof Blob) {
      try {
        const text = await err.error.text();
        const parsed = JSON.parse(text);
        const msg =
          parsed?.error?.message ||
          parsed?.message ||
          'Не удалось экспортировать список студентов в CSV.';
        this.errorMessage.set(msg);
        return;
      } catch {
      }
    }

    this.errorMessage.set(
      getErrorMessage(err, 'Не удалось экспортировать список студентов в CSV.')
    );
  }

  private setPage(page: number): void {
    this.currentPage.set(page);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pageNumber', String(page));
    }
    this.page$.next(page);
  }

  private getInitialPage(): number {
    if (typeof window === 'undefined') {
      return 1;
    }
    const saved = Number(localStorage.getItem('pageNumber'));
    return Number.isInteger(saved) && saved > 0 ? saved : 1;
  }

  private getInitialStudents(): Student[] {
    if (typeof window !== 'undefined' && this.transferState.hasKey(STUDENTS_STATE_KEY)) {
      const cached = this.transferState.get(STUDENTS_STATE_KEY, null);
      this.transferState.remove(STUDENTS_STATE_KEY);
      if (cached && Array.isArray(cached)) {
        return cached.map(
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
        );
      }
    }
    return [];
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
