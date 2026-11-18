import { Routes } from '@angular/router';
import { Login } from "./components/auth/login/login";
import { Dashboard } from './components/dashboard/dashboard';
import { Home } from './components/home/home';
import { AuthGuard } from './guards/auth-guard';
import { DashHome } from './components/dashboard/dash-home/dash-home';
import { RentalCustomers } from './components/dashboard/rental-customers/rental-customers';
import { Receipts } from './components/dashboard/receipts/receipts';
import { Properties } from './components/dashboard/properties/properties';
import { Contracts } from './components/dashboard/contracts/contracts';
import { Settings } from './components/dashboard/settings/settings';
import { Units } from './components/dashboard/units/units';
import { Expensemaintanace } from './components/dashboard/expensemaintanace/expensemaintanace';
import { Payments } from './components/dashboard/payments/payments';
import { Reports } from './components/dashboard/reports/reports';
import { Arrears } from './components/dashboard/arrears/arrears';
import { TenantStatement } from './components/dashboard/tenant-statement/tenant-statement';
import { RequestDemoComponent } from './components/home/request-demo-component/request-demo-component';
import { SiteLayout } from './components/site/site-layout';
import { FeaturesPage } from './components/site/pages/features/features';
import { PricingPage } from './components/site/pages/pricing/pricing';
import { AboutPage } from './components/site/pages/about/about';
import { ContactPage } from './components/site/pages/contact/contact';
import { FaqPage } from './components/site/pages/faq/faq';
import { SecurityPage } from './components/site/pages/security/security';
import { PrivacyPage } from './components/site/pages/legal/privacy';
import { TermsPage } from './components/site/pages/legal/terms';
import { Team } from './components/dashboard/team/team';

export const routes: Routes = [
  // 🌍 Public website: shared navigation bar and footer
  {
    path: '',
    component: SiteLayout,
    children: [
      { path: '', component: Home, title: 'KodiDesk – Rent management for Kenyan landlords' },
      { path: 'features', component: FeaturesPage, title: 'Features – KodiDesk' },
      { path: 'pricing', component: PricingPage, title: 'Pricing – KodiDesk' },
      { path: 'about', component: AboutPage, title: 'About us – KodiDesk' },
      { path: 'contact', component: ContactPage, title: 'Contact us – KodiDesk' },
      { path: 'faq', component: FaqPage, title: 'FAQ – KodiDesk' },
      { path: 'security', component: SecurityPage, title: 'Security – KodiDesk' },
      { path: 'privacy', component: PrivacyPage, title: 'Privacy Policy – KodiDesk' },
      { path: 'terms', component: TermsPage, title: 'Terms of Service – KodiDesk' },
    ],
  },
  { path: 'login', component: Login, title: 'Sign in · KodiDesk' },
  { path: 'request-demo', component: RequestDemoComponent, title: 'Request a demo · KodiDesk' },

  // 💼 Protected dashboard section
  {
    path: 'dashboard',  
    component: Dashboard,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' }, // ✅ redirect default /dashboard → /dashboard/home
      { path: 'home', component: DashHome, canActivate: [AuthGuard], title: 'Dashboard · KodiDesk' },
      { path: 'rental-customers', component: RentalCustomers, canActivate: [AuthGuard], title: 'Tenants · KodiDesk' },
      { path: 'receipts', component: Receipts, canActivate: [AuthGuard], title: 'Invoices · KodiDesk' },
      { path: 'properties', component: Properties, canActivate: [AuthGuard], title: 'Properties · KodiDesk' },
      { path: 'payments', component: Payments, canActivate: [AuthGuard], title: 'Payments · KodiDesk' },
      { path: 'arrears', component: Arrears, canActivate: [AuthGuard], title: 'Arrears · KodiDesk' },
      { path: 'statement', component: TenantStatement, canActivate: [AuthGuard], title: 'Tenant statement · KodiDesk' },
      { path: 'contracts', component: Contracts, canActivate: [AuthGuard], title: 'Contracts · KodiDesk' },
      { path: 'settings', component: Settings, canActivate: [AuthGuard], title: 'Billing settings · KodiDesk' },
      { path: 'units', component: Units, canActivate: [AuthGuard], title: 'Units · KodiDesk' },
      {path:'reports',component:Reports, canActivate:[AuthGuard], title: 'Reports · KodiDesk' },
      {path:'expensesmaintain', component:Expensemaintanace, canActivate:[AuthGuard], title: 'Expenses & maintenance · KodiDesk' },
      { path: 'team', component: Team, canActivate: [AuthGuard], title: 'Team & account · KodiDesk' }
    ],
  },

  // ❗ Wildcard fallback
  { path: '**', redirectTo: 'login' },

  
];
