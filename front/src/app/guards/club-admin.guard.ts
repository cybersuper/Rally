import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth';

const managerRoles = new Set(['OWNER', 'ADMIN', 'MODERATOR']);

function hasManagerRole(user: any, slug: string): boolean {
  const clubs = Array.isArray(user?.clubs) ? user.clubs : [];
  const club = clubs.find((item: any) => item.slug === slug);

  return managerRoles.has(String(club?.membership_role ?? ''));
}

export const clubAdminGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const slug = route.paramMap.get('slug') ?? '';
  const currentUser = auth.user();

  if (currentUser && hasManagerRole(currentUser, slug)) {
    return true;
  }

  return auth.me().pipe(
    map(response => {
      if (hasManagerRole(response.user, slug)) {
        return true;
      }

      return router.parseUrl(`/clubs/${slug}`);
    }),
    catchError(() => of(router.parseUrl('/login')))
  );
};
