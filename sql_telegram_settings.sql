-- ============================================
-- Telegram Settings Table
-- Menyimpan konfigurasi Telegram Bot
-- ============================================

CREATE TABLE IF NOT EXISTS `telegram_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bot_token` varchar(500) NOT NULL COMMENT 'Token bot dari BotFather',
  `auto_start` tinyint(1) DEFAULT 1 COMMENT 'Auto start bot saat server dimulai',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Pengaturan Telegram Bot';

-- Insert default settings (jika belum ada)
INSERT INTO `telegram_settings` (`bot_token`, `auto_start`) 
VALUES ('', 1)
ON DUPLICATE KEY UPDATE id=id;

