import { Request, Response } from 'express';
import XLSX from 'xlsx';
import { databasePool } from '../db/pool';

// Halaman test import
export const getTestImportPage = async (req: Request, res: Response) => {
    res.render('test-import', {
        title: 'Test Import Excel',
        user: req.user
    });
};

// Test import - SUPER SIMPLE
export const testImportExcel = async (req: Request, res: Response) => {
    try {
        console.log('=== TEST IMPORT START ===');
        console.log('File received:', req.file ? 'YES' : 'NO');
        
        if (!req.file) {
            console.log('No file uploaded');
            return res.json({ 
                success: false, 
                error: 'No file uploaded' 
            });
        }

        console.log('File info:', {
            name: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        // Read Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log('Excel parsed, rows:', data.length);
        console.log('First row:', data[0]);

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row: any = data[i];
            const rowNum = i + 2;

            console.log(`Processing row ${rowNum}:`, row);

            try {
                // Get data
                const name = (row['Nama'] || row['nama'] || '').toString().trim();
                const phone = (row['Telepon'] || row['telepon'] || '').toString().trim();
                const address = (row['Alamat'] || row['alamat'] || '').toString().trim();

                console.log(`Row ${rowNum} data:`, { name, phone, address });

                // Validate
                if (!name) {
                    results.failed++;
                    results.errors.push(`Row ${rowNum}: Nama kosong`);
                    console.log(`Row ${rowNum}: FAILED - Nama kosong`);
                    continue;
                }

                if (!phone) {
                    results.failed++;
                    results.errors.push(`Row ${rowNum}: Telepon kosong`);
                    console.log(`Row ${rowNum}: FAILED - Telepon kosong`);
                    continue;
                }

                // Generate code & email
                const timestamp = Date.now();
                const customerCode = `TEST-${timestamp}-${i}`;
                const email = `test${timestamp}${i}@local.id`;

                console.log(`Row ${rowNum}: Inserting...`, { customerCode, name, phone });

                // Insert
                await databasePool.execute(
                    `INSERT INTO customers (customer_code, name, phone, email, address, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
                    [customerCode, name, phone, email, address]
                );

                results.success++;
                console.log(`Row ${rowNum}: SUCCESS`);

            } catch (err: any) {
                results.failed++;
                const errorMsg = err.message || String(err);
                results.errors.push(`Row ${rowNum}: ${errorMsg}`);
                console.error(`Row ${rowNum}: ERROR -`, errorMsg);
            }
        }

        console.log('=== TEST IMPORT COMPLETE ===');
        console.log('Results:', results);

        return res.json({
            success: true,
            message: `Import complete. Success: ${results.success}, Failed: ${results.failed}`,
            results: results
        });

    } catch (error: any) {
        console.error('=== TEST IMPORT ERROR ===');
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Import failed'
        });
    }
};

