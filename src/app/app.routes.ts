import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Home } from './home/home';
import { ItemDetail } from './item-detail/item-detail';
import { Add } from './add/add';
import { Edit } from './edit/edit';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: 'item/:id', component: ItemDetail, canActivate: [authGuard] },
  { path: 'add', component: Add, canActivate: [authGuard] },
  { path: 'edit/:id', component: Edit, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];
