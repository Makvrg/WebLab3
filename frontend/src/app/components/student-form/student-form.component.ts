import { Component, OnInit, inject, signal, DestroyRef, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { StudentService } from '../../services/student.service';
import { Student } from '../../entity/Student';
import {Observable} from 'rxjs';

@Component({
  selector: 'app-student-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './student-form.component.html',
  styleUrls: ['./student-form.component.css'],
})
export default class StudentFormComponent implements OnInit {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly studentService: StudentService = inject(StudentService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly isEditMode: WritableSignal<boolean> = signal<boolean>(false);
  readonly isLoadingData: WritableSignal<boolean> = signal<boolean>(false);
  readonly isSubmitting: WritableSignal<boolean> = signal<boolean>(false);
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);
  readonly fieldErrors: WritableSignal<Record<string, string>> = signal({});

  private editingIsuId: number | null = null;

  readonly studentForm = this.fb.nonNullable.group({
    fio: [
      '',
      [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(100),
        Validators.pattern(
          /^(?=.*[А-Яа-яЁёA-Za-z])[А-Яа-яЁёA-Za-z0-9]+(?: [А-Яа-яЁёA-Za-z0-9]+)*$/
        ),
      ],
    ],
    stGroup: ['', [Validators.required, Validators.pattern(/^[A-Z][34][1-4]\d{2}$/)]],
    isuId: [
      null as unknown as number,
      [Validators.required, Validators.min(100000), Validators.max(999999)],
    ],
    dormitoryNumber: [
      null as unknown as number,
      [Validators.required, Validators.min(1), Validators.max(4)],
    ],
    room: [
      null as unknown as number,
      [Validators.required, Validators.min(100), Validators.max(2000)],
    ],
    dateOfPlacement: ['', [Validators.required]],
    isNotRussian: [false],
    notes: ['', [Validators.maxLength(1000)]],
  });

  ngOnInit(): void {
    const idParam: string | null = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      const numericId: number = Number(idParam);
      if (Number.isInteger(numericId) && numericId > 0) {
        this.isEditMode.set(true);
        this.editingIsuId = numericId;
        this.loadStudent(numericId);
      }
    }
  }

  private loadStudent(id: number): void {
    this.isLoadingData.set(true);
    this.errorMessage.set(null);

    this.studentService
      .getStudent(id)
      .pipe(
        finalize(() => this.isLoadingData.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (student: Student) => {
          this.studentForm.patchValue({
            fio: student.fio,
            stGroup: student.stGroup,
            isuId: student.isuId,
            dormitoryNumber: student.dormitoryNumber,
            room: student.room,
            dateOfPlacement: student.dateOfPlacement,
            isNotRussian: student.isNotRussian,
            notes: student.notes ?? '',
          });
        },
        error: (err: HttpErrorResponse) => {
          const msg =
            err.status === 0
              ? 'Не удалось связаться с сервером.'
              : err.status === 404
                ? 'Редактируемый студент не найден.'
                : err.error?.error?.message || err.error?.message || 'Не удалось загрузить данные студента.';
          this.errorMessage.set(msg);
        },
      });
  }

  onSubmit(): void {
    if (this.studentForm.invalid || this.isSubmitting()) {
      this.studentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.fieldErrors.set({});

    const val = this.studentForm.getRawValue();
    const payload = new Student(
      Number(val.isuId),
      val.fio.trim(),
      val.stGroup.trim(),
      Number(val.dormitoryNumber),
      Number(val.room),
      val.dateOfPlacement,
      Boolean(val.isNotRussian),
      val.notes ? val.notes.trim() : ''
    );

    const action$: Observable<unknown> =
      this.isEditMode() && this.editingIsuId !== null
        ? this.studentService.updateStudent(this.editingIsuId, payload)
        : this.studentService.addStudent(payload);

    action$
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/students']);
        },
        error: (err: HttpErrorResponse) => {
          this.handleBackendError(err);
        },
      });
  }

  private handleBackendError(err: HttpErrorResponse): void {
    if (err.status === 0) {
      this.errorMessage.set('Не удалось связаться с сервером. Проверьте соединение.');
      return;
    }

    if (err.status === 409) {
      const msg = err.error?.message || 'Студент с таким номером ИСУ уже существует.';
      this.errorMessage.set(msg);
      this.studentForm.get('isuId')?.setErrors({ serverConflict: true });
      return;
    }

    if (err.status === 400 || err.status === 422) {
      const errorsObj: Record<string, string> = {};

      if (Array.isArray(err.error?.errors)) {
        for (const item of err.error.errors) {
          if (item.field) {
            errorsObj[item.field] = item.defaultMessage || item.message;
            this.studentForm.get(item.field)?.setErrors({ serverError: true });
          }
        }
      } else if (err.error?.fieldErrors && typeof err.error.fieldErrors === 'object') {
        for (const [field, message] of Object.entries(err.error.fieldErrors)) {
          errorsObj[field] = String(message);
          this.studentForm.get(field)?.setErrors({ serverError: true });
        }
      }

      this.fieldErrors.set(errorsObj);
      this.errorMessage.set(
        err.error?.message || 'Ошибка валидации данных. Проверьте заполнение формы.'
      );
      return;
    }

    this.errorMessage.set(
      err.error?.error?.message || err.error?.message || 'Ошибка при сохранении данных.'
    );
  }
}
