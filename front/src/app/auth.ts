import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

interface LoginResponse {
  user: any;
  token: string;
}

interface RegisterResponse {
  user: any;
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  user = signal<any | null>(null);
  token = signal<string | null>(localStorage.getItem('rally_token'));

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/api/login', { email, password }).pipe(
      tap(response => {
        localStorage.setItem('rally_token', response.token);
        this.token.set(response.token);
        this.user.set(response.user);
      })
    );
  }

  register(name: string, email: string, password: string) {
    return this.http
      .post<RegisterResponse>('/api/register', { name, email, password })
      .pipe(
        tap(response => {
          localStorage.setItem('rally_token', response.token);
          this.token.set(response.token);
          this.user.set(response.user);
        })
      );
  }

  isLoggedIn(): boolean {
    return !!this.token();
  }

  me() {
    return this.http.get<{ user: any }>('/api/me').pipe(
      tap(response => {
        this.user.set(response.user);
      })
    );
  }

  logout() {
    return this.http.post('/api/logout', {}).pipe(
      tap(() => {
        localStorage.removeItem('rally_token');
        this.token.set(null);
        this.user.set(null);
      })
    );
  }
}