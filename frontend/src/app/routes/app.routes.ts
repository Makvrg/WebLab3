import { Routes } from '@angular/router';

import { LoginPage } from '../pages/login/index.page';
import { RegisterPage } from '../pages/register/index.page';
import { ProfilePage } from '../pages/profile/index.page';
import { StudentListPage } from '../pages/students/(list)/index.page';
import { StudentDetailPage } from '../pages/students/(detail)/[id].page';
import { StudentFormComponent } from '../components/student-form/student-form.component';

import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { isAdminGuard } from './guards/is-admin.guard';

export const routes: Routes = [

  // 1. Публичные страницы
  {
    path: 'login',
    component: LoginPage,
    canActivate: [guestGuard],
    title: 'Вход',
  },

  {
    path: 'register',
    component: RegisterPage,
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
        component: ProfilePage,
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
            component: StudentListPage,
            title: 'Студенты',
          },
          // Создание студента
          {
            path: 'create',
            component: StudentFormPage,
            title: 'Создание студента',
            canActivate: [isAdminGuard],
            data: {
              formMode: 'create',
            },
          },
          // Обновление данных студента
          {
            path: ':id/edit',
            component: StudentFormPage,
            title: 'Редактирование студента',
            canActivate: [isAdminGuard],
            data: {
              formMode: 'edit',
            },
          },
          // Просмотр конкретного студента
          {
            path: ':id',
            component: StudentDetailPage,
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
