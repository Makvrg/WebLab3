import {
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  Signal,
  TransferState,
  WritableSignal,
  computed,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
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
import { AuditService } from '../../services/audit.service';
import { WebRtcService } from '../../services/webrtc.service';
import { UserContextService } from '../../user-context/user-context.service';
import {
  AuditAction,
  AuditEvent,
  AuditFilter,
  AuditPageResponse,
} from '../../entity/AuditEvent';
import { StudentRealtimeEvent } from '../../entity/RealtimeEvents';

interface NormalizedAuditFilter {
  action?: string;
  isuId?: number;
  actorLogin?: string;
}

export interface AuditFieldDiff {
  key: string;
  label: string;
  beforeValue: string;
  afterValue: string;
  changed: boolean;
}

const AUDIT_STATE_KEY = makeStateKey<AuditPageResponse>('AUDIT_LOGS_PAGE');

const STUDENT_FIELD_LABELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'fio', label: 'ФИО' },
  { key: 'stGroup', label: 'Группа' },
  { key: 'dormitoryNumber', label: 'Общежитие' },
  { key: 'room', label: 'Комната' },
  { key: 'dateOfPlacement', label: 'Дата заселения' },
  { key: 'isNotRussian', label: 'Иностранец' },
  { key: 'notes', label: 'Заметки' },
];

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, DatePipe],
  templateUrl: './index.page.html',
  styleUrls: ['./index.page.css'],
})
export default class AuditPage implements OnInit {
  private readonly auditService: AuditService = inject(AuditService);
  private readonly webRtcService: WebRtcService = inject(WebRtcService);
  private readonly userContext: UserContextService = inject(UserContextService);
  private readonly router: Router = inject(Router);
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly platformId: Object = inject(PLATFORM_ID);
  private readonly transferState: TransferState = inject(TransferState);

  readonly pageSize: number = 15;

  readonly filterForm = this.fb.group({
    action: [''],
    isuId: [''],
    actorLogin: [''],
  });

  readonly isLoading: WritableSignal<boolean> = signal<boolean>(false);
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);
  readonly currentPage: WritableSignal<number> = signal<number>(1);
  readonly total: WritableSignal<number> = signal<number>(0);
  readonly items: WritableSignal<AuditEvent[]> = signal<AuditEvent[]>([]);
  readonly expandedEventIds: WritableSignal<Set<string>> = signal<Set<string>>(new Set());

  readonly totalPages: Signal<number> = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize))
  );

  private readonly page$: BehaviorSubject<number> = new BehaviorSubject<number>(1);
  private readonly reload$: BehaviorSubject<void> = new BehaviorSubject<void>(undefined);
  private activeFilters: NormalizedAuditFilter = {};

  ngOnInit(): void {
    const isBrowser: boolean = isPlatformBrowser(this.platformId);
    if (isBrowser && !this.userContext.isAdmin()) {
      void this.router.navigate(['/students']);
      return;
    }

    let initialHydrated: boolean = false;

    if (isBrowser && this.transferState.hasKey(AUDIT_STATE_KEY)) {
      const cached = this.transferState.get(AUDIT_STATE_KEY, null);
      this.transferState.remove(AUDIT_STATE_KEY);
      if (cached) {
        this.items.set(cached.items ?? []);
        this.total.set(Number(cached.total ?? 0));
        this.currentPage.set(Number(cached.page ?? 1));
        initialHydrated = true;
      }
    }

    const filters$: Observable<NormalizedAuditFilter> = this.filterForm.valueChanges.pipe(
      startWith(this.filterForm.getRawValue()),
      debounceTime(300),
      map((raw) => this.normalizeFilters(raw)),
      distinctUntilChanged(
        (prev: NormalizedAuditFilter, curr: NormalizedAuditFilter) =>
          JSON.stringify(prev) === JSON.stringify(curr)
      ),
      tap((normalized: NormalizedAuditFilter) => {
        this.activeFilters = normalized;
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
          if (initialHydrated) {
            initialHydrated = false;
            return of(null);
          }

          this.isLoading.set(true);
          this.errorMessage.set(null);

          const query: AuditFilter = {
            page,
            pageSize: this.pageSize,
            ...filters,
          };

          return this.auditService.getAuditLogs(query).pipe(
            catchError((err: HttpErrorResponse) => {
              const msg =
                err.status === 0
                  ? 'Не удалось связаться с сервером журнала аудита.'
                  : err.error?.error?.message ||
                  err.error?.message ||
                  'Не удалось загрузить журнал действий.';
              this.errorMessage.set(msg);
              return of(null);
            }),
            tap((response: AuditPageResponse | null) => {
              if (!response) {
                return;
              }
              const normalizedItems: AuditEvent[] = (response.items ?? []).map((item) => ({
                ...item,
                isuId: Number(item.isuId),
              }));
              this.items.set(normalizedItems);
              this.total.set(Number(response.total ?? normalizedItems.length));

              if (!isBrowser && page === 1) {
                this.transferState.set(AUDIT_STATE_KEY, {
                  items: normalizedItems,
                  total: Number(response.total ?? normalizedItems.length),
                  page,
                  pageSize: this.pageSize,
                });
              }
            }),
            finalize(() => this.isLoading.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    if (isBrowser) {
      this.webRtcService.studentEvents$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((rtEvent: StudentRealtimeEvent) => {
          this.handleRealtimeEvent(rtEvent);
        });
    }
  }

  onResetFilters(): void {
    this.filterForm.reset({
      action: '',
      isuId: '',
      actorLogin: '',
    });
  }

  onRefresh(): void {
    this.reload$.next();
  }

  onPageChange(newPage: number): void {
    if (newPage < 1 || newPage > this.totalPages() || this.isLoading()) {
      return;
    }
    this.setPage(newPage);
  }

  toggleDetails(eventId: string): void {
    this.expandedEventIds.update((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  isExpanded(eventId: string): boolean {
    return this.expandedEventIds().has(eventId);
  }

  getActionLabel(action: AuditAction): string {
    switch (action) {
      case 'CREATE':
        return 'Создание';
      case 'UPDATE':
        return 'Изменение';
      case 'DELETE':
        return 'Удаление';
      case 'CSV_IMPORT':
        return 'Импорт CSV';
      default:
        return action;
    }
  }

  getActionBadgeClass(action: AuditAction): string {
    switch (action) {
      case 'CREATE':
        return 'audit-badge-create';
      case 'UPDATE':
        return 'audit-badge-update';
      case 'DELETE':
        return 'audit-badge-delete';
      case 'CSV_IMPORT':
        return 'audit-badge-import';
      default:
        return '';
    }
  }

  buildFieldDiffs(event: AuditEvent): AuditFieldDiff[] {
    const beforeNorm = this.normalizeSnapshot(event.before);
    const afterNorm = this.normalizeSnapshot(event.after);
    const diffs: AuditFieldDiff[] = [];

    for (const field of STUDENT_FIELD_LABELS) {
      const hasBefore = beforeNorm !== null && field.key in beforeNorm;
      const hasAfter = afterNorm !== null && field.key in afterNorm;

      if (!hasBefore && !hasAfter) {
        continue;
      }

      const beforeStr = hasBefore ? this.formatFieldValue(field.key, beforeNorm[field.key]) : '—';
      const afterStr = hasAfter ? this.formatFieldValue(field.key, afterNorm[field.key]) : '—';
      const changed =
        event.action === 'UPDATE' && hasBefore && hasAfter && beforeStr !== afterStr;

      diffs.push({
        key: field.key,
        label: field.label,
        beforeValue: beforeStr,
        afterValue: afterStr,
        changed,
      });
    }

    return diffs;
  }

  private handleRealtimeEvent(rtEvent: StudentRealtimeEvent): void {
    if (!rtEvent || !rtEvent.eventId) {
      return;
    }

    if (this.items().some((existing) => existing.eventId === rtEvent.eventId)) {
      return;
    }

    if (!this.matchesActiveFilters(rtEvent)) {
      return;
    }

    this.total.update((count: number) => count + 1);

    if (this.currentPage() === 1) {
      const mapped: AuditEvent = {
        eventId: rtEvent.eventId,
        timestamp: rtEvent.timestamp || new Date().toISOString(),
        action: rtEvent.action,
        source: rtEvent.source || 'UI',
        actor: rtEvent.actor || { userId: 0, login: 'system', role: 'ADMIN' },
        isuId: Number(rtEvent.isuId),
        before: (rtEvent.before as Record<string, unknown> | null) ?? null,
        after: (rtEvent.after as Record<string, unknown> | null) ?? null,
      };

      this.items.update((prev: AuditEvent[]) => [mapped, ...prev].slice(0, this.pageSize));
    }
  }

  private matchesActiveFilters(rtEvent: StudentRealtimeEvent): boolean {
    const { action, isuId, actorLogin } = this.activeFilters;

    if (action && rtEvent.action !== action) {
      return false;
    }

    if (isuId !== undefined && Number(rtEvent.isuId) !== isuId) {
      return false;
    }

    if (actorLogin) {
      const login = (rtEvent.actor?.login || '').toLowerCase();
      if (!login.includes(actorLogin.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  private normalizeSnapshot(
    snapshot: Record<string, unknown> | null | undefined
  ): Record<string, unknown> | null {
    if (!snapshot || typeof snapshot !== 'object') {
      return null;
    }

    const normalized: Record<string, unknown> = { ...snapshot };

    if (normalized['stGroup'] === undefined && normalized['group'] !== undefined) {
      normalized['stGroup'] = normalized['group'];
    }
    delete normalized['group'];
    delete normalized['studentId'];
    delete normalized['isDeleted'];

    return normalized;
  }

  private formatFieldValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    if (key === 'isNotRussian' || typeof value === 'boolean') {
      return Boolean(value) ? 'Да' : 'Нет';
    }

    if (key === 'dateOfPlacement' && Array.isArray(value) && value.length >= 3) {
      const year = String(value[0]).padStart(4, '0');
      const month = String(value[1]).padStart(2, '0');
      const day = String(value[2]).padStart(2, '0');
      return `${day}.${month}.${year}`;
    }

    if (key === 'dateOfPlacement' && typeof value === 'string') {
      const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
      }
    }

    return String(value);
  }

  private setPage(page: number): void {
    this.currentPage.set(page);
    this.page$.next(page);
  }

  private normalizeFilters(raw: {
    action?: string | null;
    isuId?: string | number | null;
    actorLogin?: string | null;
  }): NormalizedAuditFilter {
    const parsedIsu = raw.isuId !== null && raw.isuId !== '' ? Number(raw.isuId) : undefined;
    return {
      action: raw.action?.trim() || undefined,
      isuId:
        parsedIsu !== undefined && Number.isInteger(parsedIsu) && parsedIsu > 0
          ? parsedIsu
          : undefined,
      actorLogin: raw.actorLogin?.trim() || undefined,
    };
  }
}
