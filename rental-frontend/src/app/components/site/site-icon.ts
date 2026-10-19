import { Component, input } from '@angular/core';

/** Stroke icons for the public site (same Lucide-style set the home page draws). */
@Component({
  selector: 'app-site-icon',
  standalone: true,
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name()) {
        @case ('menu') { <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/> }
        @case ('x') { <line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/> }
        @case ('arrow-right') { <line x1="4" y1="12" x2="19" y2="12"/><path d="m13 6 6 6-6 6"/> }
        @case ('check') { <path d="m5 12.5 4.5 4.5L19 7.5"/> }
        @case ('check-circle') { <circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/> }
        @case ('chevron-down') { <path d="m6 9 6 6 6-6"/> }
        @case ('building') { <path d="M3 10 12 3l9 7"/><rect x="5" y="10" width="14" height="11"/><path d="M10 21v-6h4v6"/> }
        @case ('door') { <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"/><line x1="3" y1="21" x2="21" y2="21"/><circle cx="15" cy="12" r="0.8" fill="currentColor"/> }
        @case ('users') { <circle cx="9" cy="8" r="3"/><path d="M2.5 20c0-3.6 3-5.5 6.5-5.5s6.5 1.9 6.5 5.5"/><circle cx="17" cy="9.5" r="2.3"/><path d="M15.8 14.7c2.5 0 4.7 1.5 5.2 4.3"/> }
        @case ('file-text') { <path d="M7 2h7l5 5v15H7z"/><path d="M14 2v5h5"/><line x1="10" y1="13" x2="17" y2="13"/><line x1="10" y1="17" x2="17" y2="17"/> }
        @case ('receipt') { <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><line x1="9" y1="7.5" x2="15" y2="7.5"/><line x1="9" y1="11.5" x2="15" y2="11.5"/> }
        @case ('smartphone') { <rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/> }
        @case ('droplet') { <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/> }
        @case ('alert') { <path d="M12 3 2 20h20z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/> }
        @case ('calendar') { <rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/> }
        @case ('log-out') { <path d="M15 4h4v16h-4"/><path d="M10 8 6 12l4 4"/><line x1="6" y1="12" x2="16" y2="12"/> }
        @case ('wallet') { <rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 14h2"/> }
        @case ('wrench') { <path d="M14.5 6.5a3.5 3.5 0 1 0-5 5L4 17l3 3 5.5-5.5a3.5 3.5 0 0 0 5-5l-2.5 2.5-2-2z"/> }
        @case ('bar-chart') { <line x1="6" y1="20" x2="6" y2="11"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="15"/> }
        @case ('search') { <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/> }
        @case ('moon') { <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/> }
        @case ('shield') { <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6z"/><path d="m9.5 12 1.8 1.8L15 10"/> }
        @case ('lock') { <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/> }
        @case ('key') { <circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m17 6 3 3"/> }
        @case ('eye-off') { <path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5.5 0 9 6 9 6a16 16 0 0 1-3 3.6"/><path d="M6.6 6.6C4.3 8.2 3 12 3 12s3.5 6 9 6a8.6 8.6 0 0 0 4.2-1.1"/> }
        @case ('server') { <rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><line x1="7" y1="7.5" x2="7.01" y2="7.5"/><line x1="7" y1="16.5" x2="7.01" y2="16.5"/> }
        @case ('mail') { <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/> }
        @case ('phone') { <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/> }
        @case ('map-pin') { <path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/> }
        @case ('clock') { <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/> }
        @case ('message') { <path d="M4 5h16v11H8l-4 4z"/> }
        @case ('heart') { <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/> }
        @case ('target') { <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/> }
        @case ('eye') { <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/> }
        @case ('twitter') { <path d="M4 4l7.5 9.5L4.3 20H7l5-5.6L16 20h4l-7.9-9.9L19.4 4H17l-4.6 5.1L8 4z"/> }
        @case ('linkedin') { <rect x="3" y="3" width="18" height="18" rx="3"/><line x1="7.5" y1="10" x2="7.5" y2="17"/><circle cx="7.5" cy="6.8" r="0.6" fill="currentColor" stroke="none"/><path d="M11.5 17v-4.5c0-1.4 1-2.3 2.3-2.3s2.2.9 2.2 2.3V17"/><line x1="11.5" y1="10" x2="11.5" y2="17"/> }
        @case ('instagram') { <rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none"/> }
        @case ('facebook') { <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5z"/> }
        @case ('github') { <circle cx="12" cy="12" r="9"/><path d="M9 18v-2.1c-1.4.2-2-.6-2.3-1.2"/><path d="M15 18v-2.5c0-.8-.3-1.3-.6-1.6 1.9-.2 3.9-1 3.9-4.3 0-.9-.3-1.7-.9-2.3.1-.2.4-1.1-.1-2.3 0 0-.7-.2-2.4.9a8.2 8.2 0 0 0-4.4 0C6.8 4.8 6.1 5 6.1 5c-.5 1.2-.2 2.1-.1 2.3-.6.6-.9 1.4-.9 2.3 0 3.3 2 4.1 3.9 4.3"/> }
      }
    </svg>
  `,
})
export class SiteIcon {
  name = input.required<string>();
}
