// Business details shown on the public pages. Edit here; every page reads from this file.
// Empty values are hidden, so nothing made-up is ever displayed.

export interface SocialLink {
  label: string;
  icon: 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'github';
  url: string;
}

export interface Plan {
  name: string;
  units: string;
  /** Monthly price in KES; null shows "Talk to us" */
  priceKes: number | null;
  description: string;
  highlights: string[];
  featured?: boolean;
}

export const SITE = {
  name: 'Rental System',
  tagline: 'Making rental management simple and efficient for everyone.',
  // Public contact details; leave empty to hide
  email: '',
  phone: '',
  whatsapp: '',          // international format without +, e.g. 254712345678
  location: '',          // e.g. 'Westlands, Nairobi'
  officeHours: '',       // e.g. 'Mon – Fri, 8am – 5pm EAT'
  socials: [] as SocialLink[],
  legalUpdated: '19 October 2026',

  plans: [
    {
      name: 'Starter',
      units: 'Up to 20 units',
      priceKes: null,
      description: 'For individual landlords with one or two buildings.',
      highlights: ['Every feature included', 'M-Pesa paybill matching', 'Email support'],
    },
    {
      name: 'Growth',
      units: '21 – 150 units',
      priceKes: null,
      description: 'For landlords and small agencies growing their portfolio.',
      highlights: ['Every feature included', 'M-Pesa paybill matching', 'Help importing your tenants', 'Priority support'],
      featured: true,
    },
    {
      name: 'Agency',
      units: '150+ units',
      priceKes: null,
      description: 'For property managers running many buildings for many owners.',
      highlights: ['Every feature included', 'M-Pesa paybill matching', 'Onboarding for your team', 'Dedicated support contact'],
    },
  ] as Plan[],
};
