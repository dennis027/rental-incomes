const KEY = 'return_path';

/**
 * Where the user was when they were signed out, so signing in again brings
 * them back there. Kept in localStorage so it survives closing the tab.
 * Only pages inside the dashboard are remembered.
 */
export function rememberPath(url: string | null | undefined): void {
  try {
    if (url && url.startsWith('/dashboard')) {
      localStorage.setItem(KEY, url);
    }
  } catch {
    // No storage (server rendering, private mode): signing in simply opens the dashboard
  }
}

/** The remembered page, forgotten once read. Falls back to the dashboard. */
export function takeReturnPath(): string {
  try {
    const url = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    // Guard against anything but an in-app dashboard path being stored
    if (url && url.startsWith('/dashboard') && !url.startsWith('//')) {
      return url;
    }
  } catch {
    // Fall through to the default
  }
  return '/dashboard';
}
