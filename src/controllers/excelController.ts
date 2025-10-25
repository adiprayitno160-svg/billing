import { Request, Response } from 'express';
import { databasePool } from '../db/pool';
import * as XLSX from 'xlsx';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Export customers to Excel
export const exportCustomersToExcel = async (req: Request, res: Response) => {
    try {
        const query = `
            SELECT 
                c.id,
                c.name,
                c.phone,
                c.email,
                c.address,
                c.customer_code,
                c.connection_type,
                c.status,
                c.latitude,
                c.longitude,
                c.pppoe_username,
                c.pppoe_profile_id,
                sic.ip_address,
                sic.interface,
                sic.gateway,
                sic.package_id as static_ip_package_id,
                c.created_at,
                c.updated_at
            FROM customers c
            LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
            ORDER BY c.created_at DESC
        `;
        
        const [customers] = await databasePool.execute(query);
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Prepare data for Excel
        const excelData = (customers as any[]).map(customer => ({
            'ID Pelanggan': customer.id,
            'Nama': customer.name,
            'Nomor Telepon': customer.phone,
            'Email': customer.email || `${customer.name.toLowerCase().replace(/\s+/g, '')}@id.net`,
            'Alamat': customer.address,
            'Kode Pelanggan': customer.customer_code,
            'Tipe Koneksi': customer.connection_type === 'pppoe' ? 'PPPOE' : 'IP Static',
            'Status': customer.status,
            'Latitude': customer.latitude,
            'Longitude': customer.longitude,
            'Username PPPOE': customer.pppoe_username,
            'Profile ID PPPOE': customer.pppoe_profile_id,
            'IP Address': customer.ip_address,
            'Interface': customer.interface,
            'Gateway': customer.gateway,
            'ID Paket Static IP': customer.static_ip_package_id,
            'Tanggal Dibuat': customer.created_at,
            'Tanggal Diupdate': customer.updated_at
        }));
        
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Data Pelanggan');
        
        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="data_pelanggan.xlsx"');
        res.setHeader('Content-Length', buffer.length);
        
        res.send(buffer);
        
    } catch (error) {
        console.error('Error exporting customers:', error);
        res.status(500).json({ error: 'Gagal mengexport data pelanggan' });
    }
};

// Get import template
export const getImportTemplate = async (req: Request, res: Response) => {
    try {
        // Create template data
        const templateData = [
            {
                'Nama': 'Contoh Nama',
                'Alamat': 'Jl. Contoh No. 123',
                'Nomor Telepon': '08123456789'
            }
        ];
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import');
        
        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template_import_pelanggan.xlsx"');
        res.setHeader('Content-Length', buffer.length);
        
        res.send(buffer);
        
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
};

// Import customers from Excel
export const importCustomersFromExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File Excel tidak ditemukan' });
        }
        
        // Read Excel file from memory buffer (multer.memoryStorage)
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return res.status(400).json({ error: 'Sheet tidak ditemukan pada file Excel' });
        }
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            return res.status(400).json({ error: 'Worksheet tidak ditemukan' });
        }
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i] as any;
            const rowNumber = i + 2; // header row is 1

            try {
                const name = (row['Nama'] || '').toString().trim();
                const phone = (row['Nomor Telepon'] || '').toString().trim();
                const address = (row['Alamat'] || '').toString().trim();

                if (!name) {
                    results.failed++;
                    results.errors.push(`Baris ${rowNumber}: Nama harus diisi`);
                    continue;
                }
                if (!phone) {
                    results.failed++;
                    results.errors.push(`Baris ${rowNumber}: Nomor Telepon harus diisi`);
                    continue;
                }

                // Check duplicate by phone
                const [existing] = await databasePool.execute(
                    'SELECT id FROM customers WHERE phone = ? LIMIT 1',
                    [phone]
                );
                if ((existing as any).length > 0) {
                    results.failed++;
                    results.errors.push(`Baris ${rowNumber}: Nomor Telepon sudah terdaftar`);
                    continue;
                }

                // Generate fallback email from name
                const emailLocal = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
                const email = `${emailLocal || 'user'}@id.net`;

                // Insert minimal record
                const insertQuery = `
                    INSERT INTO customers (name, phone, email, address, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
                `;
                await databasePool.execute(insertQuery, [name, phone, email, address]);

                results.success++;

            } catch (e) {
                results.failed++;
                const message = e instanceof Error ? e.message : String(e);
                results.errors.push(`Baris ${rowNumber}: ${message}`);
            }
        }

        return res.json({
            success: true,
            message: `Import selesai. Berhasil: ${results.success}, Gagal: ${results.failed}`,
            details: results
        });
        
    } catch (error) {
        console.error('Error importing customers:', error);
        res.status(500).json({ error: 'Gagal mengimport data pelanggan' });
    }
};

// Process imported customers (save to database)
export const processImportedCustomers = async (req: Request, res: Response) => {
    try {
        const { customers } = req.body;
        
        if (!customers || !Array.isArray(customers)) {
            return res.status(400).json({ error: 'Data pelanggan tidak valid' });
        }
        
        const results: { success: number; failed: number; errors: string[] } = {
            success: 0,
            failed: 0,
            errors: []
        };
        
        for (const customerData of customers) {
            try {
                // Insert customer
                const customerQuery = `
                    INSERT INTO customers (
                        name, phone, email, address, customer_code, 
                        connection_type, status, latitude, longitude,
                        pppoe_username, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                `;
                
                const [result] = await databasePool.execute(customerQuery, [
                    customerData.name,
                    customerData.phone,
                    customerData.email,
                    customerData.address,
                    customerData.customer_code,
                    customerData.connection_type,
                    customerData.status,
                    customerData.latitude,
                    customerData.longitude,
                    customerData.pppoe_username
                ]);
                
                const customerId = (result as any).insertId;
                
                // If static IP, insert to static_ip_clients table
                if (customerData.connection_type === 'static_ip' && customerData.ip_address) {
                    const staticIpQuery = `
                        INSERT INTO static_ip_clients (
                            customer_id, ip_address, interface, gateway, created_at
                        ) VALUES (?, ?, ?, ?, NOW())
                    `;
                    
                    await databasePool.execute(staticIpQuery, [
                        customerId,
                        customerData.ip_address,
                        customerData.interface,
                        customerData.gateway
                    ]);
                }
                
                results.success++;
                
            } catch (error) {
                results.failed++;
                const message = error instanceof Error ? error.message : String(error);
                results.errors.push(`${customerData.name}: ${message}`);
            }
        }
        
        res.json({
            success: true,
            message: `Berhasil memproses ${results.success} pelanggan, gagal ${results.failed}`,
            results: results
        });
        
    } catch (error) {
        console.error('Error processing customers:', error);
        res.status(500).json({ error: 'Gagal memproses data pelanggan' });
    }
};

// Sync PPPOE data from MikroTik
export const syncPppoeFromMikrotik = async (req: Request, res: Response) => {
    try {
        // This would integrate with MikroTik API
        // For now, return mock data
        const mockPppoeUsers = [
            {
                username: 'user001',
                password: 'password123',
                profile: 'default',
                comment: 'Customer 1'
            },
            {
                username: 'user002', 
                password: 'password456',
                profile: 'premium',
                comment: 'Customer 2'
            }
        ];
        
        res.json({
            success: true,
            message: 'Data PPPOE berhasil di-sync dari MikroTik',
            users: mockPppoeUsers
        });
        
    } catch (error) {
        console.error('Error syncing PPPOE:', error);
        res.status(500).json({ error: 'Gagal sync data PPPOE dari MikroTik' });
    }
};

// Get customer by ID for editing
export const getCustomerForEdit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                c.*,
                sic.ip_address,
                sic.interface,
                sic.gateway,
                sic.package_id as static_ip_package_id
            FROM customers c
            LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
            WHERE c.id = ?
        `;
        
        const [result] = await databasePool.execute(query, [id]);
        const customer = (result as any)[0];
        
        if (!customer) {
            return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
        }
        
        res.json({
            success: true,
            customer: customer
        });
        
    } catch (error) {
        console.error('Error getting customer:', error);
        res.status(500).json({ error: 'Gagal mengambil data pelanggan' });
    }
};

export { upload };
