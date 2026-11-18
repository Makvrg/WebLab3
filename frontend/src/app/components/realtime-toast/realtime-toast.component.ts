import {
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  Signal,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebRtcService } from '../../services/webrtc.service';
import { UserContextService } from '../../user-context/user-context.service';
import {
  StudentActionType,
  StudentRealtimeEvent,
} from '../../entity/RealtimeEvents';

export interface ToastItem {
  eventId: string;
  action: StudentActionType;
  title: string;
  accentClass: string;
  isuId: number;
  fio: string | null;
  actorLogin: string;
  sourceLabel: string;
  timestamp: string;
  canNavigate: boolean;
}

const MAX_VISIBLE_TOASTS = 4;
const AUTO_DISMISS_MS = 5_000;
const MAX_SEEN_EVENT_IDS = 200;

@Component({
  selector: 'app-realtime-toast',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './realtime-toast.component.html',
  styleUrls: ['./realtime-toast.component.css'],
})
export class RealtimeToastComponent implements OnInit {
  private readonly webRtcService: WebRtcService = inject(WebRtcService);
  private readonly userContext: UserContextService = inject(UserContextService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly platformId: Object = inject(PLATFORM_ID);

  readonly isAdmin: Signal<boolean> = this.userContext.isAdmin;
  readonly toasts: WritableSignal<ToastItem[]> = signal<ToastItem[]>([]);

  private readonly seenEventIds: Set<string> = new Set<string>();
  private readonly dismissTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.destroyRef.onDestroy(() => {
      for (const timer of this.dismissTimers.values()) {
        clearTimeout(timer);
      }
      this.dismissTimers.clear();
    });

    this.webRtcService.studentEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: StudentRealtimeEvent) => {
        this.handleIncomingEvent(event);
      });
  }

  dismiss(eventId: string): void {
    const timer = this.dismissTimers.get(eventId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.dismissTimers.delete(eventId);
    }

    this.toasts.update((items: ToastItem[]) =>
      items.filter((item: ToastItem) => item.eventId !== eventId)
    );
  }

  private handleIncomingEvent(event: StudentRealtimeEvent): void {
    if (!this.isAdmin() || !event || !event.eventId) {
      return;
    }

    if (this.seenEventIds.has(event.eventId)) {
      return;
    }

    this.rememberEventId(event.eventId);

    const toast: ToastItem = this.mapEventToToast(event);

    this.toasts.update((prev: ToastItem[]) => {
      const updated: ToastItem[] = [toast, ...prev];
      if (updated.length > MAX_VISIBLE_TOASTS) {
        const evicted: ToastItem[] = updated.slice(MAX_VISIBLE_TOASTS);
        for (const item of evicted) {
          const timer = this.dismissTimers.get(item.eventId);
          if (timer !== undefined) {
            clearTimeout(timer);
            this.dismissTimers.delete(item.eventId);
          }
        }
        return updated.slice(0, MAX_VISIBLE_TOASTS);
      }
      return updated;
    });

    const timer = setTimeout(() => {
      this.dismiss(toast.eventId);
    }, AUTO_DISMISS_MS);
    this.dismissTimers.set(toast.eventId, timer);
  }

  private mapEventToToast(event: StudentRealtimeEvent): ToastItem {
    const meta = this.getActionMeta(event.action);
    const numericIsuId: number = Number(event.isuId);
    const hasValidIsu: boolean = Number.isInteger(numericIsuId) && numericIsuId > 0;

    return {
      eventId: event.eventId,
      action: event.action,
      title: meta.title,
      accentClass: meta.accentClass,
      isuId: numericIsuId,
      fio: this.extractFio(event),
      actorLogin: event.actor?.login || 'system',
      sourceLabel: event.source === 'CSV_IMPORT' ? 'CSV' : 'UI',
      timestamp: event.timestamp || new Date().toISOString(),
      canNavigate: event.action !== 'DELETE' && hasValidIsu,
    };
  }

  private getActionMeta(action: StudentActionType): {
    title: string;
    accentClass: string;
  } {
    switch (action) {
      case 'CREATE':
        return { title: 'Добавлен студент', accentClass: 'toast-create' };
      case 'UPDATE':
        return { title: 'Обновлён студент', accentClass: 'toast-update' };
      case 'DELETE':
        return { title: 'Удалён студент', accentClass: 'toast-delete' };
      case 'CSV_IMPORT':
        return { title: 'Импорт CSV', accentClass: 'toast-import' };
      default:
        return { title: 'Изменение данных', accentClass: 'toast-update' };
    }
  }

  private extractFio(event: StudentRealtimeEvent): string | null {
    const afterFio = event.after?.['fio'];
    if (typeof afterFio === 'string' && afterFio.trim().length > 0) {
      return afterFio.trim();
    }

    const beforeFio = event.before?.['fio'];
    if (typeof beforeFio === 'string' && beforeFio.trim().length > 0) {
      return beforeFio.trim();
    }

    return null;
  }

  private rememberEventId(eventId: string): void {
    this.seenEventIds.add(eventId);
    if (this.seenEventIds.size > MAX_SEEN_EVENT_IDS) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest !== undefined) {
        this.seenEventIds.delete(oldest);
      }
    }
  }
}
