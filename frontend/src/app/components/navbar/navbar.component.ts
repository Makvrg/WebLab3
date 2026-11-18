import {
  Component,
  DestroyRef,
  Signal,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, finalize, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UserContextService } from '../../user-context/user-context.service';
import { WebRtcService } from '../../services/webrtc.service';
import { Role } from '../../entity/Role';
import { WebRtcConnectionStatus } from '../../entity/RealtimeEvents';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent {
  private readonly userContextService: UserContextService = inject(UserContextService);
  private readonly authService: AuthService = inject(AuthService);
  private readonly webRtcService: WebRtcService = inject(WebRtcService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly isAuthenticated: Signal<boolean> = this.userContextService.isAuthenticated;
  readonly currentUserLogin: Signal<string> = computed(
    () => this.userContextService.user()?.login ?? ''
  );
  readonly userRole: Signal<Role | null> = computed<Role | null>(
    () => this.userContextService.user()?.role ?? null
  );
  readonly isLoggingOut: WritableSignal<boolean> = signal<boolean>(false);

  readonly webrtcStatus: Signal<WebRtcConnectionStatus> = this.webRtcService.status;

  readonly webrtcStatusLabel: Signal<string> = computed(() => {
    switch (this.webrtcStatus()) {
      case 'connected':
        return 'RT: подключено';
      case 'connecting':
        return 'RT: переподключение';
      case 'disconnected':
      default:
        return 'RT: отключено';
    }
  });

  private readonly currentUrl: Signal<string> = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly isAuthPage: Signal<boolean> = computed(() => {
    const url = this.currentUrl();
    return url.includes('/login') || url.includes('/register');
  });

  onLogout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);

    this.authService
      .logout()
      .pipe(
        finalize(() => {
          this.isLoggingOut.set(false);
          this.router.navigate(['/login']);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }
}
