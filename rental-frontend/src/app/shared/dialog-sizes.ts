/**
 * Dialog widths. Forms use the default from app.config.ts (560px, two
 * columns); pass one of these only when a dialog needs a different size.
 * The shared maxWidth keeps every size inside a phone screen.
 */
export const DialogSize = {
  /** "Are you sure?" prompts and short choices */
  confirm: { width: '440px' },
  /** Forms with a running total or a list of rows beside the fields */
  wide: { width: '720px' },
  /** A printable sheet: invoice, receipt, contract */
  document: { width: '800px', maxHeight: '90vh' },
} as const;
