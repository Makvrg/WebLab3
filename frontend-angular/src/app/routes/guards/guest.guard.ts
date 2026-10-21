import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserContextService } from '../../user-context/user-context.service';
import { UserContext } from '../../user-context/user-context.model';

export const guestGuard: CanActivateFn = (snapshot, state) => {
  const userContextService: UserContextService = inject(UserContextService);
  const router: Router = inject(Router);

  if (userContextService.isAuthenticated()) {
    return router.createUrlTree(['/students']);
  }
  return true
};
