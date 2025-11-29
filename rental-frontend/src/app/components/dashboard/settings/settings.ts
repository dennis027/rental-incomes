import { Component, inject, ViewChild, AfterViewInit, OnInit, ChangeDetectorRef, TemplateRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PropertiesService } from '../../../services/properties';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SharedImports } from '../../../shared-imports/imports';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SystemParametersServices } from '../../../services/system-parameters-services';

@Component({
  selector: 'app-settings',
  imports: [SharedImports],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private propertiesService = inject(PropertiesService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private systemParametersService = inject(SystemParametersServices);
  private platformId = inject(PLATFORM_ID); // ✅ Add this

  updateSystemParams!: FormGroup;
  selectedPropertyId: number | null = null;
  systemParameters: any;
  properties: any[] = [];

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

  ngOnInit() {
    // Initialize form first (can run on server)
    this.updateSysParamsForm();

    // ✅ CRITICAL: Only load data in browser
    if (isPlatformBrowser(this.platformId)) {
      console.log('🔍 Settings component running in browser');
      
      // Verify token exists
      const token = localStorage.getItem('access_token');
      console.log('🔑 Token status:', token ? 'Token exists' : '❌ NO TOKEN!');
      
      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }
      
      this.getProperties();
    } else {
      console.log('⚠️ Settings component running on server, skipping API calls');
    }
  }

  updateSysParamsForm() {
    this.updateSystemParams = this.fb.group({
      has_water_bill: [true],
      has_electricity_bill: [true],
      has_service_charge: [true],
      has_security_charge: [false],
      has_other_charges: [false],
      rent_deposit_months: [1, [Validators.required, Validators.min(0)]],
      require_water_deposit: [false],
      require_electricity_deposit: [false],
      allow_partial_payments: [true],
      auto_generate_receipts: [false],
      late_payment_penalty_rate: ['0.00'],
      grace_period_days: [5],
      default_service_charge: ['0.00'],
      default_security_charge: ['0.00'],
      default_other_charge: ['0.00'],
      electicity_unit_cost: ['0.00'],
      water_unit_cost: ['0.00'],
      water_deposit_amount : ['0.00'],
      electricity_deposit_amount  : ['0.00']
    });
  }

  /** 🏢 Get all properties */
  getProperties() {
    console.log('📡 Loading properties...');
    
    this.propertiesService.getProperties().subscribe({
      next: (data) => {
        console.log('✅ Properties loaded:', data);
        this.properties = data;
        if (!this.selectedPropertyId && this.properties.length > 0) {
          this.selectedPropertyId = this.properties[0].id;
        }
        console.log('Selected Property ID on Init:', this.selectedPropertyId);
        if (this.properties.length > 0) this.loadSystemParameters();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error fetching properties:', error);
        if (error.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      }
    });
  }

  /** ⚙️ Load System Parameters for selected property */
  loadSystemParameters() {
    const propertyId = this.selectedPropertyId ?? this.properties[0]?.id;
    console.log('📡 Loading system parameters for property:', propertyId);
    
    this.systemParametersService.getSystemParams(propertyId).subscribe({
      next: (data) => {
        console.log('✅ System Parameters loaded:', data);
        this.systemParameters = data;
        this.updateSystemParams.patchValue(data); // ✅ auto-fill form
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error fetching system parameters:', error);
        if (error.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      }
    });
  }

  /** 🧩 On property change */
  getPropertyID(event: any) {
    this.selectedPropertyId = event.value;
    console.log('🔄 Property changed to:', this.selectedPropertyId);
    this.loadSystemParameters();
  }

  /** 💾 Submit updated parameters */
  onUpdateSystemParams() {
    if (this.updateSystemParams.invalid) {
      this.updateSystemParams.markAllAsTouched();
      return;
    }

    const payload = this.updateSystemParams.value;
    const propertyId = this.selectedPropertyId ?? this.properties[0]?.id;

    console.log('📤 Updating system parameters:', payload);

    this.systemParametersService.updateSystemParams(propertyId, payload).subscribe({
      next: (res) => {
        console.log('✅ System parameters updated:', res);
        this.showSuccess('✅ System parameters updated successfully!');
        this.loadSystemParameters();
      },
      error: (err) => {
        console.error('❌ Error updating system parameters:', err);
        this.showError('❌ Failed to update system parameters');
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      }
    });
  }
}