import { Request, Response } from 'express';
import { databasePool } from '../db/pool';
import * as XLSX from 'xlsx';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { CustomerIdGenerator } from '../utils/customerIdGenerator';

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
            'Kode Pelanggan': customer.customer_code,
            'Nama': customer.name,
            'Telepon': customer.phone,
            'Email': customer.email || `${customer.name.toLowerCase().replace(/\s+/g, '')}@id.net`,
            'Alamat': customer.address,
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
        console.log('📄 Generating import template...');
        
        // Create template data - exactly 3 columns as required
        const templateData = [
            {
                'Nama': 'Budi Santoso',
                'Telepon': '081234567890',
                'Alamat': 'Jl. Merdeka No. 123, Jakarta'
            },
            {
                'Nama': 'Siti Aminah',
                'Telepon': '082345678901',
                'Alamat': 'Jl. Kenanga No. 45, Bandung'
            },
            {
                'Nama': 'Ahmad Fauzi',
                'Telepon': '083456789012',
                'Alamat': 'Jl. Melati No. 78, Surabaya'
            }
        ];
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        
        // Set column widths for better readability
        ws['!cols'] = [
            { wch: 25 },  // Nama
            { wch: 18 },  // Telepon
            { wch: 40 }   // Alamat
        ];
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Data Pelanggan');
        
        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        console.log('✅ Template generated, size:', buffer.length, 'bytes');
        
        // Set headers for download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template_import_pelanggan.xlsx"');
        res.setHeader('Content-Length', buffer.length);
        
        res.send(buffer);
        
    } catch (error) {
        console.error('❌ Error creating template:', error);
        res.status(500).json({ 
            success: false,
            error: 'Gagal membuat template' 
        });
    }
};

// Import customers from Excel
export const importCustomersFromExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'File Excel tidak ditemukan' 
            });
        }
        
        console.log('📂 Processing Excel file:', req.file.originalname);
        
        // Read Excel file from memory buffer (multer.memoryStorage)
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return res.status(400).json({ 
                success: false,
                error: 'Sheet tidak ditemukan pada file Excel' 
            });
        }
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            return res.status(400).json({ 
                success: false,
                error: 'Worksheet tidak ditemukan' 
            });
        }
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log(`📊 Found ${data.length} rows to import`);
        
        if (data.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'File Excel kosong atau tidak ada data untuk diimport' 
            });
        }
        
        // Debug: Log first row to see column names
        console.log('🔍 First row columns:', Object.keys(data[0] || {}));
        console.log('🔍 First row data:', data[0]);
        
        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        // Helper: normalize header/keys
        const toAscii = (s: string) => s.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
        const normalizeKey = (k: string) => toAscii(String(k))
            .replace(/\u00A0/g, ' ')
            .replace(/\./g, ' ')
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        const matchKey = (rowObj: any, candidates: string[]): any => {
            const keys = Object.keys(rowObj);
            const normMap: Record<string, string> = {};
            
            // Build normalized map
            for (const k of keys) {
                normMap[normalizeKey(k)] = k;
            }
            
            console.log('🔍 Available columns:', keys);
            console.log('🔍 Normalized map:', normMap);
            console.log('🔍 Looking for:', candidates);
            
            // Exact match first
            for (const c of candidates) {
                const nc = normalizeKey(c);
                if (normMap[nc] !== undefined) {
                    console.log(`✅ Exact match found: "${c}" -> "${normMap[nc]}"`);
                    return rowObj[normMap[nc]];
                }
            }
            
            // Fuzzy includes
            const wanted = candidates.map(c => normalizeKey(c));
            for (const [nk, orig] of Object.entries(normMap)) {
                if (wanted.some(w => nk === w || nk.includes(w) || w.includes(nk))) {
                    console.log(`✅ Fuzzy match found: "${nk}" -> "${orig}"`);
                    return rowObj[orig];
                }
            }
            
            console.log('❌ No match found for:', candidates);
            return '';
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i] as any;
            const rowNumber = i + 2; // header row is 1

            try {
                // Read using normalized key matching
                const name = (matchKey(row, ['Nama','Name']) ?? '').toString().trim();
                const phone = (matchKey(row, ['Telepon','Phone','No HP','HP','No Telepon','Nomor Telepon','No. Telepon','No Telp','Telp','Tlp']) ?? '').toString().trim();
                const address = (matchKey(row, ['Alamat','Address']) ?? '').toString().trim();
                
                console.log(`📋 Row ${rowNumber}: Nama="${name}", Telepon="${phone}", Alamat="${address}"`);

                // Validation with better error messages
                if (!name || name === '' || name === 'undefined') {
                    results.failed++;
                    const availableFields = Object.keys(row).join(', ');
                    results.errors.push(`Baris ${rowNumber}: Kolom "Nama" kosong. Kolom tersedia: ${availableFields}`);
                    console.log(`❌ Row ${rowNumber} FAILED: Nama kosong. Row data:`, row);
                    continue;
                }
                if (!phone || phone === '' || phone === 'undefined') {
                    results.failed++;
                    const availableFields = Object.keys(row).join(', ');
                    results.errors.push(`Baris ${rowNumber}: Kolom "Telepon" kosong. Kolom tersedia: ${availableFields}`);
                    console.log(`❌ Row ${rowNumber} FAILED: Telepon kosong. Row data:`, row);
                    continue;
                }

                // Clean phone number (remove spaces, dashes, dots)
                const cleanPhone = phone.replace(/[\s\-.]/g, '');
                console.log(`📞 Original phone: "${phone}", Clean phone: "${cleanPhone}"`);

                // Check duplicate by phone (both original and cleaned)
                const [existing] = await databasePool.execute(
                    'SELECT id, name, phone FROM customers WHERE phone = ? OR phone = ? LIMIT 1',
                    [phone, cleanPhone]
                );
                if ((existing as any).length > 0) {
                    const existingRecord = (existing as any)[0];
                    results.failed++;
                    results.errors.push(`Baris ${rowNumber}: Telepon "${phone}" sudah terdaftar atas nama "${existingRecord.name}"`);
                    console.log(`❌ Row ${rowNumber} FAILED: Duplicate phone. Existing customer:`, existingRecord.name);
                    continue;
                }

                // Retry loop untuk handle duplicate customer_code
                let inserted = false;
                let retries = 0;
                const maxRetries = 5;
                
                while (!inserted && retries < maxRetries) {
                    try {
                        // Generate customer_code dengan format YYYYMMDDHHMMSSMMM
                        const customerCode = CustomerIdGenerator.generateCustomerId();
                        
                        // Generate email dengan unique timestamp
                        const emailLocal = name.toLowerCase().replace(/[^a-z0-9]+/g, '').substring(0, 20);
                        const email = (emailLocal || 'customer') + Date.now() + '_' + i + '@local.id';

                        console.log(`   🔄 Attempt ${retries + 1}:`, { name, phone: cleanPhone, email, code: customerCode });

                        // Insert - customer_code dengan format YYYYMMDDHHMMSSMMM
                        const insertQuery = `
                            INSERT INTO customers (name, phone, email, address, customer_code, connection_type, status, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, 'pppoe', 'inactive', NOW(), NOW())
                        `;
                        
                        await databasePool.execute(insertQuery, [
                            name, 
                            cleanPhone, 
                            email, 
                            address || '',
                            customerCode
                        ]);
                        
                        results.success++;
                        console.log(`   ✅ SUCCESS: Row ${rowNumber} imported!`);
                        inserted = true;
                        
                    } catch (dbError: any) {
                        const errorMsg = dbError?.message || String(dbError);
                        
                        // Jika error duplicate customer_code, retry dengan delay
                        if (errorMsg.includes('Duplicate entry') && errorMsg.includes('customer_code')) {
                            retries++;
                            if (retries < maxRetries) {
                                console.log(`   ⚠️  Duplicate customer_code detected, retrying... (${retries}/${maxRetries})`);
                                await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
                                continue;
                            } else {
                                results.failed++;
                                results.errors.push(`Baris ${rowNumber}: Gagal membuat customer_code unik setelah ${maxRetries} percobaan`);
                                console.error(`   ❌ DB ERROR after ${maxRetries} retries:`, errorMsg);
                            }
                        } else {
                            results.failed++;
                            results.errors.push(`Baris ${rowNumber}: ${errorMsg}`);
                            console.error('   ❌ DB ERROR Row', rowNumber, ':', errorMsg);
                            inserted = true; // Stop retrying for other errors
                        }
                    }
                }

            } catch (e) {
                results.failed++;
                const message = e instanceof Error ? e.message : String(e);
                console.error(`❌ Row ${rowNumber} error:`, message);
                results.errors.push(`Baris ${rowNumber}: ${message}`);
            }
        }

        console.log(`📈 Import complete: Success=${results.success}, Failed=${results.failed}`);
        
        // Add helpful message if all rows failed
        let message = `Import selesai. Berhasil: ${results.success}, Gagal: ${results.failed}`;
        if (results.success === 0 && results.failed > 0) {
            message += '\n\n⚠️ Semua data gagal diimport. Cek format kolom Excel!';
            message += '\nPastikan kolom header: Nama, Telepon, Alamat';
        } else if (results.success === 0 && results.failed === 0) {
            message += '\n\n⚠️ Tidak ada data yang diproses!';
            message += '\nCek apakah file Excel berisi data di bawah header.';
        }

        return res.json({
            success: true,
            message: message,
            details: results,
            totalRows: data.length,
            firstRowColumns: Object.keys(data[0] || {})
        });
        
    } catch (error) {
        console.error('❌ Error importing customers:', error);
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak terduga';
        res.status(500).json({ 
            success: false,
            error: 'Gagal mengimport data pelanggan: ' + errorMessage 
        });
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
                // Note: gateway column does not exist in static_ip_clients table
                if (customerData.connection_type === 'static_ip' && customerData.ip_address) {
                    const staticIpQuery = `
                        INSERT INTO static_ip_clients (
                            customer_id, ip_address, interface, created_at
                        ) VALUES (?, ?, ?, NOW())
                    `;
                    
                    await databasePool.execute(staticIpQuery, [
                        customerId,
                        customerData.ip_address,
                        customerData.interface || null
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
