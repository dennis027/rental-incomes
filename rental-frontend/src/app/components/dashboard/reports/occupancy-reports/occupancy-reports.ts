import { Component } from '@angular/core';
import { ReportViewer } from '../report-viewer/report-viewer';
import { OCCUPANCY_REPORTS } from '../report-viewer/report-definitions';

@Component({
  selector: 'app-occupancy-reports',
  imports: [ReportViewer],
  templateUrl: './occupancy-reports.html',
  styleUrl: './occupancy-reports.css',
})
export class OccupancyReports {
  reports = OCCUPANCY_REPORTS;
}
