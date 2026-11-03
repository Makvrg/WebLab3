import {Component, DestroyRef, inject, signal, WritableSignal} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly isSubmitting: WritableSignal<boolean> = signal<boolean>(false);
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);
  readonly successMessage: WritableSignal<string | null> = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    login: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(/^[A-Za-z0-9_.-]{3,50}$/),
      ],
    ],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
      ],
    ],
  });

  onSubmit(): void {
    if (this.loginForm.invalid || this.isSubmitting()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { login, password } = this.loginForm.getRawValue();

    this.authService
      .login(login.trim(), password)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/students']);
        },
        error: (err: unknown) => {
          this.errorMessage.set(
            this.getErrorMessage(
              err,
              'Не удалось войти в систему. Проверьте логин и пароль.'
            )
          );
        },
      });
  }


  private getErrorMessage(error: unknown, fallback: string): string {
    if (typeof error !== 'object' || error === null) {
      return fallback;
    }

    const err = error as {
      error?: unknown;
    };

    if (typeof err.error !== 'object' || err.error === null) {
      return fallback;
    }

    const response = err.error as {
      error?: unknown;
    };

    if (typeof response.error !== 'object' || response.error === null) {
      return fallback;
    }

    const apiError = response.error as {
      message?: unknown;
    };

    if (
      typeof apiError.message === 'string' &&
      apiError.message.trim()
    ) {
      return apiError.message;
    }

    return fallback;
  }
}
