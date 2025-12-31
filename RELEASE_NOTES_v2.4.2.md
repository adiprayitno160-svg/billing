# Release Notes v2.4.2
Date: 2025-05-22

## New Features
- **Auto-Locking System**: Automatic customer isolation when late payment threshold is reached (defaults to 5 telat).
- **Overpayment Handling**: Excess payments are now automatically credited to customer balance (`account_balance`).
- **Balance Integration**: Ability to use account balance for paying invoices in Kasir dashboard.
- **Release Versioning System**: Integrated version management with `npm run release` script.

## Improvements
- **Enhanced Payment Form**: Restricted 'Catat Hutang' payment mode for isolated or overdue customers to prevent further debt.
- **Customer Management**: Email fields are now visible and manageable in edit/detail pages.
- **WhatsApp Notifications**: Improved notifications with balance usage details, overpayment credits, and auto-isolation alerts.
- **Single Session Enforcement**: Added protection against multiple concurrent logins for the same account.

## Fixes
- Fixed invoice generation logic to correctly deduct balance during auto-generation.
- Improved MikroTik sync logic for customer isolation status.
