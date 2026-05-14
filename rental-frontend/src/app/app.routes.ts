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
import { RequestDemoComponent } from './components/home/request-demo-component/request-demo-component';

export const routes: Routes = [
  // 🌍 Public pages
  { path: '', component: Home },
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
