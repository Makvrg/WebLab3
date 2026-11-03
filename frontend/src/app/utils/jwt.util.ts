import { UserContext } from '../user-context/user-context.model';
import { Role } from '../entity/Role';

export function extractUserFromToken(token: string | null): UserContext | null {
  if (!token) {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    base64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);
    if (payload?.userId === undefined || !payload?.login || !payload?.role) {
      return null;
    }

    return {
      userId: Number(payload.userId),
      login: String(payload.login),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}
