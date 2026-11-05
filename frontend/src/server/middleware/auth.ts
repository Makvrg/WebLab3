import {defineEventHandler, getCookie, sendRedirect, getRequestURL,
  EventHandlerRequest, H3Event} from 'h3';
import { Buffer } from 'node:buffer';

export default defineEventHandler(
  async (event: H3Event<EventHandlerRequest>): Promise<void> => {
    const url: URL = getRequestURL(event);
    const path: string = url.pathname;

    if (path.startsWith('/api') || path.startsWith('/_analog') || path.includes('.')) {
      return;
    }

    const token: string | undefined = getCookie(event, 'accessToken');
    let role: string | null = null;

    if (token) {
      try {
        const payloadBase64: string = token.split('.')[1];
        const payload =
          JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          role = payload.role;
        }
      } catch {
        role = null;
      }
    }

    const refreshToken: string | undefined = getCookie(event, 'refreshToken');
    const isAuth: boolean = !!role || !!refreshToken;
    const isAuthPage: boolean = path === '/login' || path === '/register';
    const isProtectedPage: boolean = path.startsWith('/students') || path === '/profile';
    const isAdminOnlyPage: boolean =
      path === '/students/create' || /^\/students\/\d+\/edit$/.test(path);

    if (path === '/') {
      await sendRedirect(event, isAuth ? '/students' : '/login', 302);
      return;
    }

    // Неавторизованный пользователь на закрытых маршрутах
    if (!isAuth && isProtectedPage) {
      await sendRedirect(event, '/login', 302);
      return;
    }

    // Авторизованный пользователь на страницах входа или регистрации
    if (isAuth && isAuthPage) {
      await sendRedirect(event, '/students', 302);
      return;
    }

    // Пользователь с ролью USER на страницах создания или редактирования
    if (isAuth && role !== 'ADMIN' && isAdminOnlyPage) {
      await sendRedirect(event, '/students', 302);
      return;
    }

    return;
  });
