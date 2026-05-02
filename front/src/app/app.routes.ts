import { Routes } from '@angular/router';

import { TimelinePageComponent } from './pages/timeline-page/timeline-page';
import { DiscoverPageComponent } from './pages/discover-page/discover-page';
import { ClubDetailPageComponent } from './pages/club-detail-page/club-detail-page';
import { LoginPageComponent } from './pages/login-page/login-page';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'timeline' },
  { path: 'login', component: LoginPageComponent },
  { path: 'timeline', component: TimelinePageComponent, canActivate: [authGuard] },
  { path: 'discover', component: DiscoverPageComponent },
  { path: 'clubs/:slug', component: ClubDetailPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'timeline' },
];
