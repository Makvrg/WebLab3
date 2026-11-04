import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserContextService } from '../user-context/user-context.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="card" style="text-align: center; margin-top: 40px; padding: 40px;">
      <h2>404 - Страница не найдена :(</h2>
      <p style="margin: 15px 0; color: var(--text-muted);">
        Запрошенный адрес не существует.
      </p>
      @if (isAuthenticated()) {
        <a routerLink="/students" class="btn btn-primary">Вернуться к списку студентов</a>
      } @else {
        <a routerLink="/login" class="btn btn-primary">Перейти ко входу</a>
      }
    </div>
  `,
})
export default class NotFoundPage {
  private readonly userContext = inject(UserContextService);
  readonly isAuthenticated = this.userContext.isAuthenticated;
}
