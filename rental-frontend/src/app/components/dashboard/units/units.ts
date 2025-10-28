import { Component, inject, ViewChild, AfterViewInit, OnInit, ChangeDetectorRef, TemplateRef } from '@angular/core';
import { UnitsService } from '../../../services/units';
import { PropertiesService } from '../../../services/properties';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SharedImports } from '../../../shared-imports/imports';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

export interface UnitsTable {
  id: string;
  property: number;
  unit_number: string;
  unit_type: string;
  rent_amount: number;
  water_meter_reading: number;
  electricity_meter_reading: number;
  status: string;
}

@Component({
  selector: 'app-units',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './units.html',
  styleUrl: './units.css',
})
export class Units implements OnInit, AfterViewInit {
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  // ViewChild for the dialog templates
  @ViewChild('openAddDialog') openAddDialog!: TemplateRef<any>;
  @ViewChild('updateDialog') updateDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;

  loadAdding = false;
  loadUpdating = false;
  loadDeleting = false;

  unitForm!: FormGroup;
  updateUnitForm!: FormGroup;
  selectedUnitId: string | null = null;

  displayedColumns: string[] = ['unit_number', 'unit_type', 'rent_amount', 'status', 'actions'];
  unitsObject: UnitsTable[] = [];

  showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  dataSource = new MatTableDataSource<UnitsTable>(this.unitsObject);

  // ViewChild for the paginator
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  
  searchText: string = '';
   properties: any[] = [];
  selectedPropertyId: number | null = null;
  selectedPropertyName: string = '';

  constructor(
    private UnitsService: UnitsService,
    private PropertiesService: PropertiesService,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.updateUnitForm = this.fb.group({
      property: [this.selectedPropertyId, Validators.required],
      unit_number: ['', [Validators.required, Validators.minLength(1)]],
      unit_type: ['', [Validators.required, Validators.minLength(2)]],
      rent_amount: ['', [Validators.required, Validators.min(0)]],
      water_meter_reading: ['', [Validators.required, Validators.min(0)]],
      electricity_meter_reading: ['', [Validators.required, Validators.min(0)]],
      // status: ['vacant', Validators.required],
    });
  }

  ngOnInit() {
  
    this.getProperties();
    setTimeout(() => {  this.initializeForm(); }, 1000);
      
  }

  initializeForm() {
    this.unitForm = this.fb.group({
      property: [this.selectedPropertyId, Validators.required],
      unit_number: ['', [Validators.required, Validators.minLength(1)]],
      unit_type: ['', [Validators.required, Validators.minLength(2)]],
      rent_amount: ['', [Validators.required, Validators.min(0)]],
      water_meter_reading: ['', [Validators.required, Validators.min(0)]],
      electricity_meter_reading: ['', [Validators.required, Validators.min(0)]],
      // status: ['vacant', Validators.required],
    });
  }

  getUnits() {
    this.UnitsService.getUnits().subscribe({
      next: (res: UnitsTable[] | any) => {
        this.unitsObject = res;
        this.dataSource.data = this.unitsObject;
        
        // Filter after data is loaded if property is selected
        if (this.selectedPropertyId) {
          this.filterUnitsByProperty();
        }
      },
      error: (err) => {
        if (err.status === 0) {
          // Network error
        }
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } else {
          console.error('Error fetching units:', err);
        }
      }
    });
  }

getProperties() {
    this.PropertiesService.getProperties().subscribe({
      next: (res) => {
        this.properties = res;

        if (this.properties.length > 0) {
          // Auto-select the first property
          this.selectedPropertyId = this.properties[0].id;
          this.selectedPropertyName = this.properties[0].name;
        }

        // 🔥 Tell Angular to re-run change detection safely
        this.cdr.detectChanges();

        // Fetch units after properties are loaded
        this.getUnits();
      },
      error: (err) => {
        if (err.status === 0) {
          // Network error
        } else if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } else {
          console.error('Error fetching properties:', err);
        }
      },
    });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
      this.cdr.detectChanges();
  }

  /** Filter units by selected property */
  filterUnitsByProperty() {
    this.selectedPropertyName = this.properties.find(
      (prop) => prop.id === Number(this.selectedPropertyId)
    )?.name || '';
    
    if (!this.selectedPropertyId) {
      this.dataSource.data = this.unitsObject;
      return;
    }
    
    this.dataSource.data = this.unitsObject.filter(
      (unit) => unit.property === Number(this.selectedPropertyId)
    );
  }

  /** Apply search filter */
  applyFilter() {
    const filterValue = this.searchText.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  openAddUnitDialog() {
    const isMobile = window.innerWidth < 600;
    let dialogRef = this.dialog.open(this.openAddDialog);
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {
          console.log('User clicked yes.');
        } else if (result === 'no') {
          console.log('User clicked no.');
        }
      }
    });
  }

  testForm(){
    console.log(this.unitForm.value);
  }

addUnit() {
  
  if (this.unitForm.invalid) {
    this.unitForm.markAllAsTouched();
    return;
  }

  this.loadAdding = true;
  this.cdr.detectChanges(); // ✅ inform Angular before HTTP call

  const newUnit ={
    property: this.selectedPropertyId,
    unit_number: this.unitForm.value.unit_number,
    unit_type: this.unitForm.value.unit_type,
    rent_amount: this.unitForm.value.rent_amount,
    water_meter_reading: this.unitForm.value.water_meter_reading,
    electricity_meter_reading: this.unitForm.value.electricity_meter_reading,
    // status: 'vacant'
  }

  this.UnitsService.addUnit(newUnit).subscribe({
    next: (res) => {
      this.loadAdding = false;
      this.getUnits();
      const resetValue ={
        property: this.selectedPropertyId,
        unit_number: '',
        unit_type: '',
        rent_amount: '',
        water_meter_reading: '',
        electricity_meter_reading: '',
        // status: 'vacant'
      }
      this.unitForm.reset(resetValue);
      this.dialog.closeAll();
      this.showSuccess('Unit added successfully!');

      // ✅ Let Angular stabilize after async changes
      this.cdr.detectChanges();
    },
    error: (err) => {
      this.loadAdding = false;
      this.showError('Failed to add unit. Please try again.');

      if (err.status === 0) {
        // Network error
      }
      if (err.status === 401) {
        this.dialog.closeAll();
        this.router.navigate(['/login']);
      } else {
        console.error('❌ Error adding unit:', err);
      }

      this.cdr.detectChanges();
    }
  });
}

  /** Opens dialog and pre-fills data for update */
  openUpdateDialog(unit: any) {
    this.selectedUnitId = unit.id;
    this.updateUnitForm.patchValue({
      property: unit.property,
      unit_number: unit.unit_number,
      unit_type: unit.unit_type,
      rent_amount: unit.rent_amount,
      water_meter_reading: unit.water_meter_reading,
      electricity_meter_reading: unit.electricity_meter_reading,
      status: unit.status,
    });
    this.dialog.open(this.updateDialog);
  }

  /** Submits update request */
updateUnit() {
  if (!this.selectedUnitId || this.updateUnitForm.invalid) return;

  this.loadUpdating = true;
  this.cdr.detectChanges(); // ✅ notify Angular before async call

  const updatedData = this.updateUnitForm.value;

  this.UnitsService.updateUnit(this.selectedUnitId, updatedData).subscribe({
    next: (response) => {
      this.loadUpdating = false;
      this.getUnits();
      this.updateUnitForm.reset();
      this.dialog.closeAll();
      this.showSuccess('Unit updated successfully!');

      this.cdr.detectChanges(); // ✅ ensure stable UI after async update
    },
    error: (error) => {
      this.loadUpdating = false;
      this.showError('Failed to update unit. Please try again.');

      if (error.status === 0) {
        // Network error
      }
      if (error.status === 401) {
        this.dialog.closeAll();
        this.router.navigate(['/login']);
      } else {
        console.error('❌ Update failed:', error);
      }

      this.cdr.detectChanges(); // ✅ same for error case
    },
  });
}


  openDeleteDialog(unit: any) {
    this.selectedUnitId = unit.id;
    this.dialog.open(this.deleteDialog);
  }

  /** Performs deletion after confirmation */
  confirmDelete() {
    this.loadDeleting = true;
    if (!this.selectedUnitId) return;

    this.UnitsService.deleteUnit(this.selectedUnitId).subscribe({
      next: (response) => {
        this.loadDeleting = false;
        this.getUnits();
        this.dialog.closeAll();
        this.showSuccess('Unit deleted successfully!');
      },
      error: (error) => {
        this.loadDeleting = false;
        this.showError('Failed to delete unit. Please try again.');
        if (error.status === 0) {
          // Network error
        }
        if (error.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } else {
          console.error('❌ Delete failed:', error);
        }
      },
    });
  }
}