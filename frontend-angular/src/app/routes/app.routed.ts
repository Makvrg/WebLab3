import { Routes } from '@angular/router';

import { LoginComponent } from './pages/login/login.component.ts';
import { RegisterComponent } from './pages/register.component';
import { ProfileComponent } from './pages/profile.component';
import { StudentListComponent } from './pages/student-list.component';
import { StudentDetailComponent } from './pages/student-detail.component';
import { StudentFormComponent } from './pages/student-form.component';

import { MainLayoutComponent } from './components/layout/main-layout.component';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

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
        children: [
            // Профиль
            {
                path: 'profile',
                component: ProfileComponent,
                title: 'Профиль',

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
