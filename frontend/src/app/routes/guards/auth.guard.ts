import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserContextService } from '../../user-context/user-context.service';
import { UserContext } from '../../user-context/user-context.model';

export const authGuard: CanActivateFn = (snapshot, state) => {
  const userContextService: UserContextService = inject(UserContextService);
  const router: Router = inject(Router);

  if (userContextService.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};
