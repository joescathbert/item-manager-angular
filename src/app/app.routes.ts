import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Home } from './home/home';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];
