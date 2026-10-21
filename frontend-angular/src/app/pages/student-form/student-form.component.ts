import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { StudentService, ApiError } from '../../services/student.service';
import { Student } from '../../entity/Student';

@Component({
  selector: 'app-student-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './student-form.component.html',
  styleUrls: ['./student-form.component.css'],
})
export class StudentFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentService = inject(StudentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isEditMode = signal<boolean>(false);
  readonly isLoadingData = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  private editingIsuId: number | null = null;

  readonly studentForm = this.fb.nonNullable.group({
    fio: [
      '',
      [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(100),
        Validators.pattern(/^(?=.*[А-Яа-яЁёA-Za-z])[А-Яа-яЁёA-Za-z0-9]+(?: [А-Яа-яЁёA-Za-z0-9]+)*$/),
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
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      this.isEditMode.set(true);
      this.editingIsuId = Number(idParam);
      this.loadStudent(idParam);
    }
  }

  private loadStudent(id: string): void {
    this.isLoadingData.set(true);
    this.errorMessage.set(null);

    this.studentService
      .getStudent(id)
      .pipe(
        finalize(() => this.isLoadingData.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (student) => {
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
        error: (err: ApiError) => {
          this.errorMessage.set(err.message);
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

    const action$ =
      this.isEditMode() && this.editingIsuId !== null
        ? this.studentService.updateStudent(this.editingIsuId, payload)
        : this.studentService.createStudent(payload);

    action$
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/students']);
        },
        error: (err: ApiError) => {
          this.errorMessage.set(err.message);
        },
      });
  }
}
