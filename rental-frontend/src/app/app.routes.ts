import { Routes } from '@angular/router';
import {Login} from "./components/auth/login/login";
import { Dashboard } from './components/dashboard/dashboard';
import { Home } from './components/home/home';
import { AuthGuard } from './guards/auth-guard';
export const routes: Routes = [
   {path: '', component:Home },
   {path: 'login', component: Login},
   {path:'dashboard',component:Dashboard, canActivate: [AuthGuard] },

];
