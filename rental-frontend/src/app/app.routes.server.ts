import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Signed-in pages are drawn only in the browser, after the auth guard has
  // looked at the tokens. Prerendering them would ship the dashboard to anyone.
  { path: 'dashboard/**', renderMode: RenderMode.Client },
  { path: 'dashboard', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
