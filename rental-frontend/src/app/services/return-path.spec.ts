import { rememberPath, takeReturnPath } from './return-path';

describe('return path after signing in', () => {
  beforeEach(() => localStorage.removeItem('return_path'));

  it('brings the user back to the page they were on, once', () => {
    rememberPath('/dashboard/statement?tenant=3&contract=7');
    expect(takeReturnPath()).toBe('/dashboard/statement?tenant=3&contract=7');
    expect(takeReturnPath()).toBe('/dashboard');
  });

  it('ignores pages outside the dashboard', () => {
    rememberPath('/login');
    rememberPath('https://example.com/dashboard');
    expect(takeReturnPath()).toBe('/dashboard');
  });
});
