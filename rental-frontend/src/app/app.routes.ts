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

export const routes: Routes = [
  // 🌍 Public website: shared navigation bar and footer
  {
    path: '',
    component: SiteLayout,
    children: [
      { path: '', component: Home, title: 'Rental System – Rental management for Kenyan landlords' },
      { path: 'features', component: FeaturesPage, title: 'Features – Rental System' },
      { path: 'pricing', component: PricingPage, title: 'Pricing – Rental System' },
      { path: 'about', component: AboutPage, title: 'About us – Rental System' },
      { path: 'contact', component: ContactPage, title: 'Contact us – Rental System' },
      { path: 'faq', component: FaqPage, title: 'FAQ – Rental System' },
      { path: 'security', component: SecurityPage, title: 'Security – Rental System' },
      { path: 'privacy', component: PrivacyPage, title: 'Privacy Policy – Rental System' },
      { path: 'terms', component: TermsPage, title: 'Terms of Service – Rental System' },
    ],
  },
  { path: 'login', component: Login }, 
  {path:'request-demo', component:RequestDemoComponent},

  // 💼 Protected dashboard section
  {
    path: 'dashboard',  
    component: Dashboard,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' }, // ✅ redirect default /dashboard → /dashboard/home
      { path: 'home', component: DashHome, canActivate: [AuthGuard] },
      { path: 'rental-customers', component: RentalCustomers, canActivate: [AuthGuard] },
      { path: 'receipts', component: Receipts, canActivate: [AuthGuard] },
      { path: 'properties', component: Properties, canActivate: [AuthGuard] },
      { path: 'payments', component: Payments, canActivate: [AuthGuard] },
      { path: 'arrears', component: Arrears, canActivate: [AuthGuard] },
      { path: 'statement', component: TenantStatement, canActivate: [AuthGuard] },
      { path: 'contracts', component: Contracts, canActivate: [AuthGuard] },
      { path: 'settings', component: Settings, canActivate: [AuthGuard] },
      { path: 'units', component: Units, canActivate: [AuthGuard] },
      {path:'reports',component:Reports, canActivate:[AuthGuard]},
      {path:'expensesmaintain', component:Expensemaintanace, canActivate:[AuthGuard]}
    ],
  },

  // ❗ Wildcard fallback
  { path: '**', redirectTo: 'login' },

  
];
