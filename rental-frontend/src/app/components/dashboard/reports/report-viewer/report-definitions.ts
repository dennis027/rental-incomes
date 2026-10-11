export interface ReportFilter {
  key: string;
  label: string;
  type: 'number' | 'select';
  options?: { value: string; label: string }[];
}

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  /** API path under /api/. Use {tenant} where the selected tenant id belongs. */
  path: string;
  property?: boolean;
  dates?: boolean;
  tenant?: boolean;
  filters?: ReportFilter[];
}

const UNIT_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'bedsitter', label: 'Bedsitter' },
  { value: 'studio', label: 'Studio' },
  { value: 'one_bedroom', label: 'One Bedroom' },
  { value: 'two_bedroom', label: 'Two Bedroom' },
  { value: 'three_bedroom', label: 'Three Bedroom' },
  { value: 'four_bedroom', label: 'Four Bedroom' },
  { value: 'five_bedroom', label: 'Five Bedroom' },
];

const unitType: ReportFilter = { key: 'unit_type', label: 'Unit type', type: 'select', options: UNIT_TYPES };
const minBalance: ReportFilter = { key: 'min_balance', label: 'Minimum balance', type: 'number' };

export const FINANCIAL_REPORTS: ReportDefinition[] = [
  { id: 'revenue', title: 'Total Revenue', description: 'Revenue, expenses and outstanding amounts for each property.', path: 'revenue/total/', property: true, dates: true },
  { id: 'outstanding', title: 'Outstanding Balances', description: 'Units that still owe money.', path: 'balances/outstanding/', property: true,
    filters: [minBalance, { key: 'status', label: 'Unit status', type: 'select', options: [{ value: 'occupied', label: 'Occupied' }, { value: 'vacant', label: 'Vacant' }] }] },
  { id: 'collections', title: 'Payment Collections', description: 'Money collected over time, by method and by top payers.', path: 'payments/collections/', property: true, dates: true,
    filters: [{ key: 'group_by', label: 'Group by', type: 'select', options: [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }] }] },
  { id: 'rent-roll', title: 'Rent Roll', description: 'Every unit with its tenant, rent and balance.', path: 'rent-roll/', property: true, filters: [unitType] },
  { id: 'deposits', title: 'Deposit Tracking', description: 'Rental, water and electricity deposits held.', path: 'deposits/tracking/', property: true, dates: true },
  { id: 'expenses', title: 'Expense Analysis', description: 'What was spent, by property and by month.', path: 'expenses/analysis/', property: true, dates: true },
  { id: 'profit-loss', title: 'Profit & Loss', description: 'Income against expenses for the period.', path: 'profit-loss/', property: true, dates: true },
  { id: 'defaulters', title: 'Defaulters', description: 'Tenants with overdue balances.', path: 'defaulters/', property: true,
    filters: [minBalance, { key: 'days_overdue', label: 'Days overdue', type: 'number' }] },
  { id: 'methods', title: 'Payment Methods', description: 'How tenants pay: cash, M-Pesa, bank and so on.', path: 'payments/methods/', property: true, dates: true },
  { id: 'forecast', title: 'Revenue Forecast', description: 'Expected rent from active contracts over the coming months.', path: 'revenue/forecast/', property: true,
    filters: [{ key: 'months', label: 'Months ahead', type: 'number' }] },
];

export const OCCUPANCY_REPORTS: ReportDefinition[] = [
  { id: 'occupancy-rate', title: 'Occupancy Rate', description: 'Occupied against vacant units, by property and unit type.', path: 'occupancy/rate/', property: true },
  { id: 'unit-performance', title: 'Unit Performance', description: 'How each unit is doing on revenue and balance.', path: 'units/performance/', property: true,
    filters: [{ key: 'order_by', label: 'Order by', type: 'select', options: [{ value: 'revenue', label: 'Revenue' }, { value: 'balance', label: 'Balance' }, { value: 'occupancy', label: 'Occupancy' }] }] },
  { id: 'vacancy', title: 'Vacancy Duration', description: 'How long vacant units have been empty.', path: 'vacancy/duration/', property: true,
    filters: [{ key: 'min_days', label: 'Vacant at least (days)', type: 'number' }] },
  { id: 'type-analysis', title: 'Unit Type Analysis', description: 'Occupancy and rent for each type of unit.', path: 'units/type-analysis/', property: true },
  { id: 'movement', title: 'Tenant Movement', description: 'Move-ins and move-outs in the period.', path: 'tenant-movement/', property: true, dates: true },
  { id: 'pricing', title: 'Rent Pricing', description: 'Average, lowest and highest rent by unit type and property.', path: 'rent/pricing/', property: true },
  { id: 'utilization', title: 'Unit Utilization', description: 'Occupancy month by month.', path: 'units/utilization/', property: true,
    filters: [{ key: 'months', label: 'Months back', type: 'number' }] },
  { id: 'available', title: 'Available Units', description: 'Vacant units ready to let.', path: 'units/available/', property: true,
    filters: [unitType, { key: 'max_rent', label: 'Maximum rent', type: 'number' }] },
];

export const TENANT_REPORTS: ReportDefinition[] = [
  { id: 'directory', title: 'Tenant Directory', description: 'All tenants with their contacts and units.', path: 'tenants/directory/', property: true,
    filters: [{ key: 'is_active', label: 'Status', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }] },
  { id: 'payment-history', title: 'Tenant Payment History', description: 'Every invoice and payment for one tenant.', path: 'tenants/{tenant}/payment-history/', tenant: true },
  { id: 'arrears', title: 'Arrears Aging', description: 'Unpaid amounts grouped by how old they are.', path: 'tenants/arrears-aging/', property: true },
  { id: 'expiring', title: 'Contracts Expiring', description: 'Contracts that end soon.', path: 'contracts/expiring/', property: true,
    filters: [{ key: 'days', label: 'Within (days)', type: 'number' }] },
  { id: 'new-tenants', title: 'New Tenants', description: 'Tenants who moved in recently.', path: 'tenants/new/', property: true,
    filters: [{ key: 'days', label: 'In the last (days)', type: 'number' }] },
  { id: 'retention', title: 'Tenant Retention', description: 'How long tenants stay.', path: 'tenants/retention/', property: true },
];

export const UTILITY_REPORTS: ReportDefinition[] = [
  { id: 'consumption', title: 'Utility Consumption', description: 'Water and electricity used per unit.', path: 'utilities/consumption/', property: true, dates: true },
  { id: 'utility-revenue', title: 'Utility Revenue', description: 'Water and electricity billed, month by month.', path: 'utilities/revenue/', property: true, dates: true },
  { id: 'maintenance-requests', title: 'Maintenance Requests', description: 'Repair requests and how quickly they are handled.', path: 'maintenance/requests/', property: true, dates: true,
    filters: [{ key: 'status', label: 'Status', type: 'select', options: [{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' }] }] },
  { id: 'maintenance-costs', title: 'Maintenance Costs', description: 'What repairs cost, by property.', path: 'maintenance/costs/', property: true, dates: true },
];

export const EXECUTIVE_REPORTS: ReportDefinition[] = [
  { id: 'executive', title: 'Executive Dashboard', description: 'Finance, occupancy and operations at a glance.', path: 'dashboard/executive/', property: true,
    filters: [{ key: 'period', label: 'Period (days)', type: 'number' }] },
  { id: 'comparison', title: 'Property Comparison', description: 'Your properties side by side.', path: 'properties/comparison/', dates: true },
];
