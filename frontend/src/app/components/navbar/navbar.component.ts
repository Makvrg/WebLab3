import {Component, computed, DestroyRef, inject, Signal, signal, WritableSignal} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UserContextService } from '../../user-context/user-context.service';
import { Role } from '../../entity/Role';

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
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly isAuthenticated: Signal<boolean> = this.userContextService.isAuthenticated;
  readonly currentUserLogin: Signal<string> =
    computed(() => this.userContextService.user()?.login ?? '');
  readonly userRole: Signal<Role | null> =
    computed<Role | null>(() => this.userContextService.user()?.role ?? null);
  readonly isLoggingOut: WritableSignal<boolean> = signal<boolean>(false);

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
