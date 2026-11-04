import { defineEventHandler, getCookie, sendRedirect, getRequestURL } from 'h3';
import { Buffer } from 'node:buffer';

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const path = url.pathname;

  if (path.startsWith('/api') || path.startsWith('/_analog') || path.includes('.')) {
    return;
  }

  const token = getCookie(event, 'accessToken');
  let role: string | null = null;

  if (token) {
    try {
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
      if (payload.exp && payload.exp * 1000 > Date.now()) {
        role = payload.role;
      }
    } catch {
      role = null;
    }
  }

  const refreshToken = getCookie(event, 'refreshToken');
  const isAuth = !!role || !!refreshToken;
  const isAuthPage = path === '/login' || path === '/register';
  const isProtectedPage = path.startsWith('/students') || path === '/profile';
  const isAdminOnlyPage = path === '/students/create' || /^\/students\/\d+\/edit$/.test(path);

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
