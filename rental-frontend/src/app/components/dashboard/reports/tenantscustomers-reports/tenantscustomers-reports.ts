import { Component } from '@angular/core';
import { ReportViewer } from '../report-viewer/report-viewer';
import { TENANT_REPORTS } from '../report-viewer/report-definitions';

@Component({
  selector: 'app-tenantscustomers-reports',
  imports: [ReportViewer],
  templateUrl: './tenantscustomers-reports.html',
  styleUrl: './tenantscustomers-reports.css',
})
export class TenantscustomersReports {
  reports = TENANT_REPORTS;
}
