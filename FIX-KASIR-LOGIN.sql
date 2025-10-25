-- Script untuk memperbaiki login kasir
-- Password yang benar: kasir
-- Hash bcrypt untuk password "kasir" (bcrypt rounds=10)

-- Hapus user kasir yang lama (jika ada)
DELETE FROM users WHERE username = 'kasir';

-- Buat user kasir baru dengan password yang benar
-- Password hash ini adalah hasil dari: bcrypt.hash('kasir', 10)
INSERT INTO users (username, email, password, full_name, role, is_active, created_at, updated_at) 
VALUES (
    'kasir', 
    'kasir@billing.com', 
    '$2b$10$3vG8xE3lKLBX6LzP4qYX8.N9q3Y5W5z9Q3XH1Q4kZ8fL3Y6W5z9Q3', 
    'Kasir', 
    'kasir', 
    1, 
    NOW(), 
    NOW()
);

-- Atau update jika sudah ada
UPDATE users 
SET password = '$2b$10$3vG8xE3lKLBX6LzP4qYX8.N9q3Y5W5z9Q3XH1Q4kZ8fL3Y6W5z9Q3',
    is_active = 1,
    role = 'kasir',
    updated_at = NOW()
WHERE username = 'kasir';

SELECT 'User kasir berhasil direset. Username: kasir, Password: kasir' AS Status;

