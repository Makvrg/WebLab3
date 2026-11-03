import {
  Component,
  DestroyRef,
  inject,
  signal, WritableSignal,
} from '@angular/core';

import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { Role } from '../../entity/Role';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly authService: AuthService = inject(AuthService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly isSubmitting: WritableSignal<boolean> = signal<boolean>(false);
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);
  readonly successMessage: WritableSignal<string | null> = signal<string | null>(null);

  private readonly passwordsMatchValidator: ValidatorFn = (
    control: AbstractControl
  ): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword
      ? null
      : { passwordMismatch: true };
  };

  readonly registerForm = this.fb.nonNullable.group(
    {
      login: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
          Validators.pattern(/^[A-Za-z0-9_.-]{3,50}$/),
        ],
      ],
      email: [
        '',
        [
          Validators.required,
          Validators.email,
        ],
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
        ],
      ],
      confirmPassword: [
        '',
        [Validators.required],
      ],
      role: [
        'USER' as Role,
        [Validators.required],
      ],
    },
    {
      validators: this.passwordsMatchValidator,
    }
  );

  onSubmit(): void {
    if (this.registerForm.invalid || this.isSubmitting()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { login, email, password, role } =
      this.registerForm.getRawValue();

    // Не отправляем confirmPassword на сервер.
    const userData = {
      login: login.trim(),
      email: email.trim(),
      password,
      role,
    };

    this.authService
      .register(userData)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.successMessage.set(
            'Регистрация прошла успешно. Теперь вы можете войти в систему.'
          );

          this.registerForm.reset({
            login: '',
            email: '',
            password: '',
            confirmPassword: '',
            role: 'USER',
          });
        },
        error: (err: unknown) => {
          this.errorMessage.set(
            this.getErrorMessage(
              err,
              'Не удалось зарегистрировать пользователя. Попробуйте ещё раз.'
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
