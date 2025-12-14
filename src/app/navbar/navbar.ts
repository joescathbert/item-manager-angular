import { Component, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Auth as AuthService } from '../auth/auth';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  isLoginPage = false;
  isAddPage = false;

  @Output() sidebarToggle = new EventEmitter<void>();

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit() {
    this.isLoginPage = this.router.url.includes('/login');
    this.isAddPage = this.router.url.includes('/add');
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.isLoginPage = event.urlAfterRedirects.includes('/login');
        this.isAddPage = event.urlAfterRedirects.includes('/add');
      });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
