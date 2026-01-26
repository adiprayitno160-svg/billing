import { databasePool } from './src/db/pool';

(async () => {
  try {
    const [result] = await databasePool.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "customer_wa_lids"');
    console.log('customer_wa_lids table exists:', result[0].count > 0);
    
    if(result[0].count === 0) {
      console.log('Creating the table manually...');
      await databasePool.query(`
        CREATE TABLE IF NOT EXISTS customer_wa_lids (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          lid VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_customer_id (customer_id),
          INDEX idx_lid (lid),
          CONSTRAINT fk_customer_wa_lid FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('Table created successfully');
    } else {
      console.log('Table already exists');
    }
  } catch (error) {
    console.error('Error checking/creating table:', error);
  }
})();