import { Routes } from '@angular/router';

import { LoginComponent } from '../pages/login/login.component';
import { RegisterComponent } from '../pages/register/register.component';
import { ProfileComponent } from '../pages/profile/profile.component';
import { StudentListComponent } from '../pages/student-list/student-list.component';
import { StudentDetailComponent } from '../pages/student-detail/student-detail.component';
import { StudentFormComponent } from '../pages/student-form/student-form.component';

import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { isAdminGuard } from './guards/is-admin.guard';

export const routes: Routes = [

  // 1. Публичные страницы
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
    title: 'Вход',
  },

  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [guestGuard],
    title: 'Регистрация',
  },

  // 2. Начальный URL
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'students',
  },

  // 3. Защищённая часть приложения
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      // Профиль
      {
        path: 'profile',
        component: ProfileComponent,
        title: 'Профиль',
      },
      // Работа со студентами
      {
        path: 'students',
        children: [
          // Список студентов
          {
            path: '',
            pathMatch: 'full',
            component: StudentListComponent,
            title: 'Студенты',
          },
          // Создание студента
          {
            path: 'create',
            component: StudentFormComponent,
            title: 'Создание студента',
            canActivate: [isAdminGuard],
            data: {
              formMode: 'create',
            },
          },
          // Обновление данных студента
          {
            path: ':id/edit',
            component: StudentFormComponent,
            title: 'Редактирование студента',
            canActivate: [isAdminGuard],
            data: {
              formMode: 'edit',
            },
          },
          // Просмотр конкретного студента
          {
            path: ':id',
            component: StudentDetailComponent,
            title: 'Карточка студента',
          },
        ],
      },
    ],
  },

  // 4. Неизвестные маршруты
  {
    path: '**',
    redirectTo: '/students',
  },
];
