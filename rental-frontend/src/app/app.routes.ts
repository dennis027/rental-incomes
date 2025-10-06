import { Routes } from '@angular/router';
import { Login } from "./components/auth/login/login";
import { Dashboard } from './components/dashboard/dashboard';
import { Home } from './components/home/home';
import { AuthGuard } from './guards/auth-guard';
import { DashHome } from './components/dashboard/dash-home/dash-home';
import { RentalCollections } from './components/dashboard/rental-collections/rental-collections';
import { Receipts } from './components/dashboard/receipts/receipts';
import { Properties } from './components/dashboard/properties/properties';
import { Tenants } from './components/dashboard/tenants/tenants';
import { Contracts } from './components/dashboard/contracts/contracts';
import { Settings } from './components/dashboard/settings/settings';

export const routes: Routes = [
  // 🌍 Public pages
  { path: '', component: Home },
  { path: 'login', component: Login },

  // 💼 Protected dashboard section
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'properties', pathMatch: 'full' }, // ✅ redirect default /dashboard → /dashboard/home
      { path: 'home', component: DashHome, canActivate: [AuthGuard] },
      { path: 'rental-collections', component: RentalCollections, canActivate: [AuthGuard] },
      { path: 'receipts', component: Receipts, canActivate: [AuthGuard] },
      { path: 'properties', component: Properties, canActivate: [AuthGuard] },
      { path: 'tenants', component: Tenants, canActivate: [AuthGuard] },
      { path: 'contracts', component: Contracts, canActivate: [AuthGuard] },
      { path: 'settings', component: Settings, canActivate: [AuthGuard] },
    ],
  },

  // ❗ Wildcard fallback
  { path: '**', redirectTo: 'login' },
];
