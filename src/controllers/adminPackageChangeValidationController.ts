import { Request, Response, NextFunction } from 'express';
import { PackageChangeValidationService } from '../services/billing/PackageChangeValidationService';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

interface CustomerWithValidationStatus {
  id: number;
  name: string;
  phone: string;
  billing_mode: string;
  connection_type: string;
  package_name: string;
  isValid: boolean;
  message: string;
  totalOutstandingAmount?: number;
  outstandingInvoiceCount?: number;
}

export async function getPackageChangeValidationPage(req: Request, res: Response, next: NextFunction) {
  try {
    // Ambil semua pelanggan postpaid
    const [customers] = await databasePool.query<RowDataPacket[]>(
      `SELECT c.id, c.name, c.phone, c.billing_mode, c.connection_type, 
              COALESCE(s.package_name, sp.name) as package_name
       FROM customers c
       LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
       LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
       LEFT JOIN static_ip_packages sp ON sic.package_id = sp.id
       WHERE c.billing_mode = 'postpaid'
       ORDER BY c.name ASC`
    );

    // Periksa status validasi untuk setiap pelanggan
    const customersWithStatus: CustomerWithValidationStatus[] = [];
    
    for (const customer of customers) {
      const validation = await PackageChangeValidationService.validateCustomerPaymentStatus(customer.id);
      
      customersWithStatus.push({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        billing_mode: customer.billing_mode,
        connection_type: customer.connection_type,
        package_name: customer.package_name,
        isValid: validation.isValid,
        message: validation.message,
        totalOutstandingAmount: validation.totalOutstandingAmount,
        outstandingInvoiceCount: validation.outstandingInvoices?.length
      });
    }

    res.render('admin/package-change-validation', {
      title: 'Validasi Perubahan Paket',
      customers: customersWithStatus,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error getting package change validation page:', error);
    req.flash('error', 'Gagal memuat halaman validasi perubahan paket');
    res.redirect('/dashboard');
  }
}

export async function forcePackageChange(req: Request, res: Response, next: NextFunction) {
  try {
    const { customerId, newPackageId, packageType, reason } = req.body;
    const adminId = (req.session as any).userId || 0;
    
    // Import service secara dinamis untuk menghindari circular dependency
    const { PackageChangeService } = await import('../services/billing/PackageChangeService');
    
    const result = await PackageChangeService.forceChangePackage(
      parseInt(customerId),
      parseInt(newPackageId),
      packageType,
      adminId,
      reason
    );
    
    if (result.success) {
      req.flash('success', result.message);
    } else {
      req.flash('error', result.message);
    }
    
    res.redirect('/admin/package-change-validation');
  } catch (error) {
    console.error('Error forcing package change:', error);
    req.flash('error', 'Gagal memaksa perubahan paket');
    res.redirect('/admin/package-change-validation');
  }
}

export async function sendReminderNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const customerId = parseInt(req.params.customerId);
    
    // Import service secara dinamis
    const { PackageChangeNotificationService } = await import('../services/whatsapp/PackageChangeNotificationService');
    
    const result = await PackageChangeNotificationService.sendOutstandingInvoiceNotification(customerId);
    
    if (result.success) {
      req.flash('success', `Notifikasi berhasil dikirim ke pelanggan`);
    } else {
      req.flash('error', `Gagal mengirim notifikasi: ${result.message}`);
    }
    
    res.redirect('/admin/package-change-validation');
  } catch (error) {
    console.error('Error sending reminder notification:', error);
    req.flash('error', 'Gagal mengirim notifikasi pengingat');
    res.redirect('/admin/package-change-validation');
  }
}

export async function getPendingCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    // Ambil pelanggan dengan tagihan tertunggak
    const [customers] = await databasePool.query<RowDataPacket[]>(
      `SELECT DISTINCT c.id, c.name, c.phone, c.billing_mode, 
              COALESCE(s.package_name, sp.name) as package_name,
              SUM(i.remaining_amount) as total_outstanding
       FROM customers c
       LEFT JOIN invoices i ON c.id = i.customer_id 
           AND i.status IN ('sent', 'partial', 'overdue')
           AND i.remaining_amount > 0
       LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
       LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
       LEFT JOIN static_ip_packages sp ON sic.package_id = sp.id
       WHERE c.billing_mode = 'postpaid'
       GROUP BY c.id, c.name, c.phone, c.billing_mode, s.package_name, sp.name
       HAVING total_outstanding > 0
       ORDER BY total_outstanding DESC`
    );

    res.json({
      success: true,
      customers: customers
    });
  } catch (error) {
    console.error('Error getting pending customers:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data pelanggan dengan tagihan tertunggak'
    });
  }
}