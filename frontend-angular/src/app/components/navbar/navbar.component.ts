import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
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
  private readonly userContextService = inject(UserContextService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isAuthenticated = this.userContextService.isAuthenticated;
  readonly currentUserLogin = computed(() => this.userContextService.user()?.login ?? '');
  readonly userRole = computed<Role | null>(() => this.userContextService.user()?.role ?? null);
  readonly isLoggingOut = signal<boolean>(false);

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
