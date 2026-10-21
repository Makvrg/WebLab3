import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserContextService } from '../../user-context/user-context.service';
import { UserContext } from '../../user-context/user-context.model';

export const isAdminGuard: CanActivateFn = (snapshot, state) => {
  const userContextService: UserContextService = inject(UserContextService);
  const router: Router = inject(Router);

  const userContext: UserContext | null = userContextService.user

  if (userContext && userContext.userId &&
    userContext.login && userContext.email &&
    userContext.role === "ADMIN"
  ) {
    return true;
  }

  return router.createUrlTree(['/students'])
};
