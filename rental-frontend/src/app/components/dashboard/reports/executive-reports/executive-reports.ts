import { Component } from '@angular/core';
import { ReportViewer } from '../report-viewer/report-viewer';
import { EXECUTIVE_REPORTS } from '../report-viewer/report-definitions';

@Component({
  selector: 'app-executive-reports',
  imports: [ReportViewer],
  templateUrl: './executive-reports.html',
  styleUrl: './executive-reports.css',
})
export class ExecutiveReports {
  reports = EXECUTIVE_REPORTS;
}
