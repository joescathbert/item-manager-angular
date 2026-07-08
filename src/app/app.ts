import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Navbar } from './navbar/navbar';
import { Toast } from './toast/toast';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Toast],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('item-manager');
  
  private router = inject(Router);
  // Control the navbar visibility with a reactive signal
  protected showNavbar = signal<boolean>(true);

  constructor() {
    // Listen for completion of route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Hide the navbar if the active URL path is 'shorts-test'
      const isShortsPage = event.urlAfterRedirects.includes('shorts-test');
      this.showNavbar.set(!isShortsPage);
    });
  }
}