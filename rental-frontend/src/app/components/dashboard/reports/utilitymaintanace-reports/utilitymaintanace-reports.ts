import { Component } from '@angular/core';
import { ReportViewer } from '../report-viewer/report-viewer';
import { UTILITY_REPORTS } from '../report-viewer/report-definitions';

@Component({
  selector: 'app-utilitymaintanace-reports',
  imports: [ReportViewer],
  templateUrl: './utilitymaintanace-reports.html',
  styleUrl: './utilitymaintanace-reports.css',
})
export class UtilitymaintanaceReports {
  reports = UTILITY_REPORTS;
}
