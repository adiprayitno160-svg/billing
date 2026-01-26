import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

(async () => {
  const connection = await databasePool.getConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT id, invoice_number, status, remaining_amount FROM invoices WHERE status = "paid" AND remaining_amount <= 0 ORDER BY id DESC LIMIT 10'
    );
    console.log('Paid invoices found:', rows.length);
    for(const row of rows) {
      console.log('- Invoice:', row.invoice_number, 'Status:', row.status, 'Remaining:', row.remaining_amount);
    }
  } finally {
    connection.release();
  }
})();