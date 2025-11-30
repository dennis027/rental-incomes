import { AfterViewInit, Component, ViewChild, TemplateRef, OnInit, inject } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { PropertiesService } from '../../../services/properties';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SharedImports } from '../../../shared-imports/imports';
import { MatTableResponsiveDirective } from '../../../directives/mat-table-responsive-directive';

export interface PropertiesTable {
  id: string;
  name: string;  // 💡 CORRECTED: Changed from 'number' to 'string'
  address: string; // 💡 CORRECTED: Changed from 'number' to 'string'
  description: string;
}

@Component({
  selector: 'app-properties',
  standalone: true,
  // 💡 CORRECTED: Removed MatIconButton from imports; MatButtonModule covers the buttons.
  imports: [SharedImports,MatTableResponsiveDirective],
  templateUrl: './properties.html',
  styleUrls: ['./properties.css']
})
export class Properties implements OnInit, AfterViewInit { // Added OnInit interface
    private snackBar = inject(MatSnackBar);
  // ViewChild for the dialog template
  @ViewChild('openAddDialog') openAddDialog!: TemplateRef<any>;
   @ViewChild('updateDialog') updateDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;


  loadAdding= false;
  loadUpdating= false;
  loadDeleting= false;

  
    propertyForm!: FormGroup;
    updatePropertyForm!: FormGroup;
    selectedPropertyId: number | null = null;

  displayedColumns: string[] = [ 'name', 'address', 'description', 'actions'];
  propertiesObject: PropertiesTable[] = [];


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



  dataSource = new MatTableDataSource<PropertiesTable>(this.propertiesObject);

  // ViewChild for the paginator
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // 💡 CORRECTED: Injection type changed to PropertiesService (PascalCase)
  constructor(private PropertiesService: PropertiesService, private dialog: MatDialog, private fb: FormBuilder,private router: Router) {

        this.updatePropertyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
    });
  }

  ngOnInit() {  
    this.getProperties();
      this.initializeForm();
  }

  initializeForm() {
    this.propertyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
    });
  }

  getProperties() {
    this.PropertiesService.getProperties().subscribe({
      next: (res: PropertiesTable[] | any) => { // Use 'any' or correct type if API response is not PropertiesTable[] directly
        this.propertiesObject = res; 
        this.dataSource.data = this.propertiesObject;
        
      },
      error: (err) => {
        if (err.status === 0) {
        }
        if (err.status === 401) {
        
          this.router.navigate(['/login']);
            this.dialog.closeAll();
        }
        else{
          console.error('Error fetching properties:', err);
        }
      }
    });
  }

  ngAfterViewInit() {
    // 💡 CORRECTED: Ensures the paginator is correctly linked *after* the view is initialized.
    // The setTimeout is a common workaround for a change detection issue, but often unnecessary in modern Angular.
    // However, since it was in your original code, it's kept. A direct assignment should generally work now.
    this.dataSource.paginator = this.paginator;
  }

  openAddPropertyDialog() {
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

    addProperty() {
    if (this.propertyForm.invalid) {
      this.propertyForm.markAllAsTouched();
      return;
    }
    this.loadAdding = true;
    const newProperty = this.propertyForm.value;

    this.PropertiesService.addProperty(newProperty).subscribe({
      next: (res) => {
        this.loadAdding = false;
        this.getProperties();
        this.propertyForm.reset();
        this.dialog.closeAll(); 
        this.showSuccess('Property added successfully!');
      },
      error: (err) => {
        this.loadAdding = false;
          this.showError('Failed to add property. Please try again.');
        if (err.status === 0) {
        }
        if (err.status === 401) {
            this.dialog.closeAll();
          this.router.navigate(['/login']);
        }
          else{
            console.error('❌ Error adding property:', err)
          }
          } 
          
    });
  }

  /** Opens dialog and pre-fills data for update */
  openUpdateDialog(property: any) {
    this.selectedPropertyId = property.id;
    this.updatePropertyForm.patchValue({
      name: property.name,
      address: property.address,
      description: property.description,
    });
    this.dialog.open(this.updateDialog);
  }

  /** Submits update request */
  updateProperty() {
    if (!this.selectedPropertyId || this.updatePropertyForm.invalid) return;
    this.loadUpdating = true;
    const updatedData = this.updatePropertyForm.value;

    this.PropertiesService.updateProperty(this.selectedPropertyId, updatedData).subscribe({
      next: (response) => {
        this.loadUpdating = false;
        this.getProperties();
        this.propertyForm.reset();
        this.dialog.closeAll(); 
        this.showSuccess('Property updated successfully!');
      },
      error: (error) => {
        this.loadUpdating = false;
        this.showError('Failed to update property. Please try again.');
             if (error.status === 0) {
        }
        if (error.status === 401) {
            this.dialog.closeAll();
          this.router.navigate(['/login']);
        }
          else{
        console.error('❌ Update failed:', error);
          }
      },
    });
  }


  deleteProperty(id: string) {
      let currentData = this.propertiesObject.find((p) => p.id ===  id);
      console.log('Current Data for delete:', currentData);
      // Implement delete logic here
  }

 openDeleteDialog(property: any) {
    this.selectedPropertyId = property.id;
    this.dialog.open(this.deleteDialog);
  }

  /** Performs deletion after confirmation */
  confirmDelete() {
    this.loadDeleting = true;
    if (!this.selectedPropertyId) return;

    this.PropertiesService.deleteProperty(this.selectedPropertyId).subscribe({
      next: (response) => {
        this.loadDeleting = false;
        this.getProperties();
        this.propertyForm.reset();
        this.dialog.closeAll(); 
        this.showSuccess('Property deleted successfully!');
      },
      error: (error) => {
        this.loadDeleting = false;
        this.showError('Failed to delete property. Please try again.');
        if (error.status === 0) {

        }
        if (error.status === 401) {
        
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
          else{

          }
   
  
      },
    });
  }
}