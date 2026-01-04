import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Toast as ToastService, ToastMessage } from '../services/toast';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class Toast {
  toasts$!: Observable<ToastMessage[]>;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toasts$ = this.toastService.toasts$;
  }

  getClass(toast: ToastMessage): string {
    console.log(toast);
    return `toast-base toast-${toast.type}`;
  }
}
