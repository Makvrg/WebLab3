import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="card" style="text-align: center; margin-top: 40px; padding: 40px;">
      <h2>404 — Страница не найдена</h2>
      <p style="margin: 15px 0; color: var(--text-muted);">
        Запрошенный адрес не существует или был перемещен.
      </p>
      <a routerLink="/students" class="btn btn-primary">Вернуться к списку студентов</a>
    </div>
  `,
})
export default class NotFoundPage {}
