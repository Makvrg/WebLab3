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
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CsvService } from '../../services/csv.service';
import {
  CsvImportResponse,
  CsvJobResult,
  CsvJobStatus,
  CsvSkippedRowError,
} from '../../entity/CsvJob';
import { getErrorMessage } from '../../utils/error.util';

const MAX_CSV_FILE_BYTES = 10 * 1024 * 1024; // 10 МБ (соответствует MAX_CSV_BYTES в node-backend)

@Component({
  selector: 'app-csv-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './csv-modal.component.html',
  styleUrls: ['./csv-modal.component.css'],
})
export class CsvModalComponent implements OnInit {
  private readonly csvService: CsvService = inject(CsvService);
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

  readonly canStartImport: Signal<boolean> = computed(
    () => this.selectedFile() !== null && this.status() !== 'UPLOADING'
  );

  readonly progressPercent: Signal<number> = computed(() => {
    const currentStatus = this.status();
    if (currentStatus === 'COMPLETED') {
      return 100;
    }
    if (currentStatus === 'UPLOADING') {
      return 50;
    }
    return 0;
  });

  readonly skippedErrors: Signal<CsvSkippedRowError[]> = computed(
    () => this.jobResult()?.errors ?? []
  );

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
  }

  onClose(): void {
    if (!this.canClose()) {
      return;
    }
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
    if (this.status() !== 'UPLOADING') {
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

    if (this.status() === 'UPLOADING') {
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

    this.errorMessage.set(null);
    this.jobResult.set(null);
    this.status.set('UPLOADING');

    this.csvService
      .importCsv(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: CsvImportResponse) => {
          const total = Number(response.totalRows ?? 0);
          const created = Number(response.saved ?? 0);
          const updated = Number(response.updated ?? 0);
          const skipped = Number(response.failed ?? 0);
          const parsedErrors = this.parseServerErrors(response.errors);

          this.jobResult.set({
            status: 'COMPLETED',
            total,
            processed: total,
            created,
            updated,
            skipped,
            errors: parsedErrors,
          });
          this.status.set('COMPLETED');

          if (created > 0 || updated > 0) {
            this.importCompleted.emit();
          }
        },
        error: (err: HttpErrorResponse) => {
          this.status.set('FAILED');
          this.errorMessage.set(this.extractImportError(err));
        },
      });
  }

  onReset(): void {
    if (this.status() === 'UPLOADING') {
      return;
    }
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
      this.errorMessage.set('Размер файла превышает максимально допустимые 10 МБ.');
      return;
    }

    this.errorMessage.set(null);
    this.jobResult.set(null);
    this.status.set('IDLE');
    this.selectedFile.set(file);
  }

  private parseServerErrors(rawErrors: unknown): CsvSkippedRowError[] {
    if (!Array.isArray(rawErrors)) {
      return [];
    }

    return rawErrors.map((entry: unknown) => {
      const text = String(entry ?? '').trim();
      const rowMatch = text.match(/^Строка\s+(\d+)(?:\s*\([^)]+\))?:\s*(.+)$/i);
      const rowNumber = rowMatch ? Number(rowMatch[1]) : 0;
      const reason = rowMatch ? rowMatch[2].trim() : text;
      const isuMatch = reason.match(/ИСУ\s+(\d{6})/i);

      return {
        row: rowNumber,
        isuId: isuMatch ? isuMatch[1] : null,
        reason,
      };
    });
  }

  private extractImportError(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Не удалось связаться с сервером.';
    }
    if (typeof err.error?.error === 'string' && err.error.error.trim().length > 0) {
      return err.error.error;
    }
    return getErrorMessage(err, 'Не удалось импортировать CSV-файл.');
  }
}
