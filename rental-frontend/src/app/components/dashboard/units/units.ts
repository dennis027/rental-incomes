import { Component, inject, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { UnitsService } from '../../../services/units';
import { PropertiesService } from '../../../services/properties';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SharedImports } from '../../../shared-imports/imports';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';

@Component({
  selector: 'app-units',
  imports: [SharedImports],
  templateUrl: './units.html',
  styleUrl: './units.css',
})
export class Units implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['unit_number', 'unit_type', 'rent_amount', 'status','actions'];
  dataSource = new MatTableDataSource<any>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private unitsService = inject(UnitsService);
  private propertiesService = inject(PropertiesService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  loading = false;
  error: string | null = null;
  units: any[] = [];
  properties: any[] = [];
  selectedPropertyId: string | number | '' = '';
  searchText: string = '';
  selectedPropertyName: string = '';

  ngOnInit() {
    this.getProperties();
    this.fetchUnits();
    
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  /** 🔹 Fetch all units from API */
  fetchUnits() {
    this.loading = true;
    this.unitsService.getUnits().subscribe({
      next: (response) => {
        this.units = response;
        this.dataSource.data = this.units.filter(
          (unit) => unit.property === Number(this.properties[0]?.id)
        );
          this.dataSource.paginator = this.paginator;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching units:', err);
        this.error = 'Failed to load units.';
        this.loading = false;
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      },
    });
  }

  /** 🔹 Fetch all properties */
  getProperties() {
    this.propertiesService.getProperties().subscribe({
      next: (res) => {
        this.properties = res;

         if (this.properties.length > 0) {
        // ✅ Auto-select the first property
        this.selectedPropertyId = this.properties[0].id;
        this.selectedPropertyName = this.properties[0].name;

        // ✅ Filter units immediately
        this.filterUnitsByProperty();
      }
      },
      error: (err) => {
        console.error('Error fetching properties:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
        
      },
    });
  }

  /** 🔹 Filter units by selected property */
  filterUnitsByProperty() { 
    this.selectedPropertyName = this.properties.find(
      (prop) => prop.id === Number(this.selectedPropertyId)
    )?.name || '';
    if (!this.selectedPropertyId) {
      this.dataSource.data = this.units.filter(
      (unit) => unit.property === Number(this.properties[0].id)
      );
    }
    this.dataSource.data = this.units.filter(
      (unit) => unit.property === Number(this.selectedPropertyId)

    );
      this.dataSource.paginator = this.paginator;
  }

  /** 🔹 Apply search filter */
  applyFilter() {
    const filterValue = this.searchText.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  openUpdateDialog(unit: any) {
    // Implementation for opening update dialog
  }

  openDeleteDialog(unit: any) {  
    // Implementation for opening add unit dialog
  }

  openAddUnitDialog() {
    // Implementation for opening add unit dialog
  }
}
