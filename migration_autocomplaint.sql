CREATE TABLE IF NOT EXISTS auto_complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  phone VARCHAR(20),
  complaint_text TEXT,
  status VARCHAR(20) DEFAULT 'monitoring',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  escalate_at TIMESTAMP NULL,
  ticket_id INT NULL,
  INDEX idx_status (status),
  INDEX idx_escalate (escalate_at)
);

ALTER TABLE technician_jobs MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending';
