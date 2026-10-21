import { Routes } from '@angular/router';

import { LoginComponent } from './components/pages/login.component';
import { RegisterComponent } from './components/pages/register.component';
import { ProfileComponent } from './components/pages/profile.component';
import { StudentListComponent } from './components/pages/student-list.component';
import { StudentDetailComponent } from './components/pages/student-detail.component';
import { StudentFormComponent } from './components/pages/student-form.component';

import { MainLayoutComponent } from './components/layout/main-layout.component';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

// Эти три компонента нужно создать отдельно.
import { ForbiddenComponent } from './components/pages/forbidden.component';
import { NotFoundComponent } from './components/pages/not-found.component';
import { ServerErrorComponent } from './components/pages/server-error.component';

export const routes: Routes = [
    // =========================================
    // 1. Публичные страницы
    // =========================================

    {
        path: 'login',
        component: LoginComponent,
        canActivate: [guestGuard],
        title: 'Вход',
        data: {
            pageType: 'public',
        },
    },

    {
        path: 'register',
        component: RegisterComponent,
        canActivate: [guestGuard],
        title: 'Регистрация',
        data: {
            pageType: 'public',
        },
    },

    // =========================================
    // 2. Служебные страницы
    // =========================================

    {
        path: 'forbidden',
        component: ForbiddenComponent,
        title: 'Доступ запрещён',
    },

    {
        path: 'not-found',
        component: NotFoundComponent,
        title: 'Страница не найдена',
    },

    {
        path: 'error',
        component: ServerErrorComponent,
        title: 'Ошибка приложения',
    },

    // =========================================
    // 3. Начальный URL
    // =========================================

    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'students',
    },

    // =========================================
    // 4. Защищённая часть приложения
    // =========================================

    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        canActivateChild: [authGuard],

        children: [
            // -------------------------------------
            // Профиль
            // -------------------------------------

            {
                path: 'profile',
                component: ProfileComponent,
                title: 'Мой профиль',

                data: {
                    breadcrumb: 'Профиль',
                },
            },

            // -------------------------------------
            // Работа со студентами
            // -------------------------------------

            {
                path: 'students',
                canActivateChild: [roleGuard],

                children: [
                    // GET /students
                    {
                        path: '',
                        pathMatch: 'full',
                        component: StudentListComponent,
                        title: 'Студенты',

                        data: {
                            roles: ['ADMIN', 'TEACHER'],
                            breadcrumb: 'Студенты',
                        },
                    },

                    // GET /students/new
                    {
                        path: 'new',
                        component: StudentFormComponent,
                        title: 'Создать студента',

                        data: {
                            roles: ['ADMIN', 'TEACHER'],
                            formMode: 'create',
                            breadcrumb: 'Создание студента',
                        },
                    },

                    // GET /students/42/edit
                    {
                        path: ':id/edit',
                        component: StudentFormComponent,
                        title: 'Редактировать студента',

                        data: {
                            roles: ['ADMIN', 'TEACHER'],
                            formMode: 'edit',
                            breadcrumb: 'Редактирование студента',
                        },
                    },

                    // GET /students/42
                    {
                        path: ':id',
                        component: StudentDetailComponent,
                        title: 'Карточка студента',

                        data: {
                            roles: ['ADMIN', 'TEACHER'],
                            breadcrumb: 'Карточка студента',
                        },
                    },
                ],
            },
        ],
    },

    // =========================================
    // 5. Неизвестные маршруты
    // =========================================

    {
        path: '**',
        redirectTo: 'not-found',
    },
];