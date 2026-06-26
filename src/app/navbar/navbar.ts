import { Component, HostListener, ViewChild, ElementRef } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Auth as AuthService } from '../auth/auth';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  isLoginPage = false;
  isAddPage = false;
  isMenuOpen = false;

  // Query the DOM elements specifically
  @ViewChild('profileBtn') profileBtn!: ElementRef;
  @ViewChild('dropdownMenu') dropdownMenu!: ElementRef;

  constructor(private router: Router, private auth: AuthService) { }

  ngOnInit() {
    this.isLoginPage = this.router.url.includes('/login');
    this.isAddPage = this.router.url.includes('/add');
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.isLoginPage = event.urlAfterRedirects.includes('/login');
        this.isAddPage = event.urlAfterRedirects.includes('/add');
        this.isMenuOpen = false;
      });
  }

  toggleMenu(event: Event) {
    event.stopPropagation();
    this.isMenuOpen = !this.isMenuOpen;
  }

  // Closes the menu if you click anywhere except the button or the menu card itself
  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    const clickedTarget = event.target as HTMLElement;

    const clickedBtn = this.profileBtn?.nativeElement.contains(clickedTarget);
    const clickedMenu = this.dropdownMenu?.nativeElement.contains(clickedTarget);

    if (!clickedBtn && !clickedMenu) {
      this.isMenuOpen = false;
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  startDriveAuth() {
    window.open(`${environment.apiUrl}/gdrive/auth-url/`, '_blank');
    this.isMenuOpen = false;
  }
}
