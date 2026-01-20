import { databasePool } from '../db/pool';

async function addStaticIPMonitoringColumns() {
  console.log('Adding missing columns for static IP monitoring...');
  
  const conn = await databasePool.getConnection();
  
  try {
    // Add the missing columns to the customers table
    const columnsToAdd = [
      {
        name: 'last_ping_check',
        definition: 'DATETIME NULL COMMENT \'Last ping check timestamp for static IP monitoring\''
      },
      {
        name: 'static_ip_monitoring_state',
        definition: "ENUM('normal', 'timeout_5min', 'timeout_10min', 'awaiting_confirmation_12min', 'ticket_created', 'resolved') DEFAULT 'normal' COMMENT 'Current monitoring state for static IP'"
      },
      {
        name: 'ping_timeout_started_at',
        definition: 'DATETIME NULL COMMENT \'Timestamp when ping timeout started\''
      },
      {
        name: 'awaiting_customer_response',
        definition: 'TINYINT(1) DEFAULT 0 COMMENT \'Flag indicating if awaiting customer response\''
      },
      {
        name: 'customer_response_received',
        definition: 'TINYINT(1) DEFAULT 0 COMMENT \'Flag indicating if customer response received\''
      }
    ];

    for (const column of columnsToAdd) {
      try {
        await conn.query(`ALTER TABLE customers ADD COLUMN ${column.name} ${column.definition}`);
        console.log(`✅ Added column: ${column.name}`);
      } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️  Column already exists: ${column.name}`);
        } else {
          console.error(`❌ Error adding column ${column.name}:`, error.message);
        }
      }
    }

    console.log('✅ All static IP monitoring columns have been added/verified!');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    conn.release();
  }
}

// Run the migration
if (require.main === module) {
  addStaticIPMonitoringColumns()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { addStaticIPMonitoringColumns };