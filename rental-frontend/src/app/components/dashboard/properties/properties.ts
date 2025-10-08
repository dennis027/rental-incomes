import { AfterViewInit, Component, ViewChild, TemplateRef, OnInit } from '@angular/core';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { CommonModule } from '@angular/common';
import { PropertiesService } from '../../../services/properties';
import { MatIconModule } from '@angular/material/icon'; 
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { Router } from '@angular/router';

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
  imports: [ CommonModule,
            MatTableModule,
            MatPaginatorModule,
            MatIconModule,
            MatTooltipModule,
            MatButtonModule,
            MatDialogModule,
            ReactiveFormsModule,
            MatInputModule,
            MatFormFieldModule],
  templateUrl: './properties.html',
  styleUrls: ['./properties.css']
})
export class Properties implements OnInit, AfterViewInit { // Added OnInit interface

  // ViewChild for the dialog template
  @ViewChild('openAddDialog') openAddDialog!: TemplateRef<any>;
   @ViewChild('updateDialog') updateDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;

  
    propertyForm!: FormGroup;
    updatePropertyForm!: FormGroup;
    selectedPropertyId: number | null = null;

  displayedColumns: string[] = [ 'name', 'address', 'description', 'actions'];
  propertiesObject: PropertiesTable[] = [];

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
        // 💡 OPTIMIZATION: Removed assignment here; it's better placed in ngAfterViewInit
        console.log('Properties fetched successfully:', res);
      },
      error: (err) => {
        if (err.status === 0) {
          console.error('Network error: Please check your internet connection.');
        }
        if (err.status === 401) {
          console.error('Unauthorized: Please log in again.');
          this.router.navigate(['/login']);
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
    let dialogRef = this.dialog.open(this.openAddDialog,{
    width: isMobile ? '90vw' : '840px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    panelClass: 'responsive-dialog',
  });
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

    const newProperty = this.propertyForm.value;

    this.PropertiesService.addProperty(newProperty).subscribe({
      next: (res) => {
        console.log('✅ Property added successfully:', res);
        this.getProperties();
        this.propertyForm.reset();
        this.dialog.closeAll(); 
      },
      error: (err) => 
        {
        if (err.status === 0) {
          console.error('Network error: Please check your internet connection.');
        }
        if (err.status === 401) {
          console.error('Unauthorized: Please log in again.');
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

    const updatedData = this.updatePropertyForm.value;

    this.PropertiesService.updateProperty(this.selectedPropertyId, updatedData).subscribe({
      next: (response) => {
        console.log('✅ Property updated successfully:', response);
        this.getProperties();
        this.propertyForm.reset();
        this.dialog.closeAll(); 
      },
      error: (error) => {
             if (error.status === 0) {
          console.error('Network error: Please check your internet connection.');
        }
        if (error.status === 401) {
          console.error('Unauthorized: Please log in again.');
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
    if (!this.selectedPropertyId) return;

    this.PropertiesService.deleteProperty(this.selectedPropertyId).subscribe({
      next: (response) => {
        this.getProperties();
        this.propertyForm.reset();
        this.dialog.closeAll(); 
      },
      error: (error) => {
        console.error('❌ Delete failed:', error);
        alert('Delete failed. Please check console for details.');
      },
    });
  }
}