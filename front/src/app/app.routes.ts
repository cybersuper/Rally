import { Routes } from '@angular/router';

import { TimelinePageComponent } from './pages/timeline-page/timeline-page';
import { DiscoverPageComponent } from './pages/discover-page/discover-page';
import { ClubDetailPageComponent } from './pages/club-detail-page/club-detail-page';
import { LoginPageComponent } from './pages/login-page/login-page';
import { authGuard } from './guards/auth.guard';
import { CreateClubPageComponent } from './pages/create-club-page/create-club-page';
import { LfgDashboardPageComponent } from './pages/lfg-dashboard-page/lfg-dashboard-page';
import { ClubAdminPageComponent } from './pages/club-admin-page/club-admin-page';
import { clubAdminGuard } from './guards/club-admin.guard';
import { PostDetailPageComponent } from './pages/post-detail-page/post-detail-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'timeline' },
  { path: 'login', component: LoginPageComponent },
  { path: 'timeline', component: TimelinePageComponent, canActivate: [authGuard] },
  { path: 'create-club', component: CreateClubPageComponent, canActivate: [authGuard] },
  { path: 'dashboard/lfg', component: LfgDashboardPageComponent, canActivate: [authGuard] },
  { path: 'discover', component: DiscoverPageComponent },
  { path: 'clubs/:slug/admin', component: ClubAdminPageComponent, canActivate: [authGuard, clubAdminGuard] },
  { path: 'clubs/:slug/posts/:id', component: PostDetailPageComponent, canActivate: [authGuard] },
  { path: 'clubs/:slug', component: ClubDetailPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'timeline' },
];
