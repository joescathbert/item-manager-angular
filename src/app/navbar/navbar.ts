import { Component, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Auth as AuthService } from '../auth/auth';

@Component({
  selector: 'app-navbar',
  imports: [],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  isLoginPage = false;

  @Output() sidebarToggle = new EventEmitter<void>();

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit() {
    this.isLoginPage = this.router.url.includes('/login');
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.isLoginPage = event.urlAfterRedirects.includes('/login');
      });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
