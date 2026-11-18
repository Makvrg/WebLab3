import {
  Component,
  DestroyRef,
  EventEmitter,
  OnInit,
  Output,
  PLATFORM_ID,
  Signal,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription, fromEvent, of, timer } from 'rxjs';
import {
  catchError,
  exhaustMap,
  filter,
  finalize,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { CsvService } from '../../services/csv.service';
import { WebRtcService } from '../../services/webrtc.service';
import {
  CsvJobResult,
  CsvJobStatus,
  CsvSkippedRowError,
} from '../../entity/CsvJob';
import { CsvProgressEvent } from '../../entity/RealtimeEvents';
import { getErrorMessage } from '../../utils/error.util';

const MAX_CSV_FILE_BYTES = 50 * 1024 * 1024; // 50 МБ (соответствует client_max_body_size в Nginx)

@Component({
  selector: 'app-csv-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './csv-modal.component.html',
  styleUrls: ['./csv-modal.component.css'],
})
export class CsvModalComponent implements OnInit {
  private readonly csvService: CsvService = inject(CsvService);
  private readonly webRtcService: WebRtcService = inject(WebRtcService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly platformId: Object = inject(PLATFORM_ID);

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly importCompleted = new EventEmitter<void>();

  readonly selectedFile: WritableSignal<File | null> = signal<File | null>(null);
  readonly isDragOver: WritableSignal<boolean> = signal<boolean>(false);
  readonly status: WritableSignal<CsvJobStatus> = signal<CsvJobStatus>('IDLE');
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);
  readonly jobResult: WritableSignal<CsvJobResult | null> = signal<CsvJobResult | null>(null);

  readonly canClose: Signal<boolean> = computed(() => this.status() !== 'UPLOADING');

  readonly canStartImport: Signal<boolean> = computed(() => {
    const currentStatus = this.status();
    return (
      this.selectedFile() !== null &&
      currentStatus !== 'UPLOADING' &&
      currentStatus !== 'PROCESSING'
    );
  });

  readonly progressPercent: Signal<number> = computed(() => {
    const res = this.jobResult();
    if (!res) {
      return 0;
    }
    if (res.status === 'COMPLETED' && res.total === 0) {
      return 100;
    }
    if (res.total <= 0) {
      return 0;
    }
    const rawPercent = Math.round((res.processed / res.total) * 100);
    return Math.min(100, Math.max(0, rawPercent));
  });

  readonly skippedErrors: Signal<CsvSkippedRowError[]> = computed(
    () => this.jobResult()?.errors ?? []
  );

  private activeJobId: string | null = null;
  private completionNotified: boolean = false;
  private trackingSubscription: Subscription | null = null;
  private readonly stopTracking$: Subject<void> = new Subject<void>();

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        filter((event: KeyboardEvent) => event.key === 'Escape'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.canClose()) {
          this.onClose();
        }
      });

    this.destroyRef.onDestroy(() => {
      this.stopTracking();
    });
  }

  onClose(): void {
    if (!this.canClose()) {
      return;
    }
    this.stopTracking();
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && this.canClose()) {
      this.onClose();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    this.applyFile(file);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.status() !== 'UPLOADING' && this.status() !== 'PROCESSING') {
      this.isDragOver.set(true);
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (this.status() === 'UPLOADING' || this.status() === 'PROCESSING') {
      return;
    }

    const file =
      event.dataTransfer?.files && event.dataTransfer.files.length > 0
        ? event.dataTransfer.files[0]
        : null;
    this.applyFile(file);
  }

  onStartImport(): void {
    const file = this.selectedFile();
    if (!file || !this.canStartImport()) {
      return;
    }

    this.stopTracking();
    this.activeJobId = null;
    this.completionNotified = false;
    this.errorMessage.set(null);
    this.jobResult.set(null);
    this.status.set('UPLOADING');

    this.csvService
      .importCsv(file)
      .pipe(
        finalize(() => {
          if (this.status() === 'UPLOADING') {
            this.status.set('FAILED');
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: { jobId: string }) => {
          if (!response || !response.jobId) {
            this.status.set('FAILED');
            this.errorMessage.set('Сервер не вернул идентификатор фоновой задачи импорта.');
            return;
          }

          this.activeJobId = response.jobId;
          this.status.set('PROCESSING');
          this.jobResult.set({
            jobId: response.jobId,
            status: 'PROCESSING',
            total: 0,
            processed: 0,
            created: 0,
            skipped: 0,
            errors: [],
          });

          this.trackJobProgress(response.jobId);
        },
        error: (err: HttpErrorResponse) => {
          this.status.set('FAILED');
          this.errorMessage.set(
            getErrorMessage(err, 'Не удалось загрузить CSV-файл на сервер.')
          );
        },
      });
  }

  onReset(): void {
    if (this.status() === 'UPLOADING' || this.status() === 'PROCESSING') {
      return;
    }
    this.stopTracking();
    this.activeJobId = null;
    this.completionNotified = false;
    this.selectedFile.set(null);
    this.errorMessage.set(null);
    this.jobResult.set(null);
    this.status.set('IDLE');
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} Б`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} КБ`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
  }

  private applyFile(file: File | null): void {
    if (!file) {
      return;
    }

    const fileNameLower = file.name.toLowerCase();
    const isCsvExtension = fileNameLower.endsWith('.csv');
    const isCsvMime =
      file.type === '' ||
      file.type === 'text/csv' ||
      file.type === 'application/csv' ||
      file.type === 'application/vnd.ms-excel';

    if (!isCsvExtension && !isCsvMime) {
      this.errorMessage.set('Допускаются только файлы в формате CSV (.csv).');
      return;
    }

    if (file.size === 0) {
      this.errorMessage.set('Выбранный CSV-файл пуст.');
      return;
    }

    if (file.size > MAX_CSV_FILE_BYTES) {
      this.errorMessage.set('Размер файла превышает максимально допустимые 50 МБ.');
      return;
    }

    this.errorMessage.set(null);
    this.jobResult.set(null);
    this.status.set('IDLE');
    this.selectedFile.set(file);
  }

  private trackJobProgress(jobId: string): void {
    this.stopTracking();

    const sub = new Subscription();

    // 1. Основной канал прогресса в реальном времени через WebRTC DataChannel
    sub.add(
      this.webRtcService.csvProgress$
        .pipe(
          filter((event: CsvProgressEvent) => event.jobId === jobId),
          takeUntil(this.stopTracking$),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((event: CsvProgressEvent) => {
          this.applyProgressUpdate({
            jobId: event.jobId,
            status: event.status,
            total: Number(event.total ?? 0),
            processed: Number(event.processed ?? 0),
            created: Number(event.created ?? 0),
            skipped: Number(event.skipped ?? 0),
            errors: Array.isArray(event.errors) ? event.errors : [],
          });
        })
    );

    // 2. Резервный HTTP-поллинг каждые 2 секунды при отключённом WebRTC или в качестве страховки
    sub.add(
      timer(2000, 2000)
        .pipe(
          filter(() => this.activeJobId === jobId && this.status() === 'PROCESSING'),
          exhaustMap(() =>
            this.csvService.getJobStatus(jobId).pipe(
              catchError(() => of(null))
            )
          ),
          tap((res: CsvJobResult | null) => {
            if (!res || this.activeJobId !== jobId) {
              return;
            }
            this.applyProgressUpdate({
              jobId: res.jobId,
              status: res.status,
              total: Number(res.total ?? 0),
              processed: Number(res.processed ?? 0),
              created: Number(res.created ?? 0),
              skipped: Number(res.skipped ?? 0),
              errors: Array.isArray(res.errors) ? res.errors : [],
            });
          }),
          takeUntil(this.stopTracking$),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe()
    );

    this.trackingSubscription = sub;
  }

  private applyProgressUpdate(next: CsvJobResult): void {
    const current = this.jobResult();

    // Игнорируем устаревшие кадры, если состояние уже терминальное или прогресс меньше текущего
    if (current && (current.status === 'COMPLETED' || current.status === 'FAILED')) {
      return;
    }
    if (
      current &&
      next.status === 'PROCESSING' &&
      next.processed < current.processed
    ) {
      return;
    }

    this.jobResult.set(next);

    if (next.status === 'COMPLETED') {
      this.status.set('COMPLETED');
      this.stopTracking();

      if (next.created > 0 && !this.completionNotified) {
        this.completionNotified = true;
        this.importCompleted.emit();
      }
      return;
    }

    if (next.status === 'FAILED') {
      this.status.set('FAILED');
      this.stopTracking();
      if (!this.errorMessage()) {
        this.errorMessage.set('Обработка CSV-файла завершилась с ошибкой.');
      }
    }
  }

  private stopTracking(): void {
    this.stopTracking$.next();
    if (this.trackingSubscription) {
      this.trackingSubscription.unsubscribe();
      this.trackingSubscription = null;
    }
  }
}
