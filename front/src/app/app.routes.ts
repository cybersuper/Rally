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
import { NotificationsPageComponent } from './pages/notifications-page/notifications-page';
import { ProfilePageComponent } from './pages/profile-page/profile-page';
import { SettingsPageComponent } from './pages/settings-page/settings-page';
import { ChatPageComponent } from './pages/chat-page/chat-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'timeline' },
  { path: 'login', component: LoginPageComponent },
  { path: 'timeline', component: TimelinePageComponent, canActivate: [authGuard] },
  { path: 'create-club', component: CreateClubPageComponent, canActivate: [authGuard] },
  { path: 'dashboard/lfg', component: LfgDashboardPageComponent, canActivate: [authGuard] },
  { path: 'notifications', component: NotificationsPageComponent, canActivate: [authGuard] },
  { path: 'profile/:username', component: ProfilePageComponent, canActivate: [authGuard] },
  { path: 'profiles/:username', component: ProfilePageComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsPageComponent, canActivate: [authGuard] },
  { path: 'chat', component: ChatPageComponent, canActivate: [authGuard] },
  { path: 'chat/:id', component: ChatPageComponent, canActivate: [authGuard] },
  { path: 'discover', component: DiscoverPageComponent },
  { path: 'clubs/:slug/admin', component: ClubAdminPageComponent, canActivate: [authGuard, clubAdminGuard] },
  { path: 'clubs/:slug/posts/:id', component: PostDetailPageComponent, canActivate: [authGuard] },
  { path: 'clubs/:slug', component: ClubDetailPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'timeline' },
];
