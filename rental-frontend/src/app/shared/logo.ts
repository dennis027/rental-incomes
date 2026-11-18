import { Component } from '@angular/core';

/** The KodiDesk mark: a "K" whose lower leg ends in a gold shilling. Same drawing as public/favicon.svg. */
@Component({
  selector: 'app-logo',
  standalone: true,
  host: { class: 'app-logo', role: 'img', 'aria-label': 'KodiDesk' },
  styles: `:host { display: inline-flex; flex-shrink: 0; } svg { width: 100%; height: 100%; display: block; }`,
  template: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="kodidesk-logo-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#5b74ff"/>
          <stop offset="1" stop-color="#3641f5"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#kodidesk-logo-fill)"/>
      <path d="M23 17v30M42 17L25 33l12 12" fill="none" stroke="#fff"
            stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="44" cy="45" r="3.4" fill="#fdb022"/>
    </svg>
  `,
})
export class Logo {}
