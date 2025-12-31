# Release Notes v2.4.3
Date: 2025-01-22

## New Features
- **Payment Deferment System**: Customers can now request payment deferments directly from the cashier receipt page.
- **Server Health Monitoring**: Real-time MikroTik temperature and voltage monitoring on the dashboard.
- **Automated Deferment Blocking**: System now automatically blocks customers who fail to pay by their deferred deadline (Every night at 23:00).
- **Enhanced Notifications**: New templates for deferment approval and limit reached.

## Improvements
- **Standardized Monitoring UI**: PPPoE and Static IP monitoring pages now match the premium dashboard aesthetics.
- **Isolation Logic**: Integration with the deferment system to prevent isolation of customers with active deferments.
- **TypeScript Security**: Fixed several linting errors and improved type safety in controllers.

## Fixes
- Fixed syntax error in `kasirController.ts`.
- Improved receipt printing stability.
