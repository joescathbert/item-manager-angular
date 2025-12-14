import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Logger {
  // --- Core Control Method ---

  /**
   * Logs a message only if environment.loggingEnabled is true.
   * @param message The message or data to log.
   * @param optionalParams Optional additional arguments for console.log.
   */
  log(message: any, ...optionalParams: any[]): void {
    if (true /* replace with environment.loggingEnabled */) {
      console.log(message, ...optionalParams);
    }
  }

  // --- Optional: Wrapper for other console methods ---

  warn(message: any, ...optionalParams: any[]): void {
    if (true /* replace with environment.loggingEnabled */) {
      console.warn(message, ...optionalParams);
    }
  }

  error(message: any, ...optionalParams: any[]): void {
    // You might want to keep errors always ON, regardless of the flag
    console.error(message, ...optionalParams);
  }
}
