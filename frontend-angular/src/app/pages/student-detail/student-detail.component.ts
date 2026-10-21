import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, filter, finalize, map, switchMap, tap } from 'rxjs/operators';
import { StudentService, ApiError } from '../../services/student.service';
import { UserContextService } from '../../user-context/user-context.service';
import { Student } from '../../entity/Student';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './student-detail.component.html',
  styleUrls: ['./student-detail.component.css'],
})
export class StudentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly studentService = inject(StudentService);
  private readonly userContext = inject(UserContextService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isAdmin = this.userContext.isAdmin;
  readonly student = signal<Student | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => Boolean(id && id.trim())),
        tap(() => {
          this.isLoading.set(true);
          this.errorMessage.set(null);
        }),
        switchMap((id) =>
          this.studentService.getStudent(id).pipe(
            catchError((err: ApiError) => {
              this.errorMessage.set(err.message);
              return of(null);
            }),
            finalize(() => this.isLoading.set(false))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((loaded) => {
        this.student.set(loaded);
      });
  }
}
