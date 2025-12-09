import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SharedImports } from '../../../shared-imports/imports';
import { ReportsService } from '../../../services/reports';
import { FinancialReports } from './financial-reports/financial-reports';
import { OccupancyReports } from './occupancy-reports/occupancy-reports';
import { TenantscustomersReports } from './tenantscustomers-reports/tenantscustomers-reports';
import { UtilitymaintanaceReports } from './utilitymaintanace-reports/utilitymaintanace-reports';
import { ExecutiveReports } from './executive-reports/executive-reports';

@Component({
  selector: 'app-reports',
  imports: [SharedImports,FinancialReports,OccupancyReports,TenantscustomersReports,UtilitymaintanaceReports,ExecutiveReports],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports {


  ngOnInit(): void {

  } 


}
