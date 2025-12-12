import { Component } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth as AuthService } from  '../auth'

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  loginForm: FormGroup;
  errorMessage = '';

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, private cdr: ChangeDetectorRef) {
    this.loginForm = this.fb.group({
      username: [''],
      password: [''],
    });
  }

  login() {
    const { username, password } = this.loginForm.value;

    this.auth.login(username, password).subscribe({
      next: () => {
        this.auth.saveToken(username, password);
        this.router.navigate(['/home']);
      },
      error: () => {
        this.errorMessage = 'Invalid credentials';
        this.cdr.detectChanges();
      },
    });
  }
}
