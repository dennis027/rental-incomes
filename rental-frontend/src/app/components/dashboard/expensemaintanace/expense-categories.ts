/** Types offered when recording an expense or a maintenance request. Values match the backend choices. */
export interface CategoryOption {
  value: string;
  label: string;
  icon: string;
}

export const EXPENSE_CATEGORIES: CategoryOption[] = [
  { value: 'cleaning',       label: 'Cleaning',                icon: 'fas fa-broom' },
  { value: 'salaries',       label: 'Salaries & wages',        icon: 'fas fa-user-tie' },
  { value: 'repairs',        label: 'Repairs & maintenance',   icon: 'fas fa-screwdriver-wrench' },
  { value: 'utilities',      label: 'Water & electricity',     icon: 'fas fa-bolt' },
  { value: 'security',       label: 'Security',                icon: 'fas fa-shield-halved' },
  { value: 'garbage',        label: 'Garbage collection',      icon: 'fas fa-trash-can' },
  { value: 'rates_taxes',    label: 'Rates & taxes',           icon: 'fas fa-landmark' },
  { value: 'insurance',      label: 'Insurance',               icon: 'fas fa-file-shield' },
  { value: 'management',     label: 'Management & agent fees', icon: 'fas fa-briefcase' },
  { value: 'supplies',       label: 'Supplies',                icon: 'fas fa-box-open' },
  { value: 'deposit_refund', label: 'Deposit refund',          icon: 'fas fa-rotate-left' },
  { value: 'other',          label: 'Other',                   icon: 'fas fa-ellipsis' },
];

export const MAINTENANCE_CATEGORIES: CategoryOption[] = [
  { value: 'plumbing',     label: 'Plumbing',                 icon: 'fas fa-faucet-drip' },
  { value: 'electrical',   label: 'Electrical',               icon: 'fas fa-plug' },
  { value: 'carpentry',    label: 'Doors, locks & carpentry', icon: 'fas fa-door-closed' },
  { value: 'painting',     label: 'Painting',                 icon: 'fas fa-paint-roller' },
  { value: 'appliance',    label: 'Appliances',               icon: 'fas fa-blender' },
  { value: 'structural',   label: 'Roof, walls & floors',     icon: 'fas fa-house-crack' },
  { value: 'pest_control', label: 'Pest control',             icon: 'fas fa-bug' },
  { value: 'cleaning',     label: 'Cleaning',                 icon: 'fas fa-broom' },
  { value: 'other',        label: 'Other',                    icon: 'fas fa-ellipsis' },
];
