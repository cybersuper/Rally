import { Injectable } from '@angular/core';
import Echo from 'laravel-echo';

@Injectable({
  providedIn: 'root',
})
export class EchoBridge {
  private echo: Echo<'reverb'> | null = null;

  get(): Echo<'reverb'> | null {
    return this.echo;
  }

  set(echo: Echo<'reverb'> | null): void {
    this.echo = echo;
  }
}
