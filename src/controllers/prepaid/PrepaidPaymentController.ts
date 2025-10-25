import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import PrepaidActivationService from '../../services/prepaid/PrepaidActivationService';
import PaymentGatewayService from '../../services/payment/PaymentGatewayService';

/**
 * Controller untuk Prepaid Payment Processing
 * Handle payment method selection, payment processing, dan activation
 */
class PrepaidPaymentController {
  /**
   * Show payment page
   */
  async showPaymentPage(req: Request, res: Response) {
    try {
      const packageId = parseInt(req.params.packageId);
      const customerId = (req.session as any).portalCustomerId;

      // Get package details
      const [packageRows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          pp.*,
          sp.download_mbps,
          sp.upload_mbps
         FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         WHERE pp.id = ?`,
        [packageId]
      );

      if (packageRows.length === 0) {
        return res.redirect('/prepaid/portal/packages?error=Paket tidak ditemukan');
      }

      const packageData = packageRows[0];

      // Get customer
      const [customerRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [customerId]
      );

      // Get available payment methods/gateways
      const [gateways] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM payment_gateways WHERE is_active = 1'
      );

      res.render('prepaid/portal-payment', {
        title: `Pembayaran - ${packageData.name}`,
        layout: false,
        package: packageData,
        customer: customerRows[0],
        gateways: gateways,
        customerName: (req.session as any).customerName,
        error: req.query.error || null
      });
    } catch (error) {
      console.error('Payment page error:', error);
      res.status(500).send('Server error');
    }
  }

  /**
   * Process payment
   */
  async processPayment(req: Request, res: Response) {
    try {
      const { package_id, payment_method } = req.body;
      const customerId = (req.session as any).portalCustomerId;

      if (!package_id || !payment_method) {
        return res.redirect(`/prepaid/portal/payment/${package_id}?error=Data tidak lengkap`);
      }

      const packageId = parseInt(package_id);

      // Get package details
      const [packageRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM prepaid_packages WHERE id = ?',
        [packageId]
      );

      if (packageRows.length === 0) {
        return res.redirect('/prepaid/portal/packages?error=Paket tidak valid');
      }

      const packageData = packageRows[0];

      // Get customer
      const [customerRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [customerId]
      );

      const customer = customerRows[0];

      // Create invoice for this purchase
      const invoiceNumber = await this.generateInvoiceNumber();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1); // Due in 1 day

      const [invoiceResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO invoices 
         (invoice_number, customer_id, period, due_date, subtotal, total_amount, remaining_amount, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
        [
          invoiceNumber,
          customerId,
          new Date().toISOString().slice(0, 7), // YYYY-MM
          dueDate,
          packageData.price,
          packageData.price,
          packageData.price,
          `Prepaid package: ${packageData.name}`
        ]
      );

      const invoiceId = invoiceResult.insertId;

      // Add invoice item
      await pool.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
         VALUES (?, ?, 1, ?, ?)`,
        [invoiceId, `Paket Prepaid: ${packageData.name}`, packageData.price, packageData.price]
      );

      // Determine payment processing based on method
      if (payment_method === 'cash') {
        // Cash payment - direct activation (for testing)
        return await this.processCashPayment(req, res, {
          customerId,
          packageId,
          invoiceId,
          packageData,
          customer
        });
      } else {
        // Gateway payment (QRIS, Transfer, etc)
        return await this.processGatewayPayment(req, res, {
          customerId,
          packageId,
          invoiceId,
          packageData,
          customer,
          paymentMethod: payment_method
        });
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      const packageId = req.body.package_id;
      res.redirect(`/prepaid/portal/payment/${packageId}?error=Gagal memproses pembayaran`);
    }
  }

  /**
   * Process cash payment (direct activation for testing)
   */
  private async processCashPayment(req: Request, res: Response, data: any) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Mark invoice as paid
      await connection.query(
        `UPDATE invoices 
         SET status = 'paid', paid_amount = total_amount, remaining_amount = 0, updated_at = NOW()
         WHERE id = ?`,
        [data.invoiceId]
      );

      // Create payment record
      await connection.query(
        `INSERT INTO payments (invoice_id, payment_method, amount, payment_date, reference_number, notes)
         VALUES (?, 'cash', ?, NOW(), ?, 'Portal prepaid - cash payment')`,
        [data.invoiceId, data.packageData.price, `CASH-${Date.now()}`]
      );

      await connection.commit();
      connection.release();

      // Activate package
      const activation = await PrepaidActivationService.activatePackage({
        customer_id: data.customerId,
        package_id: data.packageId,
        invoice_id: data.invoiceId,
        purchase_price: data.packageData.price
      });

      if (activation.success) {
        // Redirect to success page
        res.redirect(`/prepaid/portal/success?invoice=${data.invoiceId}`);
      } else {
        res.redirect(`/prepaid/portal/payment/${data.packageId}?error=Aktivasi gagal`);
      }
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  /**
   * Process payment gateway
   */
  private async processGatewayPayment(req: Request, res: Response, data: any) {
    try {
      // TODO: Integrate with actual payment gateway
      // For now, just show payment instructions

      // Store payment session
      await pool.query(
        `INSERT INTO invoice_payment_sessions 
         (invoice_id, session_token, payment_amount, payment_method, status, expires_at)
         VALUES (?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
        [
          data.invoiceId,
          `PREP-${Date.now()}`,
          data.packageData.price,
          data.paymentMethod
        ]
      );

      // Redirect to payment waiting page
      res.redirect(`/prepaid/portal/payment-waiting?invoice=${data.invoiceId}&method=${data.paymentMethod}`);
    } catch (error) {
      console.error('Gateway payment error:', error);
      throw error;
    }
  }

  /**
   * Show payment waiting page (for gateway payments)
   */
  async showPaymentWaiting(req: Request, res: Response) {
    try {
      const invoiceId = parseInt(req.query.invoice as string);
      const paymentMethod = req.query.method as string;

      // Get invoice details
      const [invoiceRows] = await pool.query<RowDataPacket[]>(
        `SELECT i.*, ii.description 
         FROM invoices i
         LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
         WHERE i.id = ?`,
        [invoiceId]
      );

      if (invoiceRows.length === 0) {
        return res.redirect('/prepaid/portal/packages?error=Invoice tidak ditemukan');
      }

      const invoice = invoiceRows[0];

      res.render('prepaid/portal-payment-waiting', {
        title: 'Menunggu Pembayaran',
        layout: false,
        invoice: invoice,
        paymentMethod: paymentMethod,
        customerName: (req.session as any).customerName
      });
    } catch (error) {
      console.error('Payment waiting page error:', error);
      res.status(500).send('Server error');
    }
  }

  /**
   * Check payment status (API for polling)
   */
  async checkPaymentStatus(req: Request, res: Response) {
    try {
      const invoiceId = parseInt(req.params.invoiceId);

      const [invoiceRows] = await pool.query<RowDataPacket[]>(
        'SELECT status, paid_amount, total_amount FROM invoices WHERE id = ?',
        [invoiceId]
      );

      if (invoiceRows.length === 0) {
        return res.json({ success: false, error: 'Invoice not found' });
      }

      const invoice = invoiceRows[0];

      res.json({
        success: true,
        status: invoice.status,
        paid: invoice.status === 'paid',
        amount_paid: invoice.paid_amount,
        total_amount: invoice.total_amount
      });
    } catch (error) {
      console.error('Check payment status error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }

  /**
   * Show success page
   */
  async showSuccessPage(req: Request, res: Response) {
    try {
      const invoiceId = parseInt(req.query.invoice as string);
      const customerId = (req.session as any).portalCustomerId;

      // Get invoice details
      const [invoiceRows] = await pool.query<RowDataPacket[]>(
        `SELECT i.*, ii.description 
         FROM invoices i
         LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
         WHERE i.id = ? AND i.customer_id = ?`,
        [invoiceId, customerId]
      );

      if (invoiceRows.length === 0) {
        return res.redirect('/prepaid/portal/packages?error=Invoice tidak ditemukan');
      }

      const invoice = invoiceRows[0];

      // Get active subscription
      const subscription = await PrepaidActivationService.getActiveSubscription(customerId);

      res.render('prepaid/portal-success', {
        title: 'Pembayaran Berhasil',
        layout: false,
        invoice: invoice,
        subscription: subscription,
        customerName: (req.session as any).customerName
      });
    } catch (error) {
      console.error('Success page error:', error);
      res.status(500).send('Server error');
    }
  }

  /**
   * Generate invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Get count for this month
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM invoices 
       WHERE invoice_number LIKE ? AND invoice_number LIKE '%PREP%'`,
      [`INV/PREP/${year}/${month}/%`]
    );

    const count = (rows[0].count || 0) + 1;
    const sequence = String(count).padStart(4, '0');

    return `INV/PREP/${year}/${month}/${sequence}`;
  }
}

export default new PrepaidPaymentController();

