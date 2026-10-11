import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { AuthInterceptor } from './app/interceptors/auth-interceptor';

bootstrapApplication(App, appConfig)
  .catch(err => console.error(err));
