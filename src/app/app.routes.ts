import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Home } from './home/home';
import { Add } from './add/add';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: 'add', component: Add, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];
