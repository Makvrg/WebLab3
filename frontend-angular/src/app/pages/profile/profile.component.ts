import { Component, DestroyRef, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { UserContextService } from '../../user-context/user-context.service';
import { UserContext } from '../../user-context/user-context.model';
import { UserProfile } from '../../entity/UserProfile';
import { Role } from '../../entity/Role';

interface ProfileView {
  userId: number;
  login: string;
  email: string;
  role: Role;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  private readonly userContextService: UserContextService = inject(UserContextService);
  private readonly userService: UserService = inject(UserService);
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly user: WritableSignal<ProfileView | null> = signal<ProfileView | null>(null);
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);
  readonly isLoggingOut: WritableSignal<boolean> = signal<boolean>(false);

  ngOnInit(): void {
    this.loadProfile();
  }

  private loadProfile(): void {
    this.errorMessage.set(null);

    const context: UserContext | null = this.userContextService.user();

    if (!context) {
      this.errorMessage.set(
        'Не удалось получить данные авторизованного пользователя. Попробуйте войти снова.'
      );
      return;
    }

    this.userService
      .getUser(context.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile: UserProfile) => {
          this.user.set({
            userId: context.userId,
            login: profile.login || context.login,
            email: profile.email,
            role: profile.role ?? context.role,
          });
        },
        error: (err: unknown) => {
          this.errorMessage.set(
            this.getErrorMessage(
              err,
              'Не удалось загрузить профиль пользователя.'
            )
          );
        },
      });
  }

  onLogout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.errorMessage.set(null);

    this.authService
      .logout()
      .pipe(
        finalize(() => {
          this.isLoggingOut.set(false);
          this.router.navigate(['/login']);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        error: () => {},
      });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (typeof error !== 'object' || error === null) {
      return fallback;
    }

    const err = error as {
      message?: unknown;
      error?: unknown;
    };

    if (
      typeof err.error === 'object' &&
      err.error !== null &&
      'message' in err.error
    ) {
      const message = (err.error as { message?: unknown }).message;

      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error;
    }

    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message;
    }

    return fallback;
  }
}
