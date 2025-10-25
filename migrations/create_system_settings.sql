-- =====================================================
-- System Settings Table
-- For storing application settings including update config
-- =====================================================

CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) UNIQUE NOT NULL,
  `setting_value` TEXT,
  `setting_type` ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  `description` TEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default system settings
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `description`) VALUES
('app_version', '1.0.0', 'string', 'Current application version'),
('github_repo_owner', 'adiprayitno160-svg', 'string', 'GitHub repository owner'),
('github_repo_name', 'billing_system', 'string', 'GitHub repository name'),
('auto_update_enabled', 'false', 'boolean', 'Enable automatic updates'),
('update_channel', 'stable', 'string', 'Update channel: stable, beta, dev'),
('last_update_check', NULL, 'string', 'Last time update was checked'),
('update_check_interval', '86400000', 'number', 'Update check interval in milliseconds (24 hours)')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- =====================================================
-- Update History Table
-- Track all updates applied to the system
-- =====================================================

CREATE TABLE IF NOT EXISTS `update_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_from` VARCHAR(20) NOT NULL,
  `version_to` VARCHAR(20) NOT NULL,
  `update_type` ENUM('major', 'minor', 'patch', 'hotfix') DEFAULT 'minor',
  `status` ENUM('pending', 'downloading', 'applying', 'success', 'failed', 'rolled_back') DEFAULT 'pending',
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  `error_message` TEXT,
  `changelog` TEXT,
  `files_changed` INT DEFAULT 0,
  `backup_path` VARCHAR(255),
  INDEX `idx_version_to` (`version_to`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

