// src/app/app.config.ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { MAT_PAGINATOR_DEFAULT_OPTIONS } from '@angular/material/paginator';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { sessionInterceptor } from './interceptors/session-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withFetch(),
      withInterceptors([sessionInterceptor])
    ),
    // Same table paging on every page
    {
      provide: MAT_PAGINATOR_DEFAULT_OPTIONS,
      useValue: { pageSize: 10, pageSizeOptions: [10, 25, 50], showFirstLastButtons: true }
    }
  ]
};
