import { Component, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

@Component({ template: '' })
class BlankPage {}

/**
 * What every component and service in the app expects to find: the app runs
 * without zones, talks to the API over HttpClient and uses the router.
 * HTTP calls made during a test go nowhere, and any navigation (pages send a
 * signed-out user to /login) lands on a blank page.
 */
export const testProviders = [
  provideZonelessChangeDetection(),
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([{ path: '**', component: BlankPage }]),
];
