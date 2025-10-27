-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.4.3 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for billing
CREATE DATABASE IF NOT EXISTS `billing` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `billing`;

-- Dumping structure for table billing.address_lists
CREATE TABLE IF NOT EXISTS `address_lists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `addresses` text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.address_lists: ~0 rows (approximately)
DELETE FROM `address_lists`;

-- Dumping structure for table billing.address_list_items
CREATE TABLE IF NOT EXISTS `address_list_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `address_list_id` int NOT NULL,
  `address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `disabled` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_address_per_list` (`address_list_id`,`address`),
  CONSTRAINT `fk_address_list_item` FOREIGN KEY (`address_list_id`) REFERENCES `address_lists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.address_list_items: ~0 rows (approximately)
DELETE FROM `address_list_items`;

-- Dumping structure for table billing.ai_analysis_results
CREATE TABLE IF NOT EXISTS `ai_analysis_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `analysis_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_data` text COLLATE utf8mb4_unicode_ci,
  `result_data` text COLLATE utf8mb4_unicode_ci,
  `confidence_score` decimal(5,4) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.ai_analysis_results: ~0 rows (approximately)
DELETE FROM `ai_analysis_results`;

-- Dumping structure for table billing.audit_logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `record_id` int DEFAULT NULL,
  `old_values` text COLLATE utf8mb4_unicode_ci,
  `new_values` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.audit_logs: ~0 rows (approximately)
DELETE FROM `audit_logs`;

-- Dumping structure for table billing.bulk_operations
CREATE TABLE IF NOT EXISTS `bulk_operations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `operation_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mac_addresses` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `result` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_operation_type` (`operation_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.bulk_operations: ~0 rows (approximately)
DELETE FROM `bulk_operations`;

-- Dumping structure for table billing.carry_over_invoices
CREATE TABLE IF NOT EXISTS `carry_over_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `carry_over_amount` decimal(12,2) NOT NULL,
  `target_period` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','applied','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `applied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_carry_over_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.carry_over_invoices: ~0 rows (approximately)
DELETE FROM `carry_over_invoices`;

-- Dumping structure for table billing.chart_of_accounts
CREATE TABLE IF NOT EXISTS `chart_of_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_type` enum('asset','liability','equity','revenue','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_code` (`account_code`),
  KEY `fk_account_parent` (`parent_id`),
  KEY `idx_account_code` (`account_code`),
  KEY `idx_account_type` (`account_type`),
  CONSTRAINT `fk_account_parent` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.chart_of_accounts: ~13 rows (approximately)
DELETE FROM `chart_of_accounts`;
INSERT INTO `chart_of_accounts` (`id`, `account_code`, `account_name`, `account_type`, `parent_id`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, '1101', 'Kas', 'asset', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(2, '1102', 'Bank', 'asset', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(3, '1201', 'Piutang Usaha', 'asset', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(4, '1202', 'Piutang Lain-lain', 'asset', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(5, '2101', 'Hutang Usaha', 'liability', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(6, '2102', 'Hutang Lain-lain', 'liability', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(7, '3101', 'Modal', 'equity', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(8, '3102', 'Laba Ditahan', 'equity', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(9, '4101', 'Pendapatan Internet', 'revenue', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(10, '4102', 'Pendapatan Lain-lain', 'revenue', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(11, '5101', 'Diskon Diberikan', 'expense', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(12, '5102', 'Biaya Operasional', 'expense', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(13, '5103', 'Biaya Administrasi', 'expense', NULL, 1, '2025-10-18 17:00:50', '2025-10-18 17:00:50');

-- Dumping structure for table billing.company_settings
CREATE TABLE IF NOT EXISTS `company_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company_address` text COLLATE utf8mb4_unicode_ci,
  `company_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_website` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.company_settings: ~0 rows (approximately)
DELETE FROM `company_settings`;
INSERT INTO `company_settings` (`id`, `company_name`, `company_address`, `company_phone`, `company_email`, `company_website`, `company_logo`, `tax_number`, `bank_name`, `bank_account_number`, `bank_account_name`, `created_at`, `updated_at`) VALUES
	(1, 'Billing System ISP', 'Jl. Contoh No. 123', '021-12345678', 'info@billing.com', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-23 02:24:02', '2025-10-23 02:24:02');

-- Dumping structure for table billing.connection_logs
CREATE TABLE IF NOT EXISTS `connection_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `service_type` enum('pppoe','static_ip') NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('online','offline') NOT NULL,
  `response_time_ms` int DEFAULT NULL COMMENT 'Ping response time for Static IP',
  `packet_loss_percent` decimal(5,2) DEFAULT NULL,
  `disconnect_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_status` (`status`),
  KEY `idx_lookup` (`customer_id`,`timestamp`,`status`),
  CONSTRAINT `connection_logs_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Connection status logs (checked every 1 minute)';

-- Dumping data for table billing.connection_logs: ~0 rows (approximately)
DELETE FROM `connection_logs`;

-- Dumping structure for table billing.customers
CREATE TABLE IF NOT EXISTS `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `connection_type` enum('pppoe','static_ip','hybrid') COLLATE utf8mb4_unicode_ci DEFAULT 'pppoe',
  `pppoe_username` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pppoe_profile_id` int DEFAULT NULL,
  `ont_id` int DEFAULT NULL,
  `odc_id` int DEFAULT NULL,
  `odp_id` int DEFAULT NULL,
  `status` enum('active','inactive','suspended') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `is_isolated` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `billing_mode` enum('postpaid','prepaid','hybrid') COLLATE utf8mb4_unicode_ci DEFAULT 'postpaid',
  `custom_sla_target` decimal(5,2) DEFAULT NULL COMMENT 'Custom SLA override, NULL = gunakan SLA dari paket',
  `prepaid_balance` decimal(12,2) DEFAULT '0.00',
  `auto_renewal` tinyint(1) DEFAULT '0',
  `area` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Geographic area',
  `odc_location` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ODC/ODP location',
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_code` (`customer_code`),
  KEY `fk_customer_ont` (`ont_id`),
  KEY `idx_customer_code` (`customer_code`),
  KEY `idx_name` (`name`),
  KEY `idx_phone` (`phone`),
  KEY `idx_status` (`status`),
  KEY `idx_connection_type` (`connection_type`),
  KEY `idx_area` (`area`),
  CONSTRAINT `fk_customer_ont` FOREIGN KEY (`ont_id`) REFERENCES `ftth_ont` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.customers: ~4 rows (approximately)
DELETE FROM `customers`;
INSERT INTO `customers` (`id`, `customer_code`, `name`, `phone`, `email`, `address`, `latitude`, `longitude`, `connection_type`, `pppoe_username`, `pppoe_profile_id`, `ont_id`, `odc_id`, `odp_id`, `status`, `is_isolated`, `created_at`, `updated_at`, `billing_mode`, `custom_sla_target`, `prepaid_balance`, `auto_renewal`, `area`, `odc_location`) VALUES
	(7, '20251021202904', 'mama', '0812315151', NULL, 'Banaran', -6.1976910, 106.8041900, 'pppoe', '11111', NULL, NULL, 1, 1, 'active', 0, '2025-10-21 13:29:24', '2025-10-21 13:29:24', 'postpaid', NULL, 0.00, 0, NULL, NULL),
	(8, '20251021204406', 'ASEM', '0812315151', NULL, 'Gambiran', -6.2131730, 106.8069790, 'pppoe', '20251017212104', NULL, NULL, 1, 1, 'active', 0, '2025-10-21 13:44:28', '2025-10-21 13:44:28', 'postpaid', NULL, 0.00, 0, NULL, NULL),
	(10, '20251021211624', 'MAMA ALOO', '08111515151', NULL, 'asdasda', -6.1889820, 106.7990400, 'static_ip', NULL, NULL, NULL, 1, 1, 'active', 0, '2025-10-21 14:16:24', '2025-10-21 14:16:24', 'postpaid', NULL, 0.00, 0, NULL, NULL),
	(11, '20251021211857', 'LLALALAL', '0812222', NULL, '1151knjn', -6.1999470, 106.7879680, 'static_ip', NULL, NULL, NULL, 1, 1, 'active', 1, '2025-10-21 14:18:57', '2025-10-24 13:36:01', 'prepaid', NULL, 0.00, 0, NULL, NULL);

-- Dumping structure for table billing.customer_discounts
CREATE TABLE IF NOT EXISTS `customer_discounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `discount_rule_id` int DEFAULT NULL,
  `discount_amount` decimal(12,2) NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `applied_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_customer_discount_rule` (`discount_rule_id`),
  KEY `fk_customer_discount_user` (`applied_by`),
  KEY `idx_customer_id` (`customer_id`),
  CONSTRAINT `fk_customer_discount_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_customer_discount_rule` FOREIGN KEY (`discount_rule_id`) REFERENCES `discount_rules` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customer_discount_user` FOREIGN KEY (`applied_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.customer_discounts: ~0 rows (approximately)
DELETE FROM `customer_discounts`;

-- Dumping structure for table billing.customer_migration_logs
CREATE TABLE IF NOT EXISTS `customer_migration_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `from_billing_mode` enum('postpaid','prepaid') COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_billing_mode` enum('postpaid','prepaid') COLLATE utf8mb4_unicode_ci NOT NULL,
  `migration_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `old_customer_data` json DEFAULT NULL,
  `outstanding_invoices_count` int DEFAULT '0',
  `outstanding_amount` decimal(12,2) DEFAULT '0.00',
  `migration_option` enum('pay_first','convert_debt','fresh_start','force') COLLATE utf8mb4_unicode_ci NOT NULL,
  `migrated_by` int DEFAULT NULL,
  `migration_status` enum('pending','completed','failed','rollback') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`migration_status`),
  CONSTRAINT `customer_migration_logs_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.customer_migration_logs: ~0 rows (approximately)
DELETE FROM `customer_migration_logs`;

-- Dumping structure for table billing.customer_speed_history
CREATE TABLE IF NOT EXISTS `customer_speed_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `subscription_id` int DEFAULT NULL,
  `old_speed_profile_id` int DEFAULT NULL,
  `new_speed_profile_id` int DEFAULT NULL,
  `old_speed_mbps` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_speed_mbps` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `change_reason` enum('purchase','upgrade','downgrade','admin','expired') COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `subscription_id` (`subscription_id`),
  KEY `idx_customer` (`customer_id`),
  CONSTRAINT `customer_speed_history_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `customer_speed_history_ibfk_2` FOREIGN KEY (`subscription_id`) REFERENCES `prepaid_package_subscriptions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.customer_speed_history: ~0 rows (approximately)
DELETE FROM `customer_speed_history`;

-- Dumping structure for table billing.debt_tracking
CREATE TABLE IF NOT EXISTS `debt_tracking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `invoice_id` int DEFAULT NULL,
  `debt_amount` decimal(12,2) NOT NULL,
  `debt_reason` text COLLATE utf8mb4_unicode_ci,
  `debt_date` date DEFAULT (curdate()),
  `due_date` date DEFAULT NULL,
  `status` enum('active','resolved','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by` int DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_debt_invoice` (`invoice_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_debt_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_debt_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.debt_tracking: ~0 rows (approximately)
DELETE FROM `debt_tracking`;
INSERT INTO `debt_tracking` (`id`, `customer_id`, `invoice_id`, `debt_amount`, `debt_reason`, `debt_date`, `due_date`, `status`, `resolved_at`, `resolved_by`, `notes`, `created_at`, `updated_at`) VALUES
	(3, 8, 44, 150000.00, 'Pencatatan hutang pelanggan', '2025-10-24', NULL, 'active', NULL, NULL, NULL, '2025-10-24 14:35:53', '2025-10-24 14:35:53');

-- Dumping structure for table billing.discount_rules
CREATE TABLE IF NOT EXISTS `discount_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount_type` enum('percentage','fixed') COLLATE utf8mb4_unicode_ci DEFAULT 'percentage',
  `discount_value` decimal(12,2) NOT NULL,
  `min_amount` decimal(12,2) DEFAULT '0.00',
  `valid_from` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.discount_rules: ~0 rows (approximately)
DELETE FROM `discount_rules`;

-- Dumping structure for table billing.email_queue
CREATE TABLE IF NOT EXISTS `email_queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `to_email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','sent','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `attempts` int DEFAULT '0',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.email_queue: ~0 rows (approximately)
DELETE FROM `email_queue`;

-- Dumping structure for table billing.ftth_odc
CREATE TABLE IF NOT EXISTS `ftth_odc` (
  `id` int NOT NULL AUTO_INCREMENT,
  `olt_id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `total_ports` int NOT NULL DEFAULT '0',
  `used_ports` int NOT NULL DEFAULT '0',
  `olt_card` int DEFAULT NULL,
  `olt_port` int DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_olt_id` (`olt_id`),
  KEY `idx_olt_card` (`olt_card`),
  KEY `idx_olt_port` (`olt_port`),
  CONSTRAINT `fk_odc_olt` FOREIGN KEY (`olt_id`) REFERENCES `ftth_olt` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.ftth_odc: ~0 rows (approximately)
DELETE FROM `ftth_odc`;
INSERT INTO `ftth_odc` (`id`, `olt_id`, `name`, `location`, `latitude`, `longitude`, `total_ports`, `used_ports`, `olt_card`, `olt_port`, `notes`, `created_at`, `updated_at`) VALUES
	(1, 1, 'DEPAN BALAI DESA', 'DEPAN BALADESA BESOLE', -8.2126796, 111.8224096, 8, 1, 1, 1, '', '2025-10-17 06:29:40', '2025-10-17 08:12:49');

-- Dumping structure for table billing.ftth_odp
CREATE TABLE IF NOT EXISTS `ftth_odp` (
  `id` int NOT NULL AUTO_INCREMENT,
  `odc_id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `total_ports` int NOT NULL DEFAULT '0',
  `used_ports` int NOT NULL DEFAULT '0',
  `olt_card` int DEFAULT NULL,
  `olt_port` int DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_odc_id` (`odc_id`),
  KEY `idx_olt_card` (`olt_card`),
  KEY `idx_olt_port` (`olt_port`),
  CONSTRAINT `fk_odp_odc` FOREIGN KEY (`odc_id`) REFERENCES `ftth_odc` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.ftth_odp: ~0 rows (approximately)
DELETE FROM `ftth_odp`;
INSERT INTO `ftth_odp` (`id`, `odc_id`, `name`, `location`, `latitude`, `longitude`, `total_ports`, `used_ports`, `olt_card`, `olt_port`, `notes`, `created_at`, `updated_at`) VALUES
	(1, 1, 'ADOH', '', -6.6318702, 107.3034668, 16, 16, NULL, NULL, '', '2025-10-17 06:30:30', '2025-10-17 06:30:30');

-- Dumping structure for table billing.ftth_olt
CREATE TABLE IF NOT EXISTS `ftth_olt` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `total_ports` int NOT NULL DEFAULT '0',
  `used_ports` int NOT NULL DEFAULT '0',
  `line_cards` int DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.ftth_olt: ~0 rows (approximately)
DELETE FROM `ftth_olt`;
INSERT INTO `ftth_olt` (`id`, `name`, `location`, `latitude`, `longitude`, `total_ports`, `used_ports`, `line_cards`, `notes`, `created_at`, `updated_at`) VALUES
	(1, 'OLT BESOLE', 'Desa Besole ', -8.2231284, 111.8197060, 24, 0, 3, 'Correct OLT structure: 3 cards, 24 total PON ports', '2025-10-17 00:28:25', '2025-10-20 00:14:39');

-- Dumping structure for table billing.ftth_ont
CREATE TABLE IF NOT EXISTS `ftth_ont` (
  `id` int NOT NULL AUTO_INCREMENT,
  `odp_id` int DEFAULT NULL,
  `ont_serial` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ont_mac` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ont_model` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive','suspended') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `signal_strength` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_online` timestamp NULL DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ont_serial` (`ont_serial`),
  KEY `idx_odp_id` (`odp_id`),
  KEY `idx_ont_serial` (`ont_serial`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_ont_odp` FOREIGN KEY (`odp_id`) REFERENCES `ftth_odp` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.ftth_ont: ~0 rows (approximately)
DELETE FROM `ftth_ont`;

-- Dumping structure for table billing.invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` int NOT NULL,
  `subscription_id` int DEFAULT NULL,
  `period` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `due_date` date NOT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(12,2) DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `paid_amount` decimal(12,2) DEFAULT '0.00',
  `remaining_amount` decimal(12,2) DEFAULT '0.00',
  `status` enum('draft','sent','partial','paid','overdue','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `last_payment_date` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `fk_invoice_subscription` (`subscription_id`),
  KEY `idx_invoice_number` (`invoice_number`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_period` (`period`),
  KEY `idx_due_date` (`due_date`),
  CONSTRAINT `fk_invoice_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.invoices: ~4 rows (approximately)
DELETE FROM `invoices`;
INSERT INTO `invoices` (`id`, `invoice_number`, `customer_id`, `subscription_id`, `period`, `due_date`, `subtotal`, `discount_amount`, `total_amount`, `paid_amount`, `remaining_amount`, `status`, `notes`, `last_payment_date`, `created_at`, `updated_at`) VALUES
	(43, 'INV/2025/10/0006', 7, 8, '2025-10', '2025-10-08', 150000.00, 0.00, 150000.00, 150000.00, 0.00, 'paid', NULL, '2025-10-24 07:00:00', '2025-10-24 07:06:16', '2025-10-24 12:41:24'),
	(44, 'INV/2025/10/0007', 8, 9, '2025-10', '2025-10-08', 150000.00, 0.00, 150000.00, 0.00, 150000.00, 'overdue', NULL, NULL, '2025-10-24 07:06:16', '2025-10-24 14:35:53'),
	(45, 'INV/2025/10/0008', 10, 10, '2025-10', '2025-10-08', 200000.00, 0.00, 200000.00, 200000.00, 0.00, 'paid', NULL, '2025-10-24 07:00:00', '2025-10-24 07:06:16', '2025-10-24 16:55:42'),
	(46, 'INV/2025/10/0009', 11, 11, '2025-10', '2025-10-08', 200000.00, 0.00, 200000.00, 200000.00, 0.00, 'paid', NULL, '2025-10-24 07:00:00', '2025-10-24 07:06:16', '2025-10-24 16:56:15');

-- Dumping structure for table billing.invoice_items
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) DEFAULT '1.00',
  `unit_price` decimal(12,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_id` (`invoice_id`),
  CONSTRAINT `fk_invoice_item` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.invoice_items: ~4 rows (approximately)
DELETE FROM `invoice_items`;
INSERT INTO `invoice_items` (`id`, `invoice_id`, `description`, `quantity`, `unit_price`, `total_price`, `created_at`) VALUES
	(43, 43, 'Paket Paket Internet 50Mbps - 2025-10', 1.00, 150000.00, 150000.00, '2025-10-24 07:06:16'),
	(44, 44, 'Paket Paket Internet 50Mbps - 2025-10', 1.00, 150000.00, 150000.00, '2025-10-24 07:06:16'),
	(45, 45, 'Paket Paket IP Static 100Mbps - 2025-10', 1.00, 200000.00, 200000.00, '2025-10-24 07:06:16'),
	(46, 46, 'Paket Paket IP Static 100Mbps - 2025-10', 1.00, 200000.00, 200000.00, '2025-10-24 07:06:16');

-- Dumping structure for table billing.invoice_payment_sessions
CREATE TABLE IF NOT EXISTS `invoice_payment_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `session_token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_amount` decimal(12,2) NOT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','completed','expired','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token` (`session_token`),
  KEY `idx_invoice_id` (`invoice_id`),
  KEY `idx_session_token` (`session_token`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_payment_session_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.invoice_payment_sessions: ~2 rows (approximately)
DELETE FROM `invoice_payment_sessions`;

-- Dumping structure for table billing.isolation_logs
CREATE TABLE IF NOT EXISTS `isolation_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `action` enum('isolate','restore') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `performed_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_isolation_user` (`performed_by`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_isolation_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_isolation_user` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.isolation_logs: ~0 rows (approximately)
DELETE FROM `isolation_logs`;

-- Dumping structure for table billing.isolation_settings
CREATE TABLE IF NOT EXISTS `isolation_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Setting name',
  `schedule_type` enum('daily','monthly','custom') COLLATE utf8mb4_unicode_ci DEFAULT 'monthly',
  `schedule_day` int DEFAULT '1' COMMENT 'Day of month for monthly, 0 for daily',
  `schedule_hour` int DEFAULT '1' COMMENT 'Hour (0-23)',
  `schedule_minute` int DEFAULT '0' COMMENT 'Minute (0-59)',
  `grace_period_days` int DEFAULT '3' COMMENT 'Days after due date before isolation',
  `auto_restore_on_payment` tinyint(1) DEFAULT '1' COMMENT 'Auto restore when paid',
  `send_notification` tinyint(1) DEFAULT '1' COMMENT 'Send WhatsApp notification',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.isolation_settings: ~2 rows (approximately)
DELETE FROM `isolation_settings`;
INSERT INTO `isolation_settings` (`id`, `name`, `schedule_type`, `schedule_day`, `schedule_hour`, `schedule_minute`, `grace_period_days`, `auto_restore_on_payment`, `send_notification`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, 'auto_isolation', 'monthly', 3, 1, 0, 3, 1, 1, 1, '2025-10-23 03:01:22', '2025-10-23 03:01:22'),
	(2, 'manual_check', 'daily', 0, 6, 0, 0, 1, 1, 1, '2025-10-23 03:01:22', '2025-10-23 03:01:22');

-- Dumping structure for table billing.journal_entries
CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entry_date` date NOT NULL,
  `reference_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `account_id` int NOT NULL,
  `debit` decimal(15,2) DEFAULT '0.00',
  `credit` decimal(15,2) DEFAULT '0.00',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_journal_user` (`created_by`),
  KEY `idx_entry_date` (`entry_date`),
  KEY `idx_account_id` (`account_id`),
  CONSTRAINT `fk_journal_account` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_journal_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.journal_entries: ~0 rows (approximately)
DELETE FROM `journal_entries`;

-- Dumping structure for table billing.maintenance_notifications
CREATE TABLE IF NOT EXISTS `maintenance_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `maintenance_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `notification_type` enum('whatsapp','telegram','email') NOT NULL,
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('sent','failed','pending') DEFAULT 'pending',
  `error_message` text,
  PRIMARY KEY (`id`),
  KEY `idx_maintenance` (`maintenance_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `maintenance_notifications_ibfk_1` FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance_schedules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `maintenance_notifications_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.maintenance_notifications: ~0 rows (approximately)
DELETE FROM `maintenance_notifications`;

-- Dumping structure for table billing.maintenance_schedules
CREATE TABLE IF NOT EXISTS `maintenance_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `start_time` timestamp NOT NULL,
  `end_time` timestamp NOT NULL,
  `status` enum('scheduled','ongoing','completed','cancelled') DEFAULT 'scheduled',
  `maintenance_type` enum('planned','emergency','upgrade') DEFAULT 'planned',
  `affected_customers` json DEFAULT NULL COMMENT 'Array of customer IDs',
  `affected_areas` json DEFAULT NULL COMMENT 'Array of area names',
  `notification_sent` tinyint(1) DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_type` (`maintenance_type`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `maintenance_schedules_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.maintenance_schedules: ~0 rows (approximately)
DELETE FROM `maintenance_schedules`;

-- Dumping structure for table billing.migration_history
CREATE TABLE IF NOT EXISTS `migration_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `from_mode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'postpaid atau prepaid',
  `to_mode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'postpaid atau prepaid',
  `migrated_by` int DEFAULT NULL COMMENT 'ID admin yang melakukan migrasi',
  `portal_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Portal ID yang di-generate',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.migration_history: ~0 rows (approximately)
DELETE FROM `migration_history`;
INSERT INTO `migration_history` (`id`, `customer_id`, `from_mode`, `to_mode`, `migrated_by`, `portal_id`, `notes`, `created_at`) VALUES
	(1, 11, 'postpaid', 'prepaid', NULL, '12442102', 'Migrasi dari sistem postpaid ke prepaid', '2025-10-24 13:36:01');

-- Dumping structure for table billing.mikrotik_address_lists
CREATE TABLE IF NOT EXISTS `mikrotik_address_lists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `list_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `purpose` enum('portal-redirect','isolation','whitelist','blacklist') COLLATE utf8mb4_unicode_ci NOT NULL,
  `auto_manage` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `list_name` (`list_name`),
  KEY `idx_purpose` (`purpose`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.mikrotik_address_lists: ~2 rows (approximately)
DELETE FROM `mikrotik_address_lists`;
INSERT INTO `mikrotik_address_lists` (`id`, `list_name`, `description`, `purpose`, `auto_manage`, `is_active`, `created_at`) VALUES
	(1, 'portal-redirect', 'Customers redirected to prepaid portal', 'portal-redirect', 1, 1, '2025-10-24 10:47:22'),
	(2, 'isolated-customers', 'Customers isolated for non-payment', 'isolation', 1, 1, '2025-10-24 10:47:22');

-- Dumping structure for table billing.mikrotik_address_list_items
CREATE TABLE IF NOT EXISTS `mikrotik_address_list_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `address_list_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `added_by` int DEFAULT NULL,
  `mikrotik_entry_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sync_status` enum('pending','synced','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `auto_remove` tinyint(1) DEFAULT '0',
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `synced_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `address_list_id` (`address_list_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_sync_status` (`sync_status`),
  KEY `idx_ip` (`ip_address`),
  CONSTRAINT `mikrotik_address_list_items_ibfk_1` FOREIGN KEY (`address_list_id`) REFERENCES `mikrotik_address_lists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mikrotik_address_list_items_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.mikrotik_address_list_items: ~1 rows (approximately)
DELETE FROM `mikrotik_address_list_items`;
INSERT INTO `mikrotik_address_list_items` (`id`, `address_list_id`, `customer_id`, `ip_address`, `reason`, `added_by`, `mikrotik_entry_id`, `sync_status`, `auto_remove`, `expires_at`, `created_at`, `synced_at`) VALUES
	(1, 1, 11, '192.168.1.9/30', 'Migrasi ke prepaid - belum ada paket', NULL, '*23z4tkzmo', 'synced', 1, NULL, '2025-10-24 13:36:01', '2025-10-24 13:36:01');

-- Dumping structure for table billing.mikrotik_settings
CREATE TABLE IF NOT EXISTS `mikrotik_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `host` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` int NOT NULL DEFAULT '8728',
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `use_tls` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.mikrotik_settings: ~2 rows (approximately)
DELETE FROM `mikrotik_settings`;
INSERT INTO `mikrotik_settings` (`id`, `host`, `port`, `username`, `password`, `use_tls`, `created_at`, `updated_at`) VALUES
	(1, '192.168.5.1', 8728, 'adii', 'adi', 0, '2025-10-16 15:58:16', '2025-10-16 15:58:16'),
	(2, '192.168.239.25', 8728, 'pak', 'sempak', 0, '2025-10-17 01:38:57', '2025-10-24 07:49:42');

-- Dumping structure for table billing.ml_models
CREATE TABLE IF NOT EXISTS `ml_models` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `accuracy_score` decimal(5,4) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.ml_models: ~4 rows (approximately)
DELETE FROM `ml_models`;
INSERT INTO `ml_models` (`id`, `model_name`, `model_type`, `model_version`, `model_path`, `is_active`, `accuracy_score`, `created_at`, `updated_at`) VALUES
	(1, 'fraud_detection_v1', 'fraud_detection', '1.0', '/models/fraud_detection_v1.json', 1, 0.9500, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(2, 'anomaly_detection_v1', 'anomaly_detection', '1.0', '/models/anomaly_detection_v1.json', 1, 0.9200, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(3, 'sentiment_analysis_v1', 'sentiment_analysis', '1.0', '/models/sentiment_analysis_v1.json', 1, 0.8800, '2025-10-18 17:00:50', '2025-10-18 17:00:50'),
	(4, 'intent_recognition_v1', 'intent_recognition', '1.0', '/models/intent_recognition_v1.json', 1, 0.9000, '2025-10-18 17:00:50', '2025-10-18 17:00:50');

-- Dumping structure for table billing.notification_logs
CREATE TABLE IF NOT EXISTS `notification_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int DEFAULT NULL,
  `notification_type` enum('whatsapp','email','sms') COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','sent','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_notification_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.notification_logs: ~0 rows (approximately)
DELETE FROM `notification_logs`;

-- Dumping structure for table billing.olt_port_info
CREATE TABLE IF NOT EXISTS `olt_port_info` (
  `id` int NOT NULL AUTO_INCREMENT,
  `olt_id` int NOT NULL,
  `port_number` int NOT NULL,
  `port_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive','error') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `ont_count` int DEFAULT '0',
  `max_onts` int DEFAULT '128',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_olt_id` (`olt_id`),
  CONSTRAINT `fk_olt_port_olt` FOREIGN KEY (`olt_id`) REFERENCES `ftth_olt` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.olt_port_info: ~0 rows (approximately)
DELETE FROM `olt_port_info`;

-- Dumping structure for table billing.parent_queues
CREATE TABLE IF NOT EXISTS `parent_queues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_limit` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `burst_limit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_threshold` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_time` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` int DEFAULT '8',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.parent_queues: ~0 rows (approximately)
DELETE FROM `parent_queues`;

-- Dumping structure for table billing.payments
CREATE TABLE IF NOT EXISTS `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `payment_method` enum('cash','transfer','gateway','qris','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reference_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gateway_transaction_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gateway_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_id` (`invoice_id`),
  KEY `idx_payment_method` (`payment_method`),
  KEY `idx_payment_date` (`payment_date`),
  CONSTRAINT `fk_payment_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.payments: ~3 rows (approximately)
DELETE FROM `payments`;
INSERT INTO `payments` (`id`, `invoice_id`, `payment_method`, `amount`, `payment_date`, `reference_number`, `gateway_transaction_id`, `gateway_status`, `notes`, `created_at`) VALUES
	(6, 43, 'cash', 150000.00, '2025-10-24 07:00:00', NULL, NULL, NULL, NULL, '2025-10-24 12:41:24'),
	(7, 45, 'cash', 200000.00, '2025-10-24 07:00:00', NULL, NULL, NULL, NULL, '2025-10-24 16:55:42'),
	(8, 46, 'cash', 200000.00, '2025-10-24 07:00:00', NULL, NULL, NULL, NULL, '2025-10-24 16:56:15');

-- Dumping structure for table billing.payment_gateways
CREATE TABLE IF NOT EXISTS `payment_gateways` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('tripay','xendit','midtrans','mitra','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `config` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_code` (`code`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.payment_gateways: ~3 rows (approximately)
DELETE FROM `payment_gateways`;
INSERT INTO `payment_gateways` (`id`, `name`, `code`, `type`, `config`, `is_active`, `created_at`) VALUES
	(1, 'Xendit', 'xendit', '', '{"supported_methods": ["virtual_account", "ewallet", "retail_outlet", "credit_card"]}', 1, '2025-10-19 05:23:03'),
	(2, 'Mitra', 'mitra', '', '{"supported_methods": ["bank_transfer", "virtual_account", "ewallet"]}', 1, '2025-10-19 05:23:03'),
	(3, 'Tripay', 'tripay', '', '{"supported_methods": ["virtual_account", "ewallet", "convenience_store"]}', 1, '2025-10-19 05:23:03');

-- Dumping structure for table billing.payment_gateway_settings
CREATE TABLE IF NOT EXISTS `payment_gateway_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `gateway_name` enum('tripay','xendit','midtrans','mitra') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  `is_production` tinyint(1) DEFAULT '0',
  `api_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `api_secret` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `merchant_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `callback_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `return_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auto_approve` tinyint(1) DEFAULT '1' COMMENT 'Auto approve successful payments',
  `admin_fee_type` enum('fixed','percentage') COLLATE utf8mb4_unicode_ci DEFAULT 'fixed',
  `admin_fee_value` decimal(12,2) DEFAULT '0.00',
  `min_amount` decimal(12,2) DEFAULT '10000.00',
  `max_amount` decimal(12,2) DEFAULT '50000000.00',
  `supported_channels` json DEFAULT NULL COMMENT 'Array of payment channels',
  `config` json DEFAULT NULL COMMENT 'Additional gateway-specific config',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_gateway` (`gateway_name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.payment_gateway_settings: ~4 rows (approximately)
DELETE FROM `payment_gateway_settings`;
INSERT INTO `payment_gateway_settings` (`id`, `gateway_name`, `is_active`, `is_production`, `api_key`, `api_secret`, `merchant_code`, `callback_url`, `return_url`, `auto_approve`, `admin_fee_type`, `admin_fee_value`, `min_amount`, `max_amount`, `supported_channels`, `config`, `created_at`, `updated_at`) VALUES
	(1, 'tripay', 0, 0, NULL, NULL, NULL, NULL, NULL, 1, 'fixed', 0.00, 10000.00, 50000000.00, '["BRIVA", "BNIVA", "MANDIRIVA", "BCAVA", "QRIS", "ALFAMART", "INDOMARET"]', NULL, '2025-10-23 03:01:23', '2025-10-23 03:01:23'),
	(2, 'xendit', 0, 0, NULL, NULL, NULL, NULL, NULL, 1, 'fixed', 0.00, 10000.00, 50000000.00, '["BCA", "BNI", "BRI", "MANDIRI", "PERMATA", "EWALLET", "QRIS"]', NULL, '2025-10-23 03:01:23', '2025-10-23 03:01:23'),
	(3, 'midtrans', 0, 0, NULL, NULL, NULL, NULL, NULL, 1, 'fixed', 0.00, 10000.00, 50000000.00, '["gopay", "shopeepay", "qris", "bank_transfer", "cstore"]', NULL, '2025-10-23 03:01:23', '2025-10-23 03:01:23'),
	(4, 'mitra', 0, 0, NULL, NULL, NULL, NULL, NULL, 1, 'fixed', 0.00, 10000.00, 50000000.00, '["cash", "transfer"]', NULL, '2025-10-23 03:01:23', '2025-10-23 03:01:23');

-- Dumping structure for table billing.payment_transactions
CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `transaction_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_type` enum('full','partial','debt') COLLATE utf8mb4_unicode_ci DEFAULT 'full',
  `payment_method` enum('manual','tripay','xendit','midtrans','mitra') COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `amount` decimal(12,2) NOT NULL,
  `admin_fee` decimal(12,2) DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL,
  `remaining_debt` decimal(12,2) DEFAULT '0.00' COMMENT 'For partial payments',
  `status` enum('pending','success','failed','cancelled','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `payment_date` datetime DEFAULT NULL,
  `approved_by` int DEFAULT NULL COMMENT 'User ID who approved',
  `approved_at` datetime DEFAULT NULL,
  `auto_approved` tinyint(1) DEFAULT '0',
  `gateway_reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Payment gateway reference ID',
  `gateway_response` json DEFAULT NULL,
  `proof_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Upload bukti transfer',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_code` (`transaction_code`),
  KEY `idx_invoice` (`invoice_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_payment_type` (`payment_type`),
  KEY `idx_transaction_code` (`transaction_code`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `payment_transactions_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_transactions_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_transactions_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.payment_transactions: ~0 rows (approximately)
DELETE FROM `payment_transactions`;

-- Dumping structure for table billing.portal_customers
CREATE TABLE IF NOT EXISTS `portal_customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `portal_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `portal_pin` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive','blocked') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `last_login` datetime DEFAULT NULL,
  `login_attempts` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_id` (`customer_id`),
  UNIQUE KEY `portal_id` (`portal_id`),
  KEY `idx_portal_id` (`portal_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `portal_customers_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.portal_customers: ~1 rows (approximately)
DELETE FROM `portal_customers`;
INSERT INTO `portal_customers` (`id`, `customer_id`, `portal_id`, `portal_pin`, `status`, `last_login`, `login_attempts`, `created_at`, `updated_at`) VALUES
	(9, 11, '12442102', '$2b$10$XnZE0A5plvtE1b6i0hawA.L8bq2k7hP54xY1IEs0y9CaLLmtb0G7i', 'active', NULL, 0, '2025-10-24 13:36:01', '2025-10-24 13:36:01');

-- Dumping structure for table billing.pppoe_new_requests
CREATE TABLE IF NOT EXISTS `pppoe_new_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `package_id` int DEFAULT NULL,
  `requested_bandwidth` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `installation_address` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','approved','rejected','completed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_pppoe_request_package` (`package_id`),
  KEY `fk_pppoe_request_approver` (`approved_by`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_pppoe_request_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pppoe_request_package` FOREIGN KEY (`package_id`) REFERENCES `pppoe_packages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.pppoe_new_requests: ~0 rows (approximately)
DELETE FROM `pppoe_new_requests`;

-- Dumping structure for table billing.pppoe_packages
CREATE TABLE IF NOT EXISTS `pppoe_packages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_id` int DEFAULT NULL,
  `rate_limit_rx` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rate_limit_tx` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `burst_limit_rx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_limit_tx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_threshold_rx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_threshold_tx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_time_rx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_time_tx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(12,2) DEFAULT '0.00',
  `sla_target` decimal(5,2) DEFAULT '90.00' COMMENT 'Target SLA dalam persen (90.00 = 90% uptime)',
  `duration_days` int DEFAULT '30',
  `auto_activation` tinyint(1) DEFAULT '0' COMMENT '1=auto activate on subscribe, 0=manual activation',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_name` (`name`),
  KEY `idx_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.pppoe_packages: ~0 rows (approximately)
DELETE FROM `pppoe_packages`;

-- Dumping structure for table billing.pppoe_profiles
CREATE TABLE IF NOT EXISTS `pppoe_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `local_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remote_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remote_address_pool` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dns_server` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rate_limit` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rate_limit_rx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rate_limit_tx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_limit_rx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_limit_tx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_threshold_rx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_threshold_tx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_time_rx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `burst_time_tx` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `only_one` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'default',
  `change_tcp_mss` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `use_compression` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `use_encryption` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `use_mpls` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `use_upnp` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `session_timeout` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idle_timeout` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keepalive_timeout` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.pppoe_profiles: ~12 rows (approximately)
DELETE FROM `pppoe_profiles`;
INSERT INTO `pppoe_profiles` (`id`, `name`, `local_address`, `remote_address`, `remote_address_pool`, `dns_server`, `rate_limit`, `rate_limit_rx`, `rate_limit_tx`, `burst_limit_rx`, `burst_limit_tx`, `burst_threshold_rx`, `burst_threshold_tx`, `burst_time_rx`, `burst_time_tx`, `only_one`, `change_tcp_mss`, `use_compression`, `use_encryption`, `use_mpls`, `use_upnp`, `comment`, `session_timeout`, `idle_timeout`, `keepalive_timeout`, `status`, `created_at`, `updated_at`) VALUES
	(1, 'default', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'default', 'yes', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(2, '110k', '160.160.0.1', NULL, 'PPPOE', '94.140.14.14,8.8.4.4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'yes', 'yes', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(3, 'PAKET50k', '160.160.0.1', NULL, 'PPPOE', '208.67.222.222,8.8.4.4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'no', 'default', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(4, '8M PURAN', '160.160.0.1', NULL, 'PPPOE', '208.67.222.222,8.8.8.8', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'no', 'default', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(5, 'GRATIS', '160.160.0.1', NULL, 'PPPOE', '1.1.1.1,8.8.4.4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'no', 'default', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(6, 'PAKET100', '160.160.0.1', NULL, 'PPPOE', '208.67.222.222,8.8.4.4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'no', 'default', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(7, 'profile-Isolir', '191.168.1.1', NULL, 'POOL-ISOLIR', '191.168.1.1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'default', 'default', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(8, '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'default', 'default', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(9, 'test-profile', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'default', 'default', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(10, 'demo-profile', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'default', 'default', 'default', 'default', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(11, 'Test-Profile-20M', '192.168.1.1', NULL, '192.168.1.2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'default', 'default', 'default', 'default', 'default', 'default', 'Profile for package: Test PPPoE Package', NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27'),
	(12, 'default-encryption', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'default', 'yes', 'default', 'yes', 'default', 'default', NULL, NULL, NULL, NULL, 'active', '2025-10-23 02:44:27', '2025-10-23 02:44:27');

-- Dumping structure for table billing.prepaid_customers
CREATE TABLE IF NOT EXISTS `prepaid_customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `balance` decimal(12,2) DEFAULT '0.00',
  `status` enum('active','suspended','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_code` (`customer_code`),
  KEY `idx_customer_code` (`customer_code`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.prepaid_customers: ~5 rows (approximately)
DELETE FROM `prepaid_customers`;
INSERT INTO `prepaid_customers` (`id`, `customer_code`, `name`, `email`, `phone`, `address`, `balance`, `status`, `created_at`, `updated_at`) VALUES
	(1, 'PREP001', 'John Doe', 'john@example.com', '081234567890', 'Jl. Merdeka No. 1', 50000.00, 'active', '2025-10-19 01:27:13', '2025-10-19 01:27:13'),
	(2, 'PREP002', 'Jane Smith', 'jane@example.com', '081234567891', 'Jl. Sudirman No. 2', 25000.00, 'active', '2025-10-19 01:27:13', '2025-10-19 01:27:13'),
	(3, 'PREP003', 'Bob Johnson', 'bob@example.com', '081234567892', 'Jl. Thamrin No. 3', 0.00, 'suspended', '2025-10-19 01:27:13', '2025-10-19 01:27:13'),
	(4, 'PREP004', 'Alice Brown', 'alice@example.com', '081234567893', 'Jl. Gatot Subroto No. 4', 75000.00, 'active', '2025-10-19 01:27:13', '2025-10-19 01:27:13'),
	(5, 'PREP005', 'Charlie Wilson', 'charlie@example.com', '081234567894', 'Jl. Rasuna Said No. 5', 10000.00, 'active', '2025-10-19 01:27:13', '2025-10-19 01:27:13');

-- Dumping structure for table billing.prepaid_packages
CREATE TABLE IF NOT EXISTS `prepaid_packages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `duration_hours` int NOT NULL,
  `speed_mbps` int NOT NULL,
  `data_limit_gb` int DEFAULT NULL,
  `package_type` enum('daily','weekly','monthly','data') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `speed_profile_id` int DEFAULT NULL,
  `download_speed_mbps` int DEFAULT '10',
  `upload_speed_mbps` int DEFAULT '10',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  PRIMARY KEY (`id`),
  KEY `idx_package_type` (`package_type`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.prepaid_packages: ~10 rows (approximately)
DELETE FROM `prepaid_packages`;
INSERT INTO `prepaid_packages` (`id`, `name`, `price`, `duration_hours`, `speed_mbps`, `data_limit_gb`, `package_type`, `is_active`, `created_at`, `updated_at`, `speed_profile_id`, `download_speed_mbps`, `upload_speed_mbps`, `status`) VALUES
	(1, 'Paket 1 Hari', 5000.00, 24, 10, 2, 'daily', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', 2, 10, 10, 'active'),
	(2, 'Paket 3 Hari', 12000.00, 72, 15, 5, 'daily', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', NULL, 15, 15, 'active'),
	(3, 'Paket 7 Hari', 25000.00, 168, 20, 10, 'weekly', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', 3, 20, 20, 'active'),
	(4, 'Paket 1 Minggu', 30000.00, 168, 25, 15, 'weekly', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', NULL, 25, 25, 'active'),
	(5, 'Paket 2 Minggu', 55000.00, 336, 30, 30, 'weekly', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', NULL, 30, 30, 'active'),
	(6, 'Paket 1 Bulan', 100000.00, 720, 50, 100, 'monthly', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', 4, 50, 50, 'active'),
	(7, 'Paket 5 GB', 15000.00, 168, 20, 5, 'data', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', 3, 20, 20, 'active'),
	(8, 'Paket 10 GB', 25000.00, 336, 25, 10, 'data', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', NULL, 25, 25, 'active'),
	(9, 'Paket 20 GB', 45000.00, 720, 30, 20, 'data', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', NULL, 30, 30, 'active'),
	(10, 'Paket 50 GB', 100000.00, 1440, 50, 50, 'data', 1, '2025-10-19 01:27:13', '2025-10-24 10:47:24', 4, 50, 50, 'active');

-- Dumping structure for table billing.prepaid_package_subscriptions
CREATE TABLE IF NOT EXISTS `prepaid_package_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `package_id` int NOT NULL,
  `activation_date` datetime NOT NULL,
  `expiry_date` datetime NOT NULL,
  `status` enum('active','expired','suspended','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `auto_renew` tinyint(1) DEFAULT '0',
  `purchase_price` decimal(12,2) NOT NULL,
  `invoice_id` int DEFAULT NULL,
  `mikrotik_synced` tinyint(1) DEFAULT '0',
  `pppoe_username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `package_id` (`package_id`),
  KEY `idx_customer_status` (`customer_id`,`status`),
  KEY `idx_expiry` (`expiry_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `prepaid_package_subscriptions_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prepaid_package_subscriptions_ibfk_2` FOREIGN KEY (`package_id`) REFERENCES `prepaid_packages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.prepaid_package_subscriptions: ~0 rows (approximately)
DELETE FROM `prepaid_package_subscriptions`;

-- Dumping structure for table billing.scheduler_logs
CREATE TABLE IF NOT EXISTS `scheduler_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_name` (`task_name`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.scheduler_logs: ~0 rows (approximately)
DELETE FROM `scheduler_logs`;

-- Dumping structure for table billing.scheduler_settings
CREATE TABLE IF NOT EXISTS `scheduler_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cron_schedule` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_enabled` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_run` timestamp NULL DEFAULT NULL,
  `next_run` timestamp NULL DEFAULT NULL,
  `config` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_name` (`task_name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.scheduler_settings: ~5 rows (approximately)
DELETE FROM `scheduler_settings`;
INSERT INTO `scheduler_settings` (`id`, `task_name`, `cron_schedule`, `is_enabled`, `created_at`, `updated_at`, `last_run`, `next_run`, `config`) VALUES
	(1, 'monthly_invoice', '10 0 1 * *', 1, '2025-10-23 02:24:02', '2025-10-23 02:24:02', NULL, NULL, NULL),
	(2, 'auto_isolation', '0 1 1 * *', 1, '2025-10-23 02:24:02', '2025-10-23 02:24:02', NULL, NULL, NULL),
	(3, 'payment_reminder', '0 8 * * *', 1, '2025-10-23 02:24:02', '2025-10-23 02:24:02', NULL, NULL, NULL),
	(4, 'overdue_notification', '0 10 * * *', 1, '2025-10-23 02:24:02', '2025-10-23 02:24:02', NULL, NULL, NULL),
	(5, 'invoice_generation', '0 1 1 * *', 1, '2025-10-23 04:24:33', '2025-10-24 10:30:26', NULL, NULL, '{"auto_generate_enabled":true,"due_date_offset":7,"auto_send_whatsapp":true,"whatsapp_reminder_enabled":true,"reminder_days_before":3,"auto_isolir_enabled":true,"isolir_mode":"fixed_date","isolir_date":1,"isolir_days_after_due":1,"isolir_grace_period":1,"isolir_execution_time":"01:00"}');

-- Dumping structure for table billing.sla_incidents
CREATE TABLE IF NOT EXISTS `sla_incidents` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `service_type` enum('pppoe','static_ip') NOT NULL DEFAULT 'pppoe',
  `incident_type` enum('downtime','degraded','maintenance') NOT NULL DEFAULT 'downtime',
  `start_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration_minutes` int DEFAULT '0',
  `status` enum('ongoing','resolved','excluded') DEFAULT 'ongoing',
  `exclude_reason` enum('maintenance','force_majeure','customer_fault','transient','isolated') DEFAULT NULL,
  `exclude_notes` text,
  `is_counted_in_sla` tinyint(1) DEFAULT '1',
  `technician_id` int DEFAULT NULL,
  `resolved_by` int DEFAULT NULL,
  `alert_sent_telegram` tinyint(1) DEFAULT '0',
  `alert_sent_whatsapp` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `sla_incidents_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.sla_incidents: ~0 rows (approximately)
DELETE FROM `sla_incidents`;

-- Dumping structure for table billing.sla_policies
CREATE TABLE IF NOT EXISTS `sla_policies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `policy_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `min_uptime_percent` decimal(5,2) DEFAULT '99.00',
  `max_downtime_minutes` int DEFAULT '0',
  `compensation_type` enum('discount','credit','refund') COLLATE utf8mb4_unicode_ci DEFAULT 'discount',
  `compensation_amount` decimal(12,2) DEFAULT '0.00',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.sla_policies: ~0 rows (approximately)
DELETE FROM `sla_policies`;

-- Dumping structure for table billing.sla_records
CREATE TABLE IF NOT EXISTS `sla_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `month_year` date NOT NULL,
  `total_minutes` int DEFAULT '43200',
  `downtime_minutes` int DEFAULT '0',
  `sla_percentage` decimal(5,2) DEFAULT '100.00',
  `sla_status` enum('met','breach','warning') DEFAULT 'met',
  `incident_count` int DEFAULT '0',
  `discount_amount` decimal(15,2) DEFAULT '0.00',
  `discount_approved` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_month` (`customer_id`,`month_year`),
  CONSTRAINT `sla_records_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.sla_records: ~0 rows (approximately)
DELETE FROM `sla_records`;

-- Dumping structure for table billing.speed_profiles
CREATE TABLE IF NOT EXISTS `speed_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `download_mbps` int NOT NULL,
  `upload_mbps` int NOT NULL,
  `burst_limit_mbps` int DEFAULT '0',
  `burst_time_seconds` int DEFAULT '0',
  `burst_threshold_mbps` int DEFAULT '0',
  `priority` int DEFAULT '8',
  `mikrotik_profile_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mikrotik_profile_name` (`mikrotik_profile_name`),
  KEY `idx_active` (`is_active`),
  KEY `idx_mikrotik_name` (`mikrotik_profile_name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.speed_profiles: ~5 rows (approximately)
DELETE FROM `speed_profiles`;
INSERT INTO `speed_profiles` (`id`, `name`, `download_mbps`, `upload_mbps`, `burst_limit_mbps`, `burst_time_seconds`, `burst_threshold_mbps`, `priority`, `mikrotik_profile_name`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, '5Mbps-Prepaid', 5, 5, 6, 30, 0, 8, '5M-PREP', 1, '2025-10-24 10:46:06', '2025-10-24 10:46:06'),
	(2, '10Mbps-Prepaid', 10, 10, 12, 30, 0, 8, '10M-PREP', 1, '2025-10-24 10:46:06', '2025-10-24 10:46:06'),
	(3, '20Mbps-Prepaid', 20, 20, 24, 30, 0, 8, '20M-PREP', 1, '2025-10-24 10:46:06', '2025-10-24 10:46:06'),
	(4, '50Mbps-Prepaid', 50, 50, 60, 30, 0, 8, '50M-PREP', 1, '2025-10-24 10:46:06', '2025-10-24 10:46:06'),
	(5, '100Mbps-Prepaid', 100, 100, 120, 30, 0, 8, '100M-PREP', 1, '2025-10-24 10:46:06', '2025-10-24 10:46:06');

-- Dumping structure for procedure billing.sp_get_telegram_bot_stats
DELIMITER //
CREATE PROCEDURE `sp_get_telegram_bot_stats`(
    IN p_date_from DATE,
    IN p_date_to DATE
)
BEGIN
    SELECT 
        COUNT(DISTINCT tu.id) as total_active_users,
        COUNT(DISTINCT CASE WHEN tu.role = 'admin' THEN tu.id END) as total_admins,
        COUNT(DISTINCT CASE WHEN tu.role = 'teknisi' THEN tu.id END) as total_teknisi,
        COUNT(DISTINCT tcl.id) as total_messages,
        COUNT(DISTINCT CASE WHEN tcl.message_type = 'command' THEN tcl.id END) as total_commands,
        COUNT(DISTINCT tn.id) as total_notifications_sent,
        ROUND(AVG(CASE WHEN tcl.is_success = 1 THEN 100 ELSE 0 END), 2) as success_rate
    FROM telegram_users tu
    LEFT JOIN telegram_chat_logs tcl ON tu.id = tcl.user_id 
        AND DATE(tcl.created_at) BETWEEN p_date_from AND p_date_to
    LEFT JOIN telegram_notifications tn ON tn.status = 'sent'
        AND DATE(tn.created_at) BETWEEN p_date_from AND p_date_to
    WHERE tu.is_active = 1;
END//
DELIMITER ;

-- Dumping structure for procedure billing.sp_telegram_send_to_role
DELIMITER //
CREATE PROCEDURE `sp_telegram_send_to_role`(
    IN p_notification_type VARCHAR(50),
    IN p_priority VARCHAR(20),
    IN p_title VARCHAR(255),
    IN p_message TEXT,
    IN p_target_role VARCHAR(20),
    IN p_target_area VARCHAR(100),
    OUT p_notification_id INT
)
BEGIN
    -- Insert notification
    INSERT INTO telegram_notifications (
        notification_type, priority, title, message, 
        target_role, target_area, status
    ) VALUES (
        p_notification_type, p_priority, p_title, p_message,
        p_target_role, p_target_area, 'pending'
    );
    
    SET p_notification_id = LAST_INSERT_ID();
    
    -- Create recipients
    IF p_target_role = 'all' THEN
        INSERT INTO telegram_notification_recipients (notification_id, user_id, telegram_chat_id)
        SELECT p_notification_id, id, telegram_chat_id
        FROM telegram_users
        WHERE is_active = 1 AND notification_enabled = 1;
    ELSEIF p_target_role = 'teknisi' AND p_target_area IS NOT NULL THEN
        INSERT INTO telegram_notification_recipients (notification_id, user_id, telegram_chat_id)
        SELECT p_notification_id, id, telegram_chat_id
        FROM telegram_users
        WHERE is_active = 1 
            AND notification_enabled = 1
            AND role = p_target_role
            AND JSON_CONTAINS(area_coverage, JSON_QUOTE(p_target_area));
    ELSE
        INSERT INTO telegram_notification_recipients (notification_id, user_id, telegram_chat_id)
        SELECT p_notification_id, id, telegram_chat_id
        FROM telegram_users
        WHERE is_active = 1 
            AND notification_enabled = 1
            AND role = p_target_role;
    END IF;
END//
DELIMITER ;

-- Dumping structure for table billing.static_ip_clients
CREATE TABLE IF NOT EXISTS `static_ip_clients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `package_id` int NOT NULL,
  `customer_id` int DEFAULT NULL,
  `customer_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `network` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `interface` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `olt_id` int DEFAULT NULL,
  `odc_id` int DEFAULT NULL,
  `odp_id` int DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_package_id` (`package_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_ip_address` (`ip_address`),
  CONSTRAINT `fk_static_ip_client_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_static_ip_client_package` FOREIGN KEY (`package_id`) REFERENCES `static_ip_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.static_ip_clients: ~0 rows (approximately)
DELETE FROM `static_ip_clients`;
INSERT INTO `static_ip_clients` (`id`, `package_id`, `customer_id`, `customer_code`, `client_name`, `ip_address`, `network`, `interface`, `address`, `phone_number`, `latitude`, `longitude`, `olt_id`, `odc_id`, `odp_id`, `status`, `created_at`, `updated_at`) VALUES
	(23, 19, 11, '20251021211857', 'LLALALAL', '192.168.1.9/30', '192.168.1.8', 'ether2', '1151knjn', '0812222', -6.1999470, 106.7879680, 1, 1, 1, 'active', '2025-10-21 14:18:57', '2025-10-21 14:18:57');

-- Dumping structure for table billing.static_ip_packages
CREATE TABLE IF NOT EXISTS `static_ip_packages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_upload_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_download_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_queue_id` int DEFAULT NULL,
  `max_limit_upload` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `limit_at_upload` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_limit_download` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `limit_at_download` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_clients` int DEFAULT '1',
  `child_upload_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_download_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_upload_limit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_download_limit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_limit_at_upload` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_limit_at_download` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_burst_upload` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_burst_download` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_queue_type_download` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_queue_type_upload` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_priority_download` int DEFAULT '8',
  `child_priority_upload` int DEFAULT '8',
  `child_burst_threshold_download` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_burst_threshold_upload` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_burst_time_download` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `child_burst_time_upload` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(12,2) DEFAULT '0.00',
  `sla_target` decimal(5,2) DEFAULT '90.00' COMMENT 'Target SLA dalam persen (90.00 = 90% uptime)',
  `duration_days` int DEFAULT '30',
  `auto_activation` tinyint(1) DEFAULT '0',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.static_ip_packages: ~1 rows (approximately)
DELETE FROM `static_ip_packages`;
INSERT INTO `static_ip_packages` (`id`, `name`, `parent_upload_name`, `parent_download_name`, `parent_queue_id`, `max_limit_upload`, `limit_at_upload`, `max_limit_download`, `limit_at_download`, `max_clients`, `child_upload_name`, `child_download_name`, `child_upload_limit`, `child_download_limit`, `child_limit_at_upload`, `child_limit_at_download`, `child_burst_upload`, `child_burst_download`, `child_queue_type_download`, `child_queue_type_upload`, `child_priority_download`, `child_priority_upload`, `child_burst_threshold_download`, `child_burst_threshold_upload`, `child_burst_time_download`, `child_burst_time_upload`, `price`, `sla_target`, `duration_days`, `auto_activation`, `status`, `description`, `created_at`, `updated_at`) VALUES
	(19, 'PAKET 5000', 'UPLOAD ALL', 'DOWNLOAD ALL', NULL, '10M', NULL, '10M', NULL, 10, 'UP-PAKET 5000', 'PAKET 5000', '10M', '10M', '1M', '1M', NULL, NULL, 'pcq-download-default', 'pcq-upload-default', 8, 8, NULL, NULL, NULL, NULL, 5000.00, 90.00, 30, 0, 'active', NULL, '2025-10-21 14:18:17', '2025-10-21 14:18:17');

-- Dumping structure for table billing.static_ip_ping_status
CREATE TABLE IF NOT EXISTS `static_ip_ping_status` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `ip_address` varchar(50) NOT NULL,
  `last_check` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('online','offline','degraded') DEFAULT 'offline',
  `response_time_ms` int DEFAULT NULL,
  `packet_loss_percent` decimal(5,2) DEFAULT '0.00',
  `consecutive_failures` int DEFAULT '0',
  `last_online_at` timestamp NULL DEFAULT NULL,
  `last_offline_at` timestamp NULL DEFAULT NULL,
  `uptime_percent_24h` decimal(5,2) DEFAULT '100.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_ip` (`ip_address`),
  CONSTRAINT `static_ip_ping_status_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.static_ip_ping_status: ~0 rows (approximately)
DELETE FROM `static_ip_ping_status`;
INSERT INTO `static_ip_ping_status` (`id`, `customer_id`, `ip_address`, `last_check`, `status`, `response_time_ms`, `packet_loss_percent`, `consecutive_failures`, `last_online_at`, `last_offline_at`, `uptime_percent_24h`) VALUES
	(1, 11, '192.168.1.9/30', '2025-10-24 14:07:02', 'offline', NULL, 0.00, 0, NULL, NULL, 0.00);

-- Dumping structure for table billing.subscriptions
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `package_id` int DEFAULT NULL,
  `package_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `billing_cycle` enum('monthly','quarterly','yearly') COLLATE utf8mb4_unicode_ci DEFAULT 'monthly',
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('active','inactive','suspended','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_billing_cycle` (`billing_cycle`),
  CONSTRAINT `fk_subscription_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.subscriptions: ~6 rows (approximately)
DELETE FROM `subscriptions`;
INSERT INTO `subscriptions` (`id`, `customer_id`, `package_id`, `package_name`, `price`, `billing_cycle`, `start_date`, `end_date`, `status`, `created_at`, `updated_at`) VALUES
	(1, 1, NULL, 'Paket Internet 50 Mbps', 150000.00, 'monthly', '2025-01-01', NULL, 'active', '2025-10-17 21:56:04', '2025-10-17 21:56:04'),
	(2, 1, NULL, 'Paket Internet 50 Mbps', 150000.00, 'monthly', '2025-01-01', NULL, 'active', '2025-10-17 22:09:49', '2025-10-17 22:09:49'),
	(8, 7, NULL, 'Paket Internet 50Mbps', 150000.00, 'monthly', '2025-10-21', NULL, 'active', '2025-10-21 14:28:57', '2025-10-21 14:28:57'),
	(9, 8, NULL, 'Paket Internet 50Mbps', 150000.00, 'monthly', '2025-10-21', NULL, 'active', '2025-10-21 14:28:57', '2025-10-21 14:28:57'),
	(10, 10, NULL, 'Paket IP Static 100Mbps', 200000.00, 'monthly', '2025-10-21', NULL, 'active', '2025-10-21 14:28:57', '2025-10-21 14:28:57'),
	(11, 11, NULL, 'Paket IP Static 100Mbps', 200000.00, 'monthly', '2025-10-21', NULL, 'cancelled', '2025-10-21 14:28:58', '2025-10-24 13:36:01');

-- Dumping structure for table billing.system_alerts
CREATE TABLE IF NOT EXISTS `system_alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `alert_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('info','warning','error','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'info',
  `is_resolved` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_by` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_alert_type` (`alert_type`),
  KEY `idx_severity` (`severity`),
  KEY `idx_is_resolved` (`is_resolved`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.system_alerts: ~3 rows (approximately)
DELETE FROM `system_alerts`;
INSERT INTO `system_alerts` (`id`, `alert_type`, `message`, `severity`, `is_resolved`, `created_at`, `resolved_at`, `created_by`) VALUES
	(1, 'system_startup', 'ONT Management System started successfully', 'info', 0, '2025-10-17 17:17:05', NULL, 'system'),
	(2, 'database_connected', 'Database connection established', 'info', 0, '2025-10-17 17:17:05', NULL, 'system'),
	(3, 'websocket_ready', 'WebSocket service is ready for connections', 'info', 0, '2025-10-17 17:17:05', NULL, 'system');

-- Dumping structure for table billing.system_settings
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.system_settings: ~7 rows (approximately)
DELETE FROM `system_settings`;
INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `description`, `created_at`, `updated_at`) VALUES
	(1, 'auto_isolate_enabled', 'true', 'Enable automatic isolation of overdue customers', '2025-10-18 01:58:18', '2025-10-18 01:58:18'),
	(2, 'auto_restore_enabled', 'true', 'Enable automatic restoration of paid customers', '2025-10-18 01:58:18', '2025-10-18 01:58:18'),
	(3, 'auto_notifications_enabled', 'true', 'Enable automatic notifications to customers', '2025-10-18 01:58:18', '2025-10-18 01:58:18'),
	(4, 'prepaid_portal_url', 'http://localhost:3001/prepaid/portal', 'URL portal prepaid', '2025-10-24 10:47:24', '2025-10-24 10:47:24'),
	(5, 'prepaid_enabled', 'true', 'Enable/disable prepaid system', '2025-10-24 10:47:24', '2025-10-24 10:47:24'),
	(6, 'grace_period_days', '0', 'Grace period days after expiry', '2025-10-24 10:47:24', '2025-10-24 10:47:24'),
	(7, 'portal_redirect_enabled', 'true', 'Enable portal redirect for unpaid customers', '2025-10-24 10:47:24', '2025-10-24 10:47:24');

-- Dumping structure for table billing.telegram_bot_commands
CREATE TABLE IF NOT EXISTS `telegram_bot_commands` (
  `id` int NOT NULL AUTO_INCREMENT,
  `command_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `allowed_roles` json DEFAULT NULL COMMENT 'Array of roles allowed to use this command',
  `usage_example` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_command` (`command_name`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.telegram_bot_commands: ~15 rows (approximately)
DELETE FROM `telegram_bot_commands`;
INSERT INTO `telegram_bot_commands` (`id`, `command_name`, `description`, `allowed_roles`, `usage_example`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, '/start', 'Memulai bot dan melihat informasi awal', '["admin", "teknisi", "kasir", "superadmin"]', '/start', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(2, '/register', 'Registrasi menggunakan kode undangan', '["admin", "teknisi", "kasir", "superadmin"]', '/register ADMIN-ABC123', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(3, '/help', 'Menampilkan daftar perintah yang tersedia', '["admin", "teknisi", "kasir", "superadmin"]', '/help', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(4, '/status', 'Melihat status akun dan tugas aktif', '["admin", "teknisi", "kasir", "superadmin"]', '/status', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(5, '/incidents', 'Melihat daftar incident aktif', '["admin", "teknisi"]', '/incidents', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(6, '/mytickets', 'Melihat tiket yang di-assign ke saya', '["teknisi"]', '/mytickets', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(7, '/customers', 'Cari informasi customer', '["admin", "teknisi"]', '/customers <nama/id>', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(8, '/offline', 'Melihat customer yang sedang offline', '["admin", "teknisi"]', '/offline <area>', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(9, '/stats', 'Melihat statistik hari ini', '["admin"]', '/stats', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(10, '/invoice', 'Cek tagihan customer', '["admin", "kasir"]', '/invoice <customer_id>', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(11, '/payment', 'Cek riwayat pembayaran', '["admin", "kasir"]', '/payment <customer_id>', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(12, '/notify', 'Kirim notifikasi custom', '["admin", "superadmin"]', '/notify <area> <message>', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(13, '/areas', 'Melihat daftar area coverage', '["admin", "teknisi"]', '/areas', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(14, '/performance', 'Melihat performa teknisi', '["admin", "superadmin"]', '/performance <period>', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(15, '/settings', 'Pengaturan notifikasi', '["admin", "teknisi", "kasir"]', '/settings', 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14');

-- Dumping structure for table billing.telegram_bot_statistics
CREATE TABLE IF NOT EXISTS `telegram_bot_statistics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `total_messages` int DEFAULT '0',
  `total_commands` int DEFAULT '0',
  `total_notifications` int DEFAULT '0',
  `active_users` int DEFAULT '0',
  `successful_sends` int DEFAULT '0',
  `failed_sends` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date` (`date`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.telegram_bot_statistics: ~1 rows (approximately)
DELETE FROM `telegram_bot_statistics`;
INSERT INTO `telegram_bot_statistics` (`id`, `date`, `total_messages`, `total_commands`, `total_notifications`, `active_users`, `successful_sends`, `failed_sends`, `created_at`, `updated_at`) VALUES
	(1, '2025-10-25', 15, 0, 0, 0, 15, 0, '2025-10-25 07:09:26', '2025-10-25 16:16:23');

-- Dumping structure for table billing.telegram_chat_logs
CREATE TABLE IF NOT EXISTS `telegram_chat_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `telegram_chat_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message_type` enum('command','text','callback','system') COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_content` text COLLATE utf8mb4_unicode_ci,
  `command_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bot_response` text COLLATE utf8mb4_unicode_ci,
  `is_success` tinyint(1) DEFAULT '1',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_chat_id` (`telegram_chat_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_message_type_created` (`message_type`,`created_at`),
  CONSTRAINT `telegram_chat_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `telegram_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.telegram_chat_logs: ~15 rows (approximately)
DELETE FROM `telegram_chat_logs`;
INSERT INTO `telegram_chat_logs` (`id`, `user_id`, `telegram_chat_id`, `message_type`, `message_content`, `command_name`, `bot_response`, `is_success`, `error_message`, `metadata`, `created_at`) VALUES
	(1, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:09:26'),
	(2, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:09:30'),
	(3, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:12:51'),
	(4, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:13:05'),
	(5, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:13:14'),
	(6, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:13:29'),
	(7, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:16:19'),
	(8, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:17:09'),
	(9, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:17:27'),
	(10, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:17:49'),
	(11, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:27:18'),
	(12, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:38:21'),
	(13, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:39:47'),
	(14, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 07:45:23'),
	(15, NULL, 'system', 'system', 'Bot started successfully', NULL, NULL, 1, NULL, NULL, '2025-10-25 16:16:23');

-- Dumping structure for table billing.telegram_incident_assignments
CREATE TABLE IF NOT EXISTS `telegram_incident_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `incident_id` int NOT NULL,
  `technician_user_id` int NOT NULL,
  `assigned_by` int DEFAULT NULL COMMENT 'User ID who assigned (null if self-assigned)',
  `assignment_type` enum('auto','manual','self') COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `status` enum('assigned','acknowledged','working','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'assigned',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `assigned_at` datetime NOT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_incident_id` (`incident_id`),
  KEY `idx_technician` (`technician_user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_status_assigned` (`status`,`assigned_at`),
  CONSTRAINT `telegram_incident_assignments_ibfk_1` FOREIGN KEY (`technician_user_id`) REFERENCES `telegram_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.telegram_incident_assignments: ~0 rows (approximately)
DELETE FROM `telegram_incident_assignments`;

-- Dumping structure for table billing.telegram_notifications
CREATE TABLE IF NOT EXISTS `telegram_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `notification_type` enum('downtime','sla_breach','payment','invoice','system','custom') COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_role` enum('admin','teknisi','kasir','all') COLLATE utf8mb4_unicode_ci DEFAULT 'all',
  `target_area` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Specific area for teknisi',
  `customer_id` int DEFAULT NULL,
  `related_entity_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'invoice, payment, incident, etc',
  `related_entity_id` int DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `sent_count` int DEFAULT '0',
  `failed_count` int DEFAULT '0',
  `status` enum('pending','sent','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `sent_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `customer_id` (`customer_id`),
  KEY `idx_notification_type` (`notification_type`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_target_role_area` (`target_role`,`target_area`),
  CONSTRAINT `telegram_notifications_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.telegram_notifications: ~0 rows (approximately)
DELETE FROM `telegram_notifications`;

-- Dumping structure for table billing.telegram_notification_recipients
CREATE TABLE IF NOT EXISTS `telegram_notification_recipients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `notification_id` int NOT NULL,
  `user_id` int NOT NULL,
  `telegram_chat_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','sent','delivered','read','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `sent_at` datetime DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_id` (`notification_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `telegram_notification_recipients_ibfk_1` FOREIGN KEY (`notification_id`) REFERENCES `telegram_notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `telegram_notification_recipients_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `telegram_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.telegram_notification_recipients: ~0 rows (approximately)
DELETE FROM `telegram_notification_recipients`;

-- Dumping structure for table billing.telegram_quick_replies
CREATE TABLE IF NOT EXISTS `telegram_quick_replies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `keyword` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reply_type` enum('text','command','template') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `reply_content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `allowed_roles` json DEFAULT NULL COMMENT 'Array of roles',
  `usage_count` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_keyword` (`keyword`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.telegram_quick_replies: ~5 rows (approximately)
DELETE FROM `telegram_quick_replies`;
INSERT INTO `telegram_quick_replies` (`id`, `keyword`, `reply_type`, `reply_content`, `allowed_roles`, `usage_count`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, 'siap', 'text', '??? Siap! Sedang dalam perjalanan ke lokasi.', '["teknisi"]', 0, 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(2, 'selesai', 'text', '??? Pekerjaan sudah selesai. Internet sudah normal kembali.', '["teknisi"]', 0, 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(3, 'tunda', 'text', '??? Mohon ditunda, sedang handle incident lain yang lebih urgent.', '["teknisi"]', 0, 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(4, 'bantuan', 'text', '???? Butuh bantuan tambahan, masalah lebih kompleks dari perkiraan.', '["teknisi"]', 0, 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(5, 'konfirmasi', 'text', '??? Baik, sudah dikonfirmasi dan sedang diproses.', '["admin", "kasir"]', 0, 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14');

-- Dumping structure for table billing.telegram_settings
CREATE TABLE IF NOT EXISTS `telegram_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bot_token` varchar(500) NOT NULL COMMENT 'Token bot dari BotFather',
  `auto_start` tinyint(1) DEFAULT '1' COMMENT 'Auto start bot saat server dimulai',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Pengaturan Telegram Bot';

-- Dumping data for table billing.telegram_settings: ~1 rows (approximately)
DELETE FROM `telegram_settings`;
INSERT INTO `telegram_settings` (`id`, `bot_token`, `auto_start`, `created_at`, `updated_at`) VALUES
	(1, '8494519772:AAEAq589cacq1dwx91UPVxNw0nTTrKCS1XU', 1, '2025-10-25 07:09:25', '2025-10-25 07:39:46');

-- Dumping structure for table billing.telegram_users
CREATE TABLE IF NOT EXISTS `telegram_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `telegram_chat_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telegram_username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','teknisi','kasir','superadmin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `area_coverage` json DEFAULT NULL COMMENT 'Array of areas covered by teknisi',
  `is_active` tinyint(1) DEFAULT '0',
  `invite_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invite_expires_at` datetime DEFAULT NULL,
  `registered_at` datetime DEFAULT NULL,
  `last_active_at` datetime DEFAULT NULL,
  `notification_enabled` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `telegram_chat_id` (`telegram_chat_id`),
  UNIQUE KEY `invite_code` (`invite_code`),
  KEY `idx_chat_id` (`telegram_chat_id`),
  KEY `idx_role` (`role`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.telegram_users: ~2 rows (approximately)
DELETE FROM `telegram_users`;
INSERT INTO `telegram_users` (`id`, `telegram_chat_id`, `telegram_username`, `first_name`, `last_name`, `phone_number`, `role`, `area_coverage`, `is_active`, `invite_code`, `invite_expires_at`, `registered_at`, `last_active_at`, `notification_enabled`, `created_at`, `updated_at`) VALUES
	(1, NULL, NULL, NULL, NULL, NULL, 'admin', '[]', 0, 'ADMIN-INIT2025', '2025-11-23 05:16:14', NULL, NULL, 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14'),
	(2, NULL, NULL, NULL, NULL, NULL, 'teknisi', '["Area A", "Area B"]', 0, 'TEKNISI-INIT2025', '2025-11-23 05:16:14', NULL, NULL, 1, '2025-10-24 12:16:14', '2025-10-24 12:16:14');

-- Dumping structure for table billing.translation_cache
CREATE TABLE IF NOT EXISTS `translation_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `translated_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_lang` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'id',
  `target_lang` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'en',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.translation_cache: ~0 rows (approximately)
DELETE FROM `translation_cache`;

-- Dumping structure for table billing.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('superadmin','operator','teknisi','kasir') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'operator',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.users: ~2 rows (approximately)
DELETE FROM `users`;
INSERT INTO `users` (`id`, `username`, `email`, `password`, `full_name`, `role`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, 'admin', 'admin@billing.local', '$2b$10$DbdEC97wsGepTY89H6XgKecSfBWEeIgbGzhsdovX1kzXuvtC.Lnsi', 'Administrator', 'superadmin', 1, '2025-10-17 18:51:39', '2025-10-24 13:50:22'),
	(3, 'kasir', 'kasir@billing.com', '$2b$10$vbcCWIS1QddLt3D40QwbpOwWiuVlrr4bnSZr5PvylGTcMQraEQOAe', 'Kasir', 'kasir', 1, '2025-10-22 00:00:35', '2025-10-24 17:25:30');

-- Dumping structure for view billing.v_active_incidents
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `v_active_incidents` (
	`incident_id` BIGINT NOT NULL,
	`customer_id` INT NOT NULL,
	`customer_name` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`area` VARCHAR(1) NULL COMMENT 'Geographic area' COLLATE 'utf8mb4_unicode_ci',
	`odc_location` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`service_type` ENUM('pppoe','static_ip') NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`start_time` TIMESTAMP NOT NULL,
	`duration_minutes` INT NULL,
	`incident_type` ENUM('downtime','degraded','maintenance') NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`status` ENUM('ongoing','resolved','excluded') NULL COLLATE 'utf8mb4_unicode_ci',
	`technician_name` VARBINARY(0) NULL,
	`technician_chat_id` VARBINARY(0) NULL,
	`alert_sent_telegram` TINYINT(1) NULL,
	`alert_sent_whatsapp` TINYINT(1) NULL
) ENGINE=MyISAM;

-- Dumping structure for view billing.v_active_prepaid_customers
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `v_active_prepaid_customers` (
	`id` INT NOT NULL,
	`customer_code` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`name` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`phone` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`billing_mode` ENUM('postpaid','prepaid','hybrid') NULL COLLATE 'utf8mb4_unicode_ci',
	`status` ENUM('active','inactive','suspended') NULL COLLATE 'utf8mb4_unicode_ci',
	`subscription_id` INT NOT NULL,
	`package_name` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`activation_date` DATETIME NOT NULL,
	`expiry_date` DATETIME NOT NULL,
	`days_remaining` INT NULL,
	`purchase_price` DECIMAL(12,2) NOT NULL,
	`download_mbps` INT NULL,
	`upload_mbps` INT NULL
) ENGINE=MyISAM;

-- Dumping structure for view billing.v_current_connection_status
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `v_current_connection_status` (
	`customer_id` INT NULL,
	`customer_name` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`area` VARCHAR(1) NULL COMMENT 'Geographic area' COLLATE 'utf8mb4_unicode_ci',
	`connection_type` ENUM('pppoe','static_ip','hybrid') NULL COLLATE 'utf8mb4_unicode_ci',
	`username` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`current_status` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`ping_ms` INT NULL,
	`active_incidents` BIGINT NULL
) ENGINE=MyISAM;

-- Dumping structure for view billing.v_expiring_soon_customers
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `v_expiring_soon_customers` (
	`id` INT NOT NULL,
	`customer_code` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`name` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`phone` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`expiry_date` DATETIME NOT NULL,
	`days_remaining` INT NULL,
	`package_name` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`purchase_price` DECIMAL(12,2) NOT NULL
) ENGINE=MyISAM;

-- Dumping structure for view billing.v_monthly_sla_summary
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `v_monthly_sla_summary` (
	`month_year` DATE NOT NULL,
	`total_customers` BIGINT NOT NULL,
	`customers_met_sla` DECIMAL(23,0) NULL,
	`customers_breach_sla` DECIMAL(23,0) NULL,
	`avg_sla_percentage` DECIMAL(6,2) NULL,
	`total_incidents` DECIMAL(32,0) NULL,
	`total_downtime_minutes` DECIMAL(32,0) NULL,
	`total_discount_amount` DECIMAL(37,2) NULL
) ENGINE=MyISAM;

-- Dumping structure for view billing.v_telegram_daily_stats
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `v_telegram_daily_stats` (
	`date` DATE NULL,
	`total_messages` BIGINT NOT NULL,
	`total_commands` BIGINT NOT NULL,
	`successful_messages` BIGINT NOT NULL,
	`failed_messages` BIGINT NOT NULL,
	`active_users` BIGINT NOT NULL
) ENGINE=MyISAM;

-- Dumping structure for view billing.v_telegram_technician_performance
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `v_telegram_technician_performance` (
	`id` INT NOT NULL,
	`telegram_username` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`first_name` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`areas` LONGTEXT NULL COLLATE 'utf8mb4_bin',
	`total_assignments` BIGINT NOT NULL,
	`completed_assignments` BIGINT NOT NULL,
	`ongoing_assignments` BIGINT NOT NULL,
	`avg_completion_minutes` DECIMAL(24,4) NULL
) ENGINE=MyISAM;

-- Dumping structure for view billing.v_telegram_users_active
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `v_telegram_users_active` (
	`id` INT NOT NULL,
	`telegram_chat_id` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`telegram_username` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`first_name` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`role` ENUM('admin','teknisi','kasir','superadmin') NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`area_coverage` JSON NULL COMMENT 'Array of areas covered by teknisi',
	`registered_at` DATETIME NULL,
	`last_active_at` DATETIME NULL,
	`total_messages` BIGINT NOT NULL,
	`total_commands` BIGINT NOT NULL
) ENGINE=MyISAM;

-- Dumping structure for table billing.whatsapp_bot_conversations
CREATE TABLE IF NOT EXISTS `whatsapp_bot_conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `incoming_message` text COLLATE utf8mb4_unicode_ci,
  `outgoing_message` text COLLATE utf8mb4_unicode_ci,
  `message_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `intent` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `response_time_ms` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone_number` (`phone_number`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `whatsapp_bot_conversations_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.whatsapp_bot_conversations: ~40 rows (approximately)
DELETE FROM `whatsapp_bot_conversations`;
INSERT INTO `whatsapp_bot_conversations` (`id`, `phone_number`, `incoming_message`, `outgoing_message`, `message_id`, `customer_id`, `intent`, `response_time_ms`, `created_at`) VALUES
	(1, '6289678630707', 'tes', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_6289678630707@c.us_ACC1B5F3FE910960C9186CC0D81ACA4A', NULL, NULL, NULL, '2025-10-24 00:51:25'),
	(2, '6289678630707', 'tes', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_6289678630707@c.us_AC011C6DF3477DD72BDC774F37C612EF', NULL, NULL, NULL, '2025-10-24 00:55:29'),
	(3, '6289678630707', 'help', '📱 *MENU BANTUAN*\n\nBerikut yang bisa saya bantu:\n\n1️⃣ *Cek Tagihan*\n   Ketik: tagihan, invoice, cek tagihan\n\n2️⃣ *Cek Pembayaran*\n   Ketik: pembayaran, bayar, lunas\n\n3️⃣ *Status Layanan*\n   Ketik: status, layanan\n\n4️⃣ *Konfirmasi Pembayaran*\n   Ketik: sudah bayar, konfirmasi\n\n5️⃣ *Keluhan/Gangguan*\n   Ketik: komplain, gangguan\n\nSilakan ketik sesuai kebutuhan Anda! 😊', 'false_6289678630707@c.us_AC0B2356B6E86514C63CD37D2F1E4B39', NULL, NULL, NULL, '2025-10-24 00:55:53'),
	(4, '6289678630707', 'keluhan', 'Untuk komplain, silakan hubungi customer service kami.', 'false_6289678630707@c.us_AC395FAF88B049C5836EA2D31C9114C2', NULL, NULL, NULL, '2025-10-24 00:56:07'),
	(5, '6289678630707', 'cwk tagihan', 'Nomor Anda belum terdaftar. Silakan hubungi customer service.', 'false_6289678630707@c.us_AC3477FB29FFB04A52EC4068A4A2BD93', NULL, NULL, NULL, '2025-10-24 00:56:17'),
	(6, '6289678630707', 'cek tagihan', 'Nomor Anda belum terdaftar. Silakan hubungi customer service.', 'false_6289678630707@c.us_ACB06665833BFCF82BE72CB3669D71FD', NULL, NULL, NULL, '2025-10-24 00:56:25'),
	(7, '6289678630707', 'konfirmasi pembayaran', 'Nomor Anda belum terdaftar. Silakan hubungi customer service.', 'false_6289678630707@c.us_AC21A5C4072A76FC00AC8F0285C948E0', NULL, NULL, NULL, '2025-10-24 00:56:46'),
	(8, 'status@broadcast', 'Sok minggu nek udian ngene poyo panggah bdl karnavale😃', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC52B79107DAA60669D319DFCA3A57F6_6281977398996@c.us', NULL, NULL, NULL, '2025-10-24 02:37:12'),
	(9, 'status@broadcast', '', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACFE742BF5050DEBD024D49AD08D4DDF_6283111722768@c.us', NULL, NULL, NULL, '2025-10-24 03:41:21'),
	(10, 'status@broadcast', 'Disponsori oleh HJS ...🤣', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACEEC5843877EBEE92D6BADB93BB3D9D_6285749253881@c.us', NULL, NULL, NULL, '2025-10-24 03:44:23'),
	(11, '628111515151', '', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_628111515151@c.us_3EB086E070620E575051', NULL, NULL, NULL, '2025-10-24 09:55:42'),
	(12, '62812222', '', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_62812222@c.us_3EB011BA57BB8045D4AD', NULL, NULL, NULL, '2025-10-24 09:56:15'),
	(13, 'status@broadcast', 'Ws beres ...otw 🚶‍♀️🚶‍♀️🚶‍♀️', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC150B5E0D3CFB94881C4C9CB8C1AD76_6281977398996@c.us', NULL, NULL, NULL, '2025-10-24 17:15:18'),
	(14, 'status@broadcast', 'Di PP sek Teng e Mergo mambengi kudanan ...', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACC29F6BF25DFC6FACE1ACA0C09AE471_6285749253881@c.us', NULL, NULL, NULL, '2025-10-24 17:53:31'),
	(15, 'status@broadcast', 'Bismilah nikmati saja prosesnya👌🏻pelan tapi pasti👍🫶🥰', '📡 *STATUS LAYANAN*\n\nPelanggan: *mama*\nStatus: 🟢 *AKTIF*\nTipe: PPPOE\n\n✅ Layanan Anda aktif dan berjalan normal.', 'false_status@broadcast_AC580E97CF572AA400093A584A9D421B_6281977398996@c.us', NULL, NULL, NULL, '2025-10-24 19:22:37'),
	(16, 'status@broadcast', 'Joging hr ini kita ttup dngan srpn nsi pecel pak bayan👍😂', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC01489D6454DD95D8276349A70F6815_6281977398996@c.us', NULL, NULL, NULL, '2025-10-24 19:27:45'),
	(17, 'status@broadcast', 'Kekilafan kita hr ini😂 gak pa" sesekali hbs joging mkn...kan kita olga buat sehat bkn untuk tdk mkn🤭🤭🤭', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC95A5233B93A4C2A011E001E03083BC_6281977398996@c.us', NULL, NULL, NULL, '2025-10-24 19:40:00'),
	(18, 'status@broadcast', 'joging Hr ini bnyak bertemu tmn" pejuang sehat🫶🥰', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACCDED964C742BB211E7556AC74F4E92_6281977398996@c.us', NULL, NULL, NULL, '2025-10-24 19:50:19'),
	(19, 'status@broadcast', 'Jan kelakuane bocil epep😂😂astafirullahaladzim🤭🤭', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC736730EF2882F42FB02ABE5DBD994E_6281977398996@c.us', NULL, NULL, NULL, '2025-10-24 22:59:15'),
	(20, '6289678630707', '7261535051:AAE5boQ-kAgfn93ewKKl2v1KqmoOvC0ep4w', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_6289678630707@c.us_AC5CED0D7B2F23F024369AF14F7B60A6', NULL, NULL, NULL, '2025-10-25 00:37:42'),
	(21, '6289678630707', '8494519772:AAEAq589cacq1dwx91UPVxNw0nTTrKCS1XU', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_6289678630707@c.us_AC969EA1C5392B19A6F0CCF7A07AE80C', NULL, NULL, NULL, '2025-10-25 00:39:17'),
	(22, 'status@broadcast', 'Mbendino oleh gratisan es teh ...😁', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC142BA0B9B2791229B11417B090EF7B_6285749253881@c.us', NULL, NULL, NULL, '2025-10-25 01:11:22'),
	(23, 'status@broadcast', 'Mbengblimbing..', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC412C086DEAC76F938626FD5A6ECF65_6285749253881@c.us', NULL, NULL, NULL, '2025-10-25 02:10:04'),
	(24, 'status@broadcast', '🤩', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC1EAF9624228F97FB6A5FC3D3F20513_6281554404964@c.us', NULL, NULL, NULL, '2025-10-25 03:27:26'),
	(25, 'status@broadcast', 'Nasi goreng ala²', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACDBF477584C672712CFEDC50B27A354_6281554404964@c.us', NULL, NULL, NULL, '2025-10-25 04:01:58'),
	(26, 'status@broadcast', 'Masyaalloh😍', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC988B2A85D31528886176C1CC54B99E_6281554404964@c.us', NULL, NULL, NULL, '2025-10-25 04:07:49'),
	(27, 'status@broadcast', '', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC93FD16C7291BC0906B7945572CD67B_6281554404964@c.us', NULL, NULL, NULL, '2025-10-25 04:40:58'),
	(28, 'status@broadcast', '', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC3001FFDDA209FC5F179971685C4E00_6285749253881@c.us', NULL, NULL, NULL, '2025-10-25 04:44:57'),
	(29, 'status@broadcast', 'Dodol disambi ndilok cek sound Iki 😁', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC4DCBB59E31B98979E6FA388F387749_6285749253881@c.us', NULL, NULL, NULL, '2025-10-25 04:47:24'),
	(30, 'status@broadcast', 'Personil ndak lengkap ..', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC08D3E5D4F2B3472D7F392CDD0A6EC0_6285749253881@c.us', NULL, NULL, NULL, '2025-10-25 04:51:43'),
	(31, 'status@broadcast', '', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACADE22FD6DC3D1DC8FB2659F82ED93B_6281554404964@c.us', NULL, NULL, NULL, '2025-10-25 04:57:03'),
	(32, 'status@broadcast', 'Part 2', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC53314432ABECB4BD6E609B7B15E633_6281554404964@c.us', NULL, NULL, NULL, '2025-10-25 05:34:26'),
	(33, 'status@broadcast', 'Opo iyo cm aku tok sing ora eroh rejone sond horeg🤦🤦', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC55402535EBBABF359F82A7A3DDE417_6281977398996@c.us', NULL, NULL, NULL, '2025-10-25 05:40:48'),
	(34, 'status@broadcast', 'Disusul anak wedok ...', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACDAB1CB0C8FA6812C81EFEDAB1B8CF4_6285749253881@c.us', NULL, NULL, NULL, '2025-10-25 05:43:35'),
	(35, 'status@broadcast', 'Mendelok lampu dan mengrungokan cek sond ko omah wae🥱', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACB05B1C54BA82D9E3DBCC4E616A27EB_6281977398996@c.us', NULL, NULL, NULL, '2025-10-25 06:19:45'),
	(36, 'status@broadcast', 'Cihuuyyyy 😍', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACAD8CCAF7D2A7469158F56C4829A32F_6283111722768@c.us', NULL, NULL, NULL, '2025-10-25 06:42:11'),
	(37, 'status@broadcast', '', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC7BCE89677EE99C079E9624E0CDFC9F_6283898509621@c.us', NULL, NULL, NULL, '2025-10-25 06:42:17'),
	(38, 'status@broadcast', 'Sing pingin mie ayam sopo sing ngentekne sopo🤔🤔 pe mbape😂😂😂', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC63FB253AE9A79CEAEFCC03B562DF2C_6281977398996@c.us', NULL, NULL, NULL, '2025-10-25 06:49:27'),
	(39, 'status@broadcast', '', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_ACE9AC23EE47F336F7DF5B1D07308FB3_6283898509621@c.us', NULL, NULL, NULL, '2025-10-25 08:01:54'),
	(40, 'status@broadcast', 'Dahneo sesok 🤔', 'Maaf, saya belum memahami pesan Anda. 🤔\n\nKetik *menu* untuk melihat daftar bantuan yang tersedia.\n\nAtau hubungi customer service kami untuk bantuan lebih lanjut.', 'false_status@broadcast_AC1BEFBEF095BF2102203E20B1E7366F_6283111722768@c.us', NULL, NULL, NULL, '2025-10-25 08:39:07');

-- Dumping structure for table billing.whatsapp_bot_messages
CREATE TABLE IF NOT EXISTS `whatsapp_bot_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` int DEFAULT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_type` enum('text','image','document','audio','video') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `message_content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` enum('inbound','outbound') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','sent','delivered','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone_number` (`phone_number`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.whatsapp_bot_messages: ~0 rows (approximately)
DELETE FROM `whatsapp_bot_messages`;

-- Dumping structure for table billing.whatsapp_bot_sessions
CREATE TABLE IF NOT EXISTS `whatsapp_bot_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `qr_code` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.whatsapp_bot_sessions: ~0 rows (approximately)
DELETE FROM `whatsapp_bot_sessions`;

-- Dumping structure for table billing.whatsapp_bot_settings
CREATE TABLE IF NOT EXISTS `whatsapp_bot_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bot_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'ISP Billing Bot',
  `phone_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  `session_status` enum('disconnected','connecting','connected') COLLATE utf8mb4_unicode_ci DEFAULT 'disconnected',
  `qr_code` text COLLATE utf8mb4_unicode_ci,
  `auto_reply` tinyint(1) DEFAULT '1',
  `send_invoice_notification` tinyint(1) DEFAULT '1',
  `send_payment_reminder` tinyint(1) DEFAULT '1',
  `send_isolation_warning` tinyint(1) DEFAULT '1',
  `send_payment_confirmation` tinyint(1) DEFAULT '1',
  `webhook_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `api_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `config` json DEFAULT NULL,
  `last_connected_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.whatsapp_bot_settings: ~0 rows (approximately)
DELETE FROM `whatsapp_bot_settings`;
INSERT INTO `whatsapp_bot_settings` (`id`, `bot_name`, `phone_number`, `is_active`, `session_status`, `qr_code`, `auto_reply`, `send_invoice_notification`, `send_payment_reminder`, `send_isolation_warning`, `send_payment_confirmation`, `webhook_url`, `api_key`, `config`, `last_connected_at`, `created_at`, `updated_at`) VALUES
	(1, 'ISP Billing Bot', NULL, 0, 'disconnected', NULL, 1, 1, 1, 1, 1, NULL, NULL, NULL, NULL, '2025-10-23 03:01:23', '2025-10-23 03:01:23');

-- Dumping structure for table billing.whatsapp_bot_statistics
CREATE TABLE IF NOT EXISTS `whatsapp_bot_statistics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `total_messages_received` int DEFAULT '0',
  `total_messages_sent` int DEFAULT '0',
  `total_conversations` int DEFAULT '0',
  `avg_response_time_ms` int DEFAULT '0',
  `unique_users` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `date` (`date`),
  KEY `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.whatsapp_bot_statistics: ~0 rows (approximately)
DELETE FROM `whatsapp_bot_statistics`;

-- Dumping structure for table billing.whatsapp_connection_logs
CREATE TABLE IF NOT EXISTS `whatsapp_connection_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_action` (`action`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=541 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.whatsapp_connection_logs: ~540 rows (approximately)
DELETE FROM `whatsapp_connection_logs`;
INSERT INTO `whatsapp_connection_logs` (`id`, `session_id`, `action`, `status`, `message`, `created_at`) VALUES
	(1, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:23'),
	(2, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:23'),
	(3, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:23'),
	(4, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:23'),
	(5, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:23'),
	(6, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:23'),
	(7, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:23'),
	(8, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:34'),
	(9, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:34'),
	(10, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:34'),
	(11, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:34'),
	(12, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:34'),
	(13, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:34'),
	(14, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 20:43:34'),
	(15, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:22:31'),
	(16, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:24:33'),
	(17, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:26:16'),
	(18, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:30:41'),
	(19, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:30:57'),
	(20, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:31:57'),
	(21, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:41:33'),
	(22, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:41:42'),
	(23, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:49:43'),
	(24, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 21:54:19'),
	(25, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 22:03:19'),
	(26, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 22:03:43'),
	(27, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 22:26:52'),
	(28, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 22:44:42'),
	(29, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 22:46:10'),
	(30, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 22:50:33'),
	(31, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 22:50:33'),
	(32, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-22 22:50:33'),
	(33, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-23 23:11:37'),
	(34, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-23 23:34:11'),
	(35, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-23 23:40:58'),
	(36, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-23 23:45:12'),
	(37, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-23 23:45:40'),
	(38, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-23 23:46:46'),
	(39, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-23 23:58:44'),
	(40, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized in demo mode', '2025-10-24 00:05:29'),
	(41, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:15:00'),
	(42, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:15:00'),
	(43, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:15:59'),
	(44, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:16:19'),
	(45, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:16:39'),
	(46, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:16:59'),
	(47, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:17:19'),
	(48, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:18:28'),
	(49, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:18:28'),
	(50, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:19:26'),
	(51, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:19:46'),
	(52, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:20:41'),
	(53, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:20:41'),
	(54, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:22:02'),
	(55, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:22:02'),
	(56, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:23:15'),
	(57, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:23:15'),
	(58, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:24:01'),
	(59, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:24:01'),
	(60, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:25:01'),
	(61, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:26:10'),
	(62, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:26:10'),
	(63, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:27:24'),
	(64, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:27:24'),
	(65, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:28:23'),
	(66, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:28:43'),
	(67, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:29:03'),
	(68, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:29:23'),
	(69, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:29:43'),
	(70, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:30:54'),
	(71, 'system', 'disconnect', 'success', 'Client disconnected and destroyed', '2025-10-24 00:31:25'),
	(72, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:31:46'),
	(73, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:31:47'),
	(74, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 00:32:41'),
	(75, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 00:32:46'),
	(76, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:45:06'),
	(77, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 00:45:11'),
	(78, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 00:45:17'),
	(79, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:46:53'),
	(80, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 00:46:56'),
	(81, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 00:47:00'),
	(82, 'system', 'disconnect', 'success', 'Client disconnected and destroyed', '2025-10-24 00:47:16'),
	(83, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:48:11'),
	(84, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:48:11'),
	(85, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:49:10'),
	(86, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:49:30'),
	(87, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:49:51'),
	(88, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:50:10'),
	(89, 'system', 'qr_generated', 'success', 'QR Code generated', '2025-10-24 00:50:30'),
	(90, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 00:50:57'),
	(91, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 00:51:02'),
	(92, 'system', 'send_message', 'success', 'Message sent to 6289678630707@c.us', '2025-10-24 00:51:26'),
	(93, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:54:18'),
	(94, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 00:54:22'),
	(95, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 00:54:29'),
	(96, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:55:22'),
	(97, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 00:55:22'),
	(98, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 00:55:26'),
	(99, 'system', 'send_message', 'success', 'Message sent to 6289678630707@c.us', '2025-10-24 00:55:30'),
	(100, 'system', 'send_message', 'success', 'Message sent to 6289678630707@c.us', '2025-10-24 00:55:53'),
	(101, 'system', 'send_message', 'success', 'Message sent to 6289678630707@c.us', '2025-10-24 00:56:08'),
	(102, 'system', 'send_message', 'success', 'Message sent to 6289678630707@c.us', '2025-10-24 00:56:18'),
	(103, 'system', 'send_message', 'success', 'Message sent to 6289678630707@c.us', '2025-10-24 00:56:26'),
	(104, 'system', 'send_message', 'success', 'Message sent to 6289678630707@c.us', '2025-10-24 00:56:46'),
	(105, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 00:59:35'),
	(106, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 00:59:36'),
	(107, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 00:59:44'),
	(108, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 01:03:43'),
	(109, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 01:03:45'),
	(110, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 01:03:54'),
	(111, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 01:06:07'),
	(112, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 01:06:09'),
	(113, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 01:06:18'),
	(114, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 01:08:04'),
	(115, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 01:08:05'),
	(116, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 01:08:10'),
	(117, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 01:49:55'),
	(118, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 01:49:56'),
	(119, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 01:50:03'),
	(120, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 02:27:07'),
	(121, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 02:30:08'),
	(122, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 02:30:13'),
	(123, 'system', 'initialize', 'failed', 'net::ERR_NAME_NOT_RESOLVED at https://web.whatsapp.com/', '2025-10-24 02:30:38'),
	(124, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 02:31:11'),
	(125, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 02:31:16'),
	(126, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 02:31:22'),
	(127, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 02:34:46'),
	(128, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 02:34:48'),
	(129, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 02:35:10'),
	(130, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 02:35:11'),
	(131, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 02:35:16'),
	(132, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 02:37:12'),
	(133, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 02:44:57'),
	(134, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 02:45:00'),
	(135, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 02:45:07'),
	(136, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 02:46:18'),
	(137, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 02:46:20'),
	(138, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 02:46:26'),
	(139, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 02:46:55'),
	(140, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 02:46:59'),
	(141, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 02:47:05'),
	(142, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 02:48:00'),
	(143, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 02:48:01'),
	(144, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 02:48:07'),
	(145, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:01:29'),
	(146, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:01:33'),
	(147, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:01:38'),
	(148, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:09:17'),
	(149, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:09:21'),
	(150, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:09:27'),
	(151, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:11:16'),
	(152, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:11:20'),
	(153, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:11:30'),
	(154, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:14:08'),
	(155, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:14:11'),
	(156, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:15:12'),
	(157, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:15:19'),
	(158, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:15:27'),
	(159, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:16:42'),
	(160, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:16:43'),
	(161, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:16:51'),
	(162, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:19:16'),
	(163, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:19:18'),
	(164, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:19:50'),
	(165, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:19:53'),
	(166, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:19:57'),
	(167, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:24:09'),
	(168, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:24:10'),
	(169, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:27:01'),
	(170, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:27:03'),
	(171, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:27:09'),
	(172, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:30:29'),
	(173, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:30:34'),
	(174, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:30:44'),
	(175, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:38:58'),
	(176, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:39:00'),
	(177, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:39:06'),
	(178, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:39:49'),
	(179, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:39:51'),
	(180, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:39:57'),
	(181, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 03:41:21'),
	(182, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 03:44:23'),
	(183, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:53:17'),
	(184, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:53:18'),
	(185, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:53:24'),
	(186, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 03:59:39'),
	(187, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 03:59:41'),
	(188, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 03:59:46'),
	(189, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 04:02:24'),
	(190, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 04:02:26'),
	(191, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 04:02:31'),
	(192, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 04:08:50'),
	(193, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 04:08:55'),
	(194, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 04:09:00'),
	(195, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 04:10:04'),
	(196, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 04:10:05'),
	(197, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 04:10:10'),
	(198, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 04:12:55'),
	(199, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 04:12:58'),
	(200, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 04:13:03'),
	(201, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 04:14:15'),
	(202, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 04:14:19'),
	(203, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 04:14:24'),
	(204, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 04:18:40'),
	(205, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 04:18:41'),
	(206, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 04:18:45'),
	(207, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 04:44:51'),
	(208, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 04:44:52'),
	(209, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 04:44:57'),
	(210, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 04:57:06'),
	(211, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 04:57:08'),
	(212, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 04:57:13'),
	(213, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 05:01:26'),
	(214, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 05:01:28'),
	(215, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 05:01:34'),
	(216, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 05:15:00'),
	(217, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 05:15:02'),
	(218, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 05:15:07'),
	(219, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 05:19:53'),
	(220, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 05:19:56'),
	(221, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 05:20:01'),
	(222, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 05:20:58'),
	(223, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 05:21:32'),
	(224, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 05:21:34'),
	(225, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 05:21:45'),
	(226, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 05:38:27'),
	(227, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 05:38:29'),
	(228, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 05:38:32'),
	(229, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 05:41:24'),
	(230, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 05:46:46'),
	(231, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 05:46:48'),
	(232, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 05:46:54'),
	(233, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 06:14:50'),
	(234, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 06:15:15'),
	(235, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 06:15:16'),
	(236, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 06:15:20'),
	(237, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 06:19:59'),
	(238, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 06:20:36'),
	(239, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 06:20:40'),
	(240, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 06:20:44'),
	(241, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 06:36:15'),
	(242, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 06:36:19'),
	(243, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 06:36:35'),
	(244, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 06:39:49'),
	(245, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 06:39:51'),
	(246, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 06:48:12'),
	(247, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 06:48:15'),
	(248, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 06:48:20'),
	(249, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 06:57:52'),
	(250, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 06:57:53'),
	(251, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 06:57:59'),
	(252, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 07:08:13'),
	(253, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 07:08:15'),
	(254, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 07:08:20'),
	(255, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 07:15:37'),
	(256, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 07:15:39'),
	(257, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 07:15:54'),
	(258, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 07:29:50'),
	(259, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 07:29:51'),
	(260, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 07:32:55'),
	(261, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 07:32:57'),
	(262, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 07:33:04'),
	(263, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 07:35:53'),
	(264, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 07:38:23'),
	(265, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 07:38:25'),
	(266, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 07:38:39'),
	(267, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 07:43:26'),
	(268, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 07:43:27'),
	(269, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 07:43:32'),
	(270, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 07:49:27'),
	(271, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 07:49:31'),
	(272, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 07:49:36'),
	(273, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 07:52:11'),
	(274, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 07:52:12'),
	(275, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 07:52:17'),
	(276, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 08:22:37'),
	(277, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 08:22:39'),
	(278, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 08:22:45'),
	(279, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 08:30:02'),
	(280, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 08:30:03'),
	(281, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 08:30:29'),
	(282, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 08:41:21'),
	(283, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 08:41:22'),
	(284, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 08:41:26'),
	(285, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:01:12'),
	(286, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:01:14'),
	(287, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:01:19'),
	(288, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:11:01'),
	(289, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:11:04'),
	(290, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:11:24'),
	(291, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:11:27'),
	(292, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:11:48'),
	(293, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:13:06'),
	(294, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:13:08'),
	(295, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:13:13'),
	(296, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:13:59'),
	(297, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:14:02'),
	(298, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:14:07'),
	(299, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:17:59'),
	(300, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:18:00'),
	(301, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:18:11'),
	(302, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:22:12'),
	(303, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:22:13'),
	(304, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:22:17'),
	(305, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:25:37'),
	(306, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:25:39'),
	(307, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:25:45'),
	(308, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:26:45'),
	(309, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:26:46'),
	(310, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:26:54'),
	(311, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:28:25'),
	(312, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:28:27'),
	(313, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:28:37'),
	(314, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:29:14'),
	(315, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:29:15'),
	(316, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:29:19'),
	(317, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:31:03'),
	(318, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:31:04'),
	(319, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:31:08'),
	(320, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:32:58'),
	(321, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:33:00'),
	(322, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:33:06'),
	(323, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 09:34:15'),
	(324, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 09:34:24'),
	(325, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 09:34:33'),
	(326, 'system', 'send_message', 'success', 'Message sent to 628111515151', '2025-10-24 09:55:43'),
	(327, 'system', 'send_message', 'success', 'Message sent to 628111515151@c.us', '2025-10-24 09:55:43'),
	(328, 'system', 'send_message', 'success', 'Message sent to 62812222', '2025-10-24 09:56:15'),
	(329, 'system', 'send_message', 'success', 'Message sent to 62812222@c.us', '2025-10-24 09:56:15'),
	(330, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 10:20:27'),
	(331, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 10:20:29'),
	(332, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 10:20:42'),
	(333, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 10:24:05'),
	(334, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 10:24:06'),
	(335, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 10:24:13'),
	(336, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 10:24:50'),
	(337, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 10:24:51'),
	(338, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 10:24:55'),
	(339, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 10:35:23'),
	(340, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 10:35:25'),
	(341, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 10:35:30'),
	(342, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 10:36:52'),
	(343, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 10:36:53'),
	(344, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 10:37:06'),
	(345, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 10:41:28'),
	(346, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 10:41:29'),
	(347, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 10:41:32'),
	(348, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 17:15:18'),
	(349, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 17:53:31'),
	(350, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 17:56:59'),
	(351, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 17:57:01'),
	(352, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 17:57:06'),
	(353, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:07:40'),
	(354, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:07:41'),
	(355, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:07:45'),
	(356, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:15:41'),
	(357, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:15:43'),
	(358, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:16:07'),
	(359, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:18:48'),
	(360, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:18:51'),
	(361, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:24:59'),
	(362, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:25:00'),
	(363, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:25:08'),
	(364, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:27:38'),
	(365, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:27:40'),
	(366, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:27:53'),
	(367, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:30:14'),
	(368, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:30:16'),
	(369, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:30:21'),
	(370, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:32:45'),
	(371, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:32:46'),
	(372, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:32:54'),
	(373, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:33:28'),
	(374, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:33:34'),
	(375, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:33:40'),
	(376, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:34:29'),
	(377, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:34:29'),
	(378, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:34:35'),
	(379, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:35:47'),
	(380, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:35:52'),
	(381, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:35:54'),
	(382, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:45:46'),
	(383, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:45:46'),
	(384, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:45:50'),
	(385, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:46:18'),
	(386, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:46:19'),
	(387, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:46:24'),
	(388, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:47:12'),
	(389, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:47:13'),
	(390, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:47:37'),
	(391, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:47:39'),
	(392, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:47:46'),
	(393, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:50:45'),
	(394, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:50:46'),
	(395, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:50:48'),
	(396, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:51:40'),
	(397, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:51:45'),
	(398, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:51:52'),
	(399, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:52:56'),
	(400, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:52:57'),
	(401, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:53:02'),
	(402, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:54:56'),
	(403, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:54:58'),
	(404, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:55:06'),
	(405, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:56:02'),
	(406, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:56:06'),
	(407, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:56:09'),
	(408, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 18:58:02'),
	(409, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 18:58:03'),
	(410, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 18:58:08'),
	(411, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 19:03:29'),
	(412, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 19:06:05'),
	(413, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 19:06:06'),
	(414, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 19:06:11'),
	(415, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 19:22:37'),
	(416, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 19:27:45'),
	(417, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 19:33:50'),
	(418, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 19:33:51'),
	(419, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 19:33:59'),
	(420, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 19:34:52'),
	(421, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 19:34:53'),
	(422, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 19:35:03'),
	(423, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 19:36:28'),
	(424, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 19:36:30'),
	(425, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 19:36:34'),
	(426, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 19:40:00'),
	(427, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 19:50:20'),
	(428, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 19:56:09'),
	(429, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 19:56:10'),
	(430, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 20:00:13'),
	(431, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 20:00:15'),
	(432, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 20:00:21'),
	(433, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 20:02:49'),
	(434, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 20:02:51'),
	(435, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 20:02:55'),
	(436, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 20:04:15'),
	(437, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 20:04:16'),
	(438, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 20:04:21'),
	(439, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 20:09:01'),
	(440, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 20:09:03'),
	(441, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 20:09:17'),
	(442, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 20:40:59'),
	(443, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 20:41:01'),
	(444, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 20:41:14'),
	(445, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 20:43:04'),
	(446, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 20:43:06'),
	(447, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 20:43:12'),
	(448, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 20:58:14'),
	(449, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 20:58:17'),
	(450, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 20:58:31'),
	(451, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 21:01:12'),
	(452, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 21:01:22'),
	(453, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 21:01:31'),
	(454, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 21:05:32'),
	(455, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 21:05:35'),
	(456, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 21:05:38'),
	(457, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 21:13:00'),
	(458, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 21:13:06'),
	(459, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 21:13:10'),
	(460, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 22:55:50'),
	(461, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 22:55:52'),
	(462, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 22:55:56'),
	(463, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 22:57:47'),
	(464, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 22:57:51'),
	(465, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 22:57:56'),
	(466, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-24 22:59:15'),
	(467, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:03:41'),
	(468, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:03:45'),
	(469, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:04:18'),
	(470, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:04:22'),
	(471, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:04:47'),
	(472, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:04:48'),
	(473, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:04:54'),
	(474, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:05:29'),
	(475, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:05:30'),
	(476, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:05:34'),
	(477, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:06:49'),
	(478, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:06:50'),
	(479, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:06:54'),
	(480, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:08:41'),
	(481, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:08:42'),
	(482, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:08:47'),
	(483, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:10:01'),
	(484, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:10:03'),
	(485, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:10:13'),
	(486, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:10:47'),
	(487, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:10:49'),
	(488, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:10:54'),
	(489, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:17:09'),
	(490, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:17:13'),
	(491, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:17:19'),
	(492, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:18:35'),
	(493, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:18:37'),
	(494, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:18:41'),
	(495, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:24:34'),
	(496, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:24:35'),
	(497, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:24:41'),
	(498, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:25:19'),
	(499, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:25:25'),
	(500, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:25:28'),
	(501, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-24 23:38:00'),
	(502, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-24 23:38:01'),
	(503, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-24 23:38:07'),
	(504, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-25 00:06:28'),
	(505, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-25 00:06:30'),
	(506, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-25 00:06:37'),
	(507, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-25 00:13:45'),
	(508, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-25 00:13:48'),
	(509, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-25 00:13:52'),
	(510, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-25 00:16:40'),
	(511, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-25 00:16:42'),
	(512, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-25 00:16:46'),
	(513, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-25 00:18:06'),
	(514, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-25 00:18:08'),
	(515, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-25 00:18:14'),
	(516, 'system', 'send_message', 'success', 'Message sent to 6289678630707@c.us', '2025-10-25 00:37:43'),
	(517, 'system', 'send_message', 'failed', 'WhatsApp Web client not ready. Please connect first.', '2025-10-25 00:39:17'),
	(518, 'system', 'initialize', 'success', 'WhatsApp Web Service initialized', '2025-10-25 00:45:42'),
	(519, 'system', 'authenticated', 'success', 'Client authenticated', '2025-10-25 00:45:44'),
	(520, 'system', 'ready', 'success', 'Client ready and connected', '2025-10-25 00:45:52'),
	(521, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 01:11:22'),
	(522, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 02:10:05'),
	(523, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 03:27:26'),
	(524, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 04:01:58'),
	(525, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 04:07:49'),
	(526, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 04:40:58'),
	(527, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 04:44:57'),
	(528, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 04:47:25'),
	(529, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 04:51:43'),
	(530, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 04:57:03'),
	(531, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 05:34:26'),
	(532, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 05:40:48'),
	(533, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 05:43:35'),
	(534, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 06:19:45'),
	(535, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 06:42:11'),
	(536, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 06:42:17'),
	(537, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 06:49:27'),
	(538, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 08:01:54'),
	(539, 'system', 'send_message', 'failed', 'Evaluation failed: b', '2025-10-25 08:39:07'),
	(540, 'system', 'initialize', 'failed', 'net::ERR_INTERNET_DISCONNECTED at https://web.whatsapp.com/', '2025-10-25 09:16:25');

-- Dumping structure for table billing.whatsapp_message_templates
CREATE TABLE IF NOT EXISTS `whatsapp_message_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` json DEFAULT NULL COMMENT 'Array of variable names',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `template_key` (`template_key`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.whatsapp_message_templates: ~6 rows (approximately)
DELETE FROM `whatsapp_message_templates`;
INSERT INTO `whatsapp_message_templates` (`id`, `template_key`, `template_name`, `message_text`, `variables`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, 'invoice_notification', 'Invoice Baru', 'Halo *{customer_name}*!\n\nTagihan internet bulan *{period}* telah tersedia:\n???? Total: *Rp {amount}*\n???? Jatuh Tempo: *{due_date}*\n\nSilakan lakukan pembayaran sebelum jatuh tempo.\n\nTerima kasih!', '["customer_name", "period", "amount", "due_date"]', 1, '2025-10-23 03:01:23', '2025-10-23 03:01:23'),
	(2, 'payment_reminder', 'Pengingat Pembayaran', 'Halo *{customer_name}*,\n\n?????? Tagihan internet Anda akan jatuh tempo dalam *{days_left} hari*.\n\n???? Total: *Rp {amount}*\n???? Jatuh Tempo: *{due_date}*\n\nMohon segera lakukan pembayaran.\n\nTerima kasih!', '["customer_name", "days_left", "amount", "due_date"]', 1, '2025-10-23 03:01:23', '2025-10-23 03:01:23'),
	(3, 'isolation_warning', 'Peringatan Isolir', '?????? *PERINGATAN ISOLIR* ??????\n\nHalo *{customer_name}*,\n\nTagihan Anda telah melewati jatuh tempo.\n\n???? Total Tunggakan: *Rp {amount}*\n???? Jatuh Tempo: *{due_date}*\n\nJika tidak dilunasi dalam *{days}* hari, layanan internet Anda akan dinonaktifkan sementara.\n\nHubungi kami untuk informasi lebih lanjut.', '["customer_name", "amount", "due_date", "days"]', 1, '2025-10-23 03:01:23', '2025-10-23 03:01:23'),
	(4, 'payment_success', 'Konfirmasi Pembayaran', '??? *PEMBAYARAN DITERIMA*\n\nHalo *{customer_name}*,\n\nPembayaran Anda telah dikonfirmasi!\n\n???? Jumlah: *Rp {amount}*\n???? Tanggal: *{payment_date}*\n???? No. Transaksi: *{transaction_code}*\n\nTerima kasih atas pembayaran Anda!', '["customer_name", "amount", "payment_date", "transaction_code"]', 1, '2025-10-23 03:01:23', '2025-10-23 03:01:23'),
	(5, 'isolation_notice', 'Pemberitahuan Isolir', '???? *LAYANAN DINONAKTIFKAN*\n\nHalo *{customer_name}*,\n\nLayanan internet Anda telah dinonaktifkan karena tunggakan pembayaran.\n\n???? Total Tunggakan: *Rp {amount}*\n\nSilakan hubungi kami atau lakukan pembayaran untuk mengaktifkan kembali layanan Anda.\n\nTerima kasih.', '["customer_name", "amount"]', 1, '2025-10-23 03:01:23', '2025-10-23 03:01:23'),
	(6, 'restoration_notice', 'Layanan Diaktifkan', '??? *LAYANAN AKTIF KEMBALI*\n\nHalo *{customer_name}*,\n\nLayanan internet Anda telah diaktifkan kembali!\n\nTerima kasih atas pembayaran Anda.\n\nSelamat menikmati layanan internet!', '["customer_name"]', 1, '2025-10-23 03:01:23', '2025-10-23 03:01:23');

-- Dumping structure for table billing.whatsapp_qr_codes
CREATE TABLE IF NOT EXISTS `whatsapp_qr_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `qr_code_data_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `expires_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.whatsapp_qr_codes: ~28 rows (approximately)
DELETE FROM `whatsapp_qr_codes`;
INSERT INTO `whatsapp_qr_codes` (`id`, `qr_code_data_url`, `session_id`, `is_active`, `expires_at`, `created_at`) VALUES
	(1, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:20:00', '2025-10-24 00:15:00'),
	(2, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:20:59', '2025-10-24 00:15:59'),
	(3, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:21:19', '2025-10-24 00:16:19'),
	(4, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:21:39', '2025-10-24 00:16:39'),
	(5, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:21:59', '2025-10-24 00:16:59'),
	(6, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:22:19', '2025-10-24 00:17:19'),
	(7, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAAAklEQVR4AewaftIAABOySURBVO3BQY7kupIAQXeh7n9ln14S3DBLUHY//Qkz+4MxxniBizHGeImLMcZ4iYsxxniJizHGeImLMcZ4iYsxxniJizHGeImLMcZ4iYsxxniJHz6k8i9VnKjsKk5UdhV3qKwqTlTuqDhR2VXcofKEiqeonFScqDyl4g6VVcUdKicVO5V/qeLkYowxXuJijDFe4mKMMV7ih5sqvkXl/5OKncquYqWyq3iCyicqnqCyqzipOFHZVawqPqGyqrhD5Q0qvkXlty7GGOMlLsYY4yUuxhjjJS7GGOMlfniQyh0Vd6g8oeJE5RMVJyqriqeorCp2KruKVcVOZafyWxW7ijtUVhV/k8pTKn5L5W9SuaPiCRdjjPESF2OM8RIXY4zxEhdjjPESP/wPqbhD5VtUdhUrlU+onFSsVO5QeUrFE1T+JpVdxUplV7FS+YTKEyp2Kv8LLsYY4yUuxhjjJS7GGOMlfvgfp3JS8S0Vd1T8TSqrip3KHSp3VJxUrFR2FTuVO1ROVFYVn1A5qVip7FR2Ff8LLsYY4yUuxhjjJS7GGOMlLsYY4yV+eFDFv6RyUvEJlZOKO1RWFTuVk4qTijtUPlHxWyq7ip3Kicqq4o6KO1ROVP6mim+p+JcuxhjjJS7GGOMlLsYY4yV+uEnlv6Zip3KisqtYqXxCZVXxlIqVyq5ipbKr2KmsKnYqJyq7iidU7FROVHYVK5VdxU5lVbFTWVXsVHYVK5WnqKwqPqHyX3IxxhgvcTHGGC9xMcYYL3Exxhgv8cOHKv7rVHYVT6h4SsVJxU7lRGVVsVM5Ubmj4ikVJxVPqNip/EsVO5VvqfivuxhjjJe4GGOMl7gYY4yXuBhjjJewP/iAyqpip/ItFXeorCo+obKq+ITKqmKnsqp4isodFSuVf61ipXJS8RSVXcVKZVdxh8pJxbeofEvFEy7GGOMlLsYY4yUuxhjjJX54UMVOZVVxh8pJxR0qd6jsKlYqd6icVOwqViq7ipOKN6i4Q+UOlVXFTuWkYlexUtmprCruUPlExUplV3Gisqv4rYsxxniJizHGeImLMcZ4iYsxxngJ+4MPqNxRsVLZVaxUPlGxUtlVrFQ+UXGisqtYqewqnqDyr1WsVE4qdiq7iieo7CruUDmpWKl8ouJE5QkVT1E5qdiprCpOLsYY4yUuxhjjJS7GGOMlfvgPqrij4ikqq4pdxUnFTuUJFTuVVcVOZVdxh8pvqewqdionFU9Q+UTFSuWOijsqTlTuUDmpOKn4losxxniJizHGeImLMcZ4iYsxxniJH26q2KncofItFauKncquYqWyq9ipnFScqOwqViq7iieoPKXijoqVyk5lVfEJlVXFTmWn8lsVn1D5loqTip3KScVKZVfxhIsxxniJizHGeImLMcZ4iYsxxniJHz5UsVLZVZxU/E0q/zUqJxV3qJxUfEvFiconKn5LZVexU/mvqVipnFTcofIUlVXFt1yMMcZLXIwxxktcjDHGS/zwIZVVxU7ljoqVyh0Vu4qVyq7iWyruULmj4kRlV7Gq2Kk8oeITKquKE5WnVOxUVhU7lTsqvkVlVXGHyh0qT7gYY4yXuBhjjJe4GGOMl7gYY4yX+OEmlU9U/FbFTmVX8VsVO5WTip3KruJE5QkVO5VVxa7ijooTlV3FSmVXsas4Ubmj4l+q2KmsKk5UdhW7ipXKUyr+losxxniJizHGeImLMcZ4iYsxxniJHx5UcaKyq1ip7CpOVE4qnlKxU1lVnFTsVHYVK5VdxbeonFQ8ReW/pmKlsqs4UTlROan4hMoTKnYqq4pdxU7lty7GGOMlLsYY4yUuxhjjJX74UMWJyknFTmVV8ZSKlcpTVHYVT6jYqawqnqJyUnGi8pSK31K5Q+VvqtiprCp2Kicqu4qVyh0qd6jsKn7rYowxXuJijDFe4mKMMV7iYowxXuKHm1S+RWVXcYfKqmKncqLyCZVVxYnKruJEZVexUtlV7CruUPmtin9NZVXxCZUTlVXFTmVX8YSKp1ScqKxUdhU7lVXFycUYY7zExRhjvMTFGGO8xA83VXxC5bcqnlKxUvlExUplV/EtKneorCp2KruKOypWKt+isqs4UdlVrFR2FbuKlcquYqVyh8obVJyo7Cp+62KMMV7iYowxXuJijDFe4mKMMV7C/uAhKndUrFSeUnGHyqriEyqrijtU7qhYqewqTlTuqDhR+ZaKT6isKnYqd1TcofK3VHxCZVWxU1lV7FR2Fb91McYYL3ExxhgvcTHGGC9xMcYYL/HDh1ROKk5UTip2KruKlcqJyq5iV/EElV3FScVOZVVxh8qu4qRip/JbFXeonKjsKv4mlVXFHRXfovKJipXKruJvuRhjjJe4GGOMl7gYY4yX+OGmik+orCpOVL6lYqdyUrFT2VWcqKwqnqLyhIpPVJyorCo+obKqOFHZqewqTipOVHYVK5Vdxa7iROUJFTuVk4oTlV3FTmVVcXIxxhgvcTHGGC9xMcYYL3Exxhgv8cODVE5UTip2KicVO5WTihOVXcUdFXdUPKHiRGVXsVNZVfxNKquKncqJyq5ip7Kq2KmsKj6hsqrYVaxU/iaVXcWq4lsuxhjjJS7GGOMlLsYY4yXsD/4ilTsq7lBZVexUTip2KruKJ6j8TRVPULmj4kTlpGKnclKxU9lVrFR2FSuVXcWJylMqViq7ip3KquIpKquKk4sxxniJizHGeImLMcZ4iYsxxngJ+4O/SOWkYqeyq1ip7CpWKruKE5U7Kk5UdhU7lZOKlcpTKnYqJxUnKruK31LZVexUTip2Kr9V8QmVVcVOZVVxh8odFScqu4onXIwxxktcjDHGS1yMMcZLXIwxxkvYH3xA5aRip/KEihOVOyp2KquKp6icVJyo3FGxU7mj4kTlCRU7lZOKncodFSuVk4qdyh0VK5VPVJyo7CqeoHJScXIxxhgvcTHGGC9xMcYYL/HDhyruqFipnFTsVHYVT1DZVaxUdhUnKruKlcpTKlYqd1TcobKrWKk8pWKlslPZVfwtKndU7FRWFZ9QWVXsKnYqv1Wxq9ip/NbFGGO8xMUYY7zExRhjvMTFGGO8hP3BDSqfqFipfEvFHSonFXeo7CpWKp+oWKmcVOxUdhUrlf9lFScqu4onqOwqViq7ipXKrmKn8i9VPOFijDFe4mKMMV7iYowxXuJijDFewv7gAyqrik+onFTcobKqOFH5RMVK5Y6KE5U7KnYqT6jYqewqfktlV3GHyknFTmVV8QmVJ1TcobKq2KmcVNyh8pSK37oYY4yXuBhjjJe4GGOMl/jhJpVPVKxUTlR2FXeorCruqHiKyqriEyorladUrFTuUNlVnKicVNyhsqs4UdlVrFROKnYqu4qVyonKrmKncqKyqzipuENlVXFyMcYYL3ExxhgvcTHGGC9xMcYYL/HDTRXfUnGHyonKHRU7lV3FSuVbKnYq/1LFUypOKk5UTlR2FTuVVcWJyidUVhV3qNxR8S0qu4rfuhhjjJe4GGOMl7gYY4yX+OFDFSuVXcUdKk+o2KncUXFSsVNZVexUViq7ijsq/iaVv0XlpOKOip3KrmKlsqs4qdiprFROKu5Q+ZsqdiqripOLMcZ4iYsxxniJizHGeImLMcZ4CfuDG1Q+UXGisqrYqewqViq7ipXKruJE5SkVK5VdxYnKrmKlckfFTuWkYqdyUnGickfFicq3VDxFZVXxCZUnVOxU7qj4rYsxxniJizHGeImLMcZ4iYsxxngJ+4MPqJxUPEFlV7FT+a2KO1SeUrFSuaPiROWbKlYqT6k4UVlV7FR2FScqu4rfUtlV7FRWFTuVOypOVHYVK5WTik+orCpOLsYY4yUuxhjjJS7GGOMlfvhQxRNUdhWrik9UrFS+pWKnclLxlIqVyq5iVbFTuaPipOJbVO6o2KmsKv4mlV3FSuWkYqeyUzmpuKPiROUJF2OM8RIXY4zxEhdjjPESF2OM8RI/3KTyiYpVxU7lpOKOihOVXcVJxYnKrmJVsVPZqawqnlJxh8pvVfxNKruKJ6jsKlYVn1A5qVipfKJipbJT2VWsKk5UvuVijDFe4mKMMV7iYowxXuKHD6n8LRWfUFlV7FRWFbuKncqq4o6KE5WnqNyhsqrYqewqfktlV3FSsVNZqewqnqLyLRUnKquKncpTVFYVO5VVxbdcjDHGS1yMMcZLXIwxxktcjDHGS9gfPETlWypOVP6mijtUVhV3qOwqVirfVLFS+ZcqvkllVXGi8omKlcquYqXyN1XsVFYVO5VdxW9djDHGS1yMMcZLXIwxxktcjDHGS/zwIZUnVNyhckfFSmVXsVNZVXxCZVXxFJUTlZOKncrfUrFTOanYqZyonFR8ouJE5QkVd1TcoXJHxUnFTmVVcXIxxhgvcTHGGC9xMcYYL2F/8EUqJxUrlU9UfIvKScVO5aRipfKJit9S+dcqVirfUvEUlTsqTlSeULFTOan411RWFScXY4zxEhdjjPESF2OM8RIXY4zxEj/cpLKruENlVfEJlZOKE5WTik9UrFROKp6isqr4JpXfqrhDZVexUtlV7FRWFX9TxYnKHRU7lROVk4qdyh0Vv3UxxhgvcTHGGC9xMcYYL3Exxhgv8cOHVFYVO5U7KlYqu4pdxYnKquITFSuVOyp2KquKncodFXeonFScVOxUvkVlVbFTOVH5RMVvqewqdionFU9Q+UTFt6isKk4uxhjjJS7GGOMlLsYY4yV+uEllV7FTWVXsVFYVO5VdxW+p3FFxh8qJyq5ip3KisqrYqewqnqByUvEJlZOKOypWKp9QWVXcobKrOFFZVTyl4kRlV/G3XIwxxktcjDHGS1yMMcZLXIwxxkv8cFPFUypWKp9QWVWcVOxUdiqrik+onFSsVD5RcaKyUrlDZVexq1ip7CpOVHYVJyqrijsqPqGyUtlVnFTsVE4qVipPUfkWlZOKk4sxxniJizHGeImLMcZ4iR8+VHGisqtYqewqVhX/WsVKZVdxUrFTWVXsVL6lYqdyorKrWFXsVFYV36Kyq9iprCp2KneofIvKqmKnsqtYqdxRcaKyq9ip/NbFGGO8xMUYY7zExRhjvMTFGGO8xA8fUllV7Cp2Kr+l8pSKb1F5gsodFScqn6h4gsqu4qRip/JbFU+p2KmcVJyo7CpWKruKlcodFTuVXcVK5aRip/KEizHGeImLMcZ4iYsxxniJizHGeAn7gw+o3FGxUjmp+ITKquJE5Y6KO1ROKnYqd1R8i8oTKnYqu4qVyq5ipbKruEPlpGKnclKxUzmpWKk8peIOlVXFTmVX8VsXY4zxEhdjjPESF2OM8RL2Bzeo3FFxovKJihOVv6lipXJSsVPZVTxBZVfxBJVdxR0qv1WxU9lV3KFyUnGHyknFicquYqXylIqVyq7iCRdjjPESF2OM8RIXY4zxEhdjjPES9gcPUTmp2KmsKv4mlV3FHSonFSuVXcVOZVWxUzmpOFF5SsVK5RMVK5VdxUplV3GickfFTmVV8RSVVcVO5Vsq/qWLMcZ4iYsxxniJizHGeAn7g4eo/NdUnKj8TRUnKicVJypPqfibVFYVO5VVxU7lb6pYqXyi4rdUvqnit1TuqDi5GGOMl7gYY4yXuBhjjJe4GGOMl7A/+IDKHRUrlV3FicpJxbeo/NdU7FRWFTuVXcVK5SkVJyp3VJyo7CruUFlVfIvKScVTVHYVT1DZVfzWxRhjvMTFGGO8xMUYY7zExRhjvIT9wQdUnlBxorKr2Kn8VsVOZVexUvlExRNUdhUnKquKp6j8r6g4UdlVrFR2FScqT6jYqbxRxcnFGGO8xMUYY7zExRhjvIT9wUuprCp2KicVO5WTijtUVhV3qNxRsVNZVexUdhW/pbKrOFHZVaxUdhVPUVlV7FRWFZ9Q+a2KncpJxR0qJxU7lV3Fb12MMcZLXIwxxktcjDHGS1yMMcZL/PAhlX+pYlexUjmp2KnsKk5UdhVPUNlVrCpOVP4mlV3FEyp2KquKncodFbuKk4o7KlYqJyq7ip3Kicqu4rdUdhU7lVXFycUYY7zExRhjvMTFGGO8xMUYY7zEDzdVfIvKJ1RWFTuVk4qdyqriW1S+pWKnsqtYqdxRcYfK31RxonJSsVP5lopvqbij4o6K37oYY4yXuBhjjJe4GGOMl/jhQSp3VHxLxUrlExUrlU+o/FbFTuUOlVXFN6l8S8VK5W+q2KmsVHYVJyp3qDxB5VtUdhU7lVXFycUYY7zExRhjvMTFGGO8xMUYY7zED//PVHxTxUplV3FSsVNZVZyo7Cp2KquKO1ROKu6oOFHZVZyo3FGxU1lV7Cp2Kr9V8QmVJ1ScVHzLxRhjvMTFGGO8xMUYY7zED//jVFYVO5WTip3KTmVVsVO5o+JbKlYqu4qdyqriDpUnVOxUdhV3VKxUdhV3VKxU7lDZVaxUvkVlV/GEizHGeImLMcZ4iYsxxniJizHGeIkfHlTxN1WsVE5UnlJxR8VKZVexU/mtip3KrmJVsVM5UdlVrFR2FTuVk4qVylMq7lBZVXxC5aRipbKr2KmsKnYqu4oTlVXFt1yMMcZLXIwxxktcjDHGS1yMMcZL2B98QOVfqtiprCq+RWVXcaKyqzhR2VWcqJxUnKjsKnYqq4qdyqriDpU7Kp6isqq4Q+WOijtUVhWfUFlVnKjcUXFyMcYYL3ExxhgvcTHGGC9hfzDGGC9wMcYYL3ExxhgvcTHGGC9xMcYYL3ExxhgvcTHGGC9xMcYYL3Exxhgv8X/OVNRYOgD4dQAAAABJRU5ErkJggg==', 'unknown', 0, '2025-10-24 00:23:28', '2025-10-24 00:18:28'),
	(8, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:24:26', '2025-10-24 00:19:26'),
	(9, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:24:46', '2025-10-24 00:19:46'),
	(10, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:25:41', '2025-10-24 00:20:41'),
	(11, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:27:02', '2025-10-24 00:22:02'),
	(12, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:28:14', '2025-10-24 00:23:14'),
	(13, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:29:01', '2025-10-24 00:24:01'),
	(14, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAAAklEQVR4AewaftIAABOzSURBVO3BQY7kupIAQXeh7n9ln14S3DBLUHY//Qkz+4MxxniBizHGeImLMcZ4iYsxxniJizHGeImLMcZ4iYsxxniJizHGeImLMcZ4iYsxxniJHz6k8i9VnKjsKlYqu4oTlU9UnKisKnYqu4qVyh0Vd6g8oeIOlV3FSmVXsVM5qdip/FbFJ1RWFXeonFTsVP6lipOLMcZ4iYsxxniJizHGeIkfbqr4FpVvqXhKxX9dxSdU7qhYqewqvkXlRGVXsVLZqewqTlTuqPivqfgWld+6GGOMl7gYY4yXuBhjjJe4GGOMl/jhQSp3VNyh8lsqn6h4gsqJylMqTlR2FScqO5UTlVXFUypWKruKp6isKu5QOak4UfmbVO6oeMLFGGO8xMUYY7zExRhjvMTFGGO8xA//41RWFTuVk4pPqKwqdiqrik+orCp2KquKO1R2FTuVk4onVOxUnlCxUzlR2VWsVHYVJyp3VOxU/hdcjDHGS1yMMcZLXIwxxkv8MKjYqawqPlFxUnFHxUplV3FScVKxU7lD5Y6K36r4hMoTKnYqq4pPqKwqdionKruK/wUXY4zxEhdjjPESF2OM8RIXY4zxEj88qOK/puIJKruKncpJxUrljoqdyqpip/KUit9S2VXsVFYVu4qVyh0VT6lYqXyi4qRipbKr+JaKf+lijDFe4mKMMV7iYowxXuKHm1T+ayp2KquKncquYqVyR8VOZVWxU9lVrFR2FSuVXcVOZVWxUzlR2VV8i8qqYqeyq1ip7Cp2KquKncqqYqdyorKruENlVfEJlf+SizHGeImLMcZ4iYsxxniJizHGeIkfPlTxv0BlV/GUiidU7FR+q+ITFSuVOyr+ayp2KquKp1SsVHYVJxUnFZ+oOKn4r7sYY4yXuBhjjJe4GGOMl7gYY4yXsD/4gMqqYqfyLRUnKruKO1TuqFip7CpWKk+peILK31SxU/mWihOVOypWKk+pOFHZVZyofEvFEy7GGOMlLsYY4yUuxhjjJewPPqDyLRV3qKwq/jWVVcWJyicqfkvlKRUnKruKlconKn5LZVdxh8q3VOxUVhU7lVXFHSrfUrFT2VX81sUYY7zExRhjvMTFGGO8xMUYY7yE/cENKruKncpJxUplV3Gisqu4Q+Wk4kTlpGKnsqtYqewq7lC5o+JEZVXxCZVVxYnKUyp2KicVJyp/U8VKZVexU1lVPEVlVXFyMcYYL3ExxhgvcTHGGC/xw4dU7qj4rYqdyq5iVbFTWVXsVP5rKp6gsqs4qfiEyr+k8i0qu4qVyonKJypWKruKE5Wdyh0VT1DZVfzWxRhjvMTFGGO8xMUYY7zExRhjvIT9wQdU7qg4UfmWipXKJypOVHYVT1C5o+JEZVexUtlVnKjcUbFTeULFHSp3VKxUdhU7ld+q2KmcVOxUTip2Kk+oOLkYY4yXuBhjjJe4GGOMl7gYY4yX+OFBFTuV36q4Q2WncofKquITKr9VsavYqZyorCqeorKrWFWcqHyiYqWyq1ip/E0VO5VVxScqTlROKk5UPlHxWxXfcjHGGC9xMcYYL3Exxhgv8cOHKk5UdhUnKiuVXcUdFSuVXcVOZaWyq/ibKlYqd1TcUXGHyqriEyqripOKncq3qDxFZVWxqzhR2VU8QeUOlZOKk4sxxniJizHGeImLMcZ4iYsxxniJH/4ylZOKncpJxU5lVbFT2VWsVD6h8oSKncqq4kRlV7FTWVV8QuVbKlYqd1Q8ReWkYqXyiYqVyh0VJxVPqbij4rcuxhjjJS7GGOMlLsYY4yUuxhjjJewPHqJyUrFTOanYqfwtFTuVXcWJyqpip7KrWKmcVOxUdhUrlU9UrFR2FSuVXcWJyknFU1TuqFip7Cp2KicVK5U7KnYqJxU7lVXFJ1RWFScXY4zxEhdjjPESF2OM8RL2BzeofKLiRGVVsVPZVaxUdhUrlU9UrFSeUrFS+UTFE1S+pWKnckfFb6nsKu5QOanYqawq7lA5qXiKyq5ipXJSsVPZVfzWxRhjvMTFGGO8xMUYY7zExRhjvIT9wQdUVhU7lTsqVipvULFTWVWcqDylYqWyq7hD5aTiKSqrip3KqmKnsqtYqewqTlTuqPiXVHYVO5VVxU7lpGKnsqo4uRhjjJe4GGOMl7gYY4yXsD+4QWVXcYfKquITKk+o2KmcVDxB5V+rWKnsKk5UdhUnKndU3KFyUrFTWVWcqOwqnqDylIpvUdlV/NbFGGO8xMUYY7zExRhjvMTFGGO8hP3BB1SeUHGi8omKv0VlV7FTWVXsVFYVn1BZVZyo7CqeorKq2KmsKp6ickfFicodFSuVT1SsVO6o2KmsKj6hsqrYqawqdiq7it+6GGOMl7gYY4yXuBhjjJe4GGOMl/jhpoqdyq7iRGVVsVM5UdlV3KGyqtipnKicqHyiYqVyh8qu4lsqnqByR8W/VPEJld+q+ETFicqJyonKt1yMMcZLXIwxxktcjDHGS9gf/EUqu4qVylMqTlR2FScqT6h4isodFd+isqr4hMpvVXxCZVXxCZVVxYnKJypOVFYVO5U7Kr5F5aTi5GKMMV7iYowxXuJijDFe4mKMMV7ihw+prCp2KneorCq+RWVX8TdVnKjcUXGHyknFTmVV8TdVrFR2FScqd6h8i8odFf+rLsYY4yUuxhjjJS7GGOMl7A8+oLKquEPlWyp2KquKncquYqWyqzhR2VWsVD5RsVJ5SsUTVHYVK5VdxR0qq4qdyq7iROWOijtU/qWKncqq4ikqq4qTizHGeImLMcZ4iYsxxniJizHGeIkfblLZVZxU3KGyqzipeELFTmVX8S0qJxUrlV3FTuWk4qTipGKnsqtYqdxR8S0VO5VVxScq/haVncoTVD5R8VsXY4zxEhdjjPESF2OM8RIXY4zxEvYHH1BZVXxCZVVxorKr2KmsKk5UPlGxUvlExYnKquITKquKncpJxbeofEvFTuVbKp6gsqs4UbmjYqdyUnGisqs4UTmpOLkYY4yXuBhjjJe4GGOMl/jhL1M5qdip7CpOVFYVO5WTip3Kicqu4kTlRGVXsVLZqZxUfELlpGKl8omKlcqu4kRlV7FSuUPlWypOVO6o2KncobKq2FXsVH7rYowxXuJijDFe4mKMMV7iYowxXsL+4C9S+ZaKE5VPVKxU7qjYqTyhYqdyR8WJyhtV7FRWFTuVXcVKZVexUnlKxR0q/1LFEy7GGOMlLsYY4yUuxhjjJS7GGOMlfrhJZVexUzmpuENlpbKrOKnYqZxU3FFxonKi8q9V/JbKruIJKneo7Cp2KquKncqq4g6VncqqYqdyUnGHyq5ipfItF2OM8RIXY4zxEhdjjPESP9xUsVPZVaxUTlR2FXeo3FFxh8qqYqdyUrFTWVXsVE4qdiqrijtUdhUnKndUPKHiExW/pbKr2KmcVJxU7FROVHYVv1WxUzmpOLkYY4yXuBhjjJe4GGOMl7gYY4yXsD/4gMq3VNyhclLxLSq7ipXKScXfpLKrWKl8ouK3VD5R8QSVOyqeoLKrOFH5loo7VHYVf8vFGGO8xMUYY7zExRhjvIT9wV+k8i9V7FS+pWKnclKxU1lV/E0qf1PFicqq4ptUTiruUDmpWKn811TsVE4qTi7GGOMlLsYY4yUuxhjjJS7GGOMl7A8eovKEiqeonFTsVFYVn1BZVdyhsqtYqXxLxSdUnlDxL6ncUfEtKruKN1LZVfzWxRhjvMTFGGO8xMUYY7zExRhjvIT9wQ0qd1ScqOwqdionFU9QuaNip7Kq2KnsKr5F5aTiRGVXsVL5RMUTVHYVJyq7ipXKrmKlsqvYqXxLxUrlKRUnKicVJxdjjPESF2OM8RIXY4zxEvYHH1BZVXxCZVXxFJXfqtip7CpWKruKE5WTip3KEyruULmjYqeyqniKyqpip3JHxU5lVXGHyq7it1R2FTuVk4r/uosxxniJizHGeImLMcZ4iYsxxngJ+4OHqPxNFSuVXcVK5W+q2KmcVOxUfqtip7KrWKnsKnYqv1Vxh8odFd+isqu4Q+VbKk5UdhW/pXJHxcnFGGO8xMUYY7zExRhjvMQPN6ncUfEtFTuVVcUdKt9SsVO5o2Kl8gmVVcVO5aRip/KEip3KHSqrip3KHSqrijsqdiqrijtUPqGyqtiprCq+5WKMMV7iYowxXuJijDFe4mKMMV7C/uAGlf+aiqeorCp2KicVT1FZVdyh8pSKlcquYqVyR8V/jcquYqXyiYqVyq7iCSp3VOxUVhU7lV3Fb12MMcZLXIwxxktcjDHGS1yMMcZL/PAhlVXFU1RWFTuVO1RWFXeo/E0qJyp3VOxU7lA5UVlV7FR2FSuVk4qdyhuoPEHlb6o4qdiprCpOLsYY4yUuxhjjJS7GGOMlfrhJ5VtUPlFxUrFS2VWcVOxUdhUrlV3FScVOZVVxorJT+ZsqTip2Kk+o+BaVk4pPqJyorCr+NZWTiidcjDHGS1yMMcZLXIwxxktcjDHGS/zwoIoTlV3FicpO5bcqdip/k8qqYqeyq1ipnFR8k8qJyqriExUrlROVXcVO5QkVO5VVxVMqTip2KquKncoTKj5R8VsXY4zxEhdjjPESF2OM8RIXY4zxEj/cVLFT2VWsKk5UdhVPUPlExUplV3FSsVO5Q+Wk4kRlV7FS2VWcVNyhclKxU1lV7FSeUrFS2VWsVO6o2KmcVJyofKLipOJE5aTi5GKMMV7iYowxXuJijDFewv7gAyonFScqJxU7lV3FicqqYqeyqzhRuaPiRGVXcaKyqtip7CpOVJ5Q8QmVk4o7VFYVT1FZVexUTip2KquKO1R2FScqu4q/5WKMMV7iYowxXuJijDFe4mKMMV7ihwep7CpOKlYqu4qdyqrib6p4gsquYqdyUrFSuUNlV3GicqLyiYqVyk5lVbFT2VWcqOwqViq7ipXKHSq7ihOVXcWJyq5iVbFTWVXsVE4qTi7GGOMlLsYY4yUuxhjjJewPHqJyR8UTVL6lYqeyq1ipnFR8QmVVsVP5mypOVFYVO5VdxUplV7FS2VXcoXJSsVNZVTxFZVWxU9lVrFTuqDhR2VXsVFYVJxdjjPESF2OM8RIXY4zxEhdjjPESPzyo4gkqu4qTiqeorFSeUnGicqJyUvE3qZyo7Cp2Kicqd6icVJyo3KGyq/gtlV3F36SyqtipPOFijDFe4mKMMV7iYowxXuJijDFe4oebVD5RsVLZVawqdionFXeonFR8QmVVsVM5qdip/JbKJypOVO6oOFE5qThReYrKruJbVFYVd6g8peKk4o6K37oYY4yXuBhjjJe4GGOMl/jhpopvUdlVnKjsKv5rKlYqn6hYqewqTlSeUrFSOVHZVZyo3KGyqzhRuaPipGKnslLZVZyo7CpOVHYqT6h4wsUYY7zExRhjvMTFGGO8xMUYY7zEDx9SWVV8QmVVcVJxR8WJyq7iROUpKk+o2KmcVOxUVhWfUPmXKlYqu4qnqKwqdiqrijsqdiqrijtUPlFxonKisqv4rYsxxniJizHGeImLMcZ4iR8+VHGicqJyR8VOZVVxh8qu4gkqu4qVyidUTipWKjuVE5VdxU7ltyo+obKq2KmsKj6hsqr4m1R2FSuVXcVJxVNUVhW7ijtUVhUnF2OM8RIXY4zxEhdjjPESF2OM8RI/fEjljoqVyq7iCSq7ilXFHRU7lV3FicqqYqdyUrFTWVXsVHYVK5WdyknFUyqeoHJHxU5lpXJHxU5lVbFTWVXsVE4q7lA5qfiWizHGeImLMcZ4iYsxxniJizHGeAn7gw+oPKHiRGVXcaJyUnGHyq7iDpVVxSdUfqviKSr/KypOVO6oOFHZVaxU3qBipbKreMLFGGO8xMUYY7zExRhjvIT9wUuprCp2KicVO5U7Kn5LZVdxonJHxU7ljorfUtlVPEFlV3GHyknFTmVVcYfKScVO5aTiDpWnVPzWxRhjvMTFGGO8xMUYY7zExRhjvMQPH1L5lyp2FSuVk4pvUjmpWFXsVE4qdionKruKE5UTlV3FE1ROKnYqu4pvqVip7Cp2Kk+o2KmcqOwqTiruUFlVnFyMMcZLXIwxxktcjDHGS1yMMcZL/HBTxbeofELlt1R2FbuKlcqu4kTlKRUrlTsqvqXiDpU7KlYqn1BZVXyi4rcqPlFxorJS2VXcUXGHyqriWy7GGOMlLsYY4yUuxhjjJX54kModFU+o2KmcqOwqnlDxFJXfqtip7CpWKp9QeULFTmVVsVM5qfgWlV3FSmVXsVN5gsqJylMqViq7il3Fb12MMcZLXIwxxktcjDHGS1yMMcZL/PA/RGVXcaJyh8quYqWyq1ipfKLit1R2FScVO5UnVHyiYqWyq1ip3KHyCZUTlVXFHRU7lVXFTuVbKk4qPqGyqji5GGOMl7gYY4yXuBhjjJf44f8ZlV3FTmVV8RSVVcVO5QkVd6jsKv5rVFYVO5VdxRMqTlQ+UbFSOVHZVZyoPEXlpOIJF2OM8RIXY4zxEhdjjPESF2OM8RI/PKjib6pYqexUTlROVHYVJxU7lZOKncqq4kTlExUnKv9SxYnKf03FHRU7lVXFTmVXcUfFScXfcjHGGC9xMcYYL3ExxhgvcTHGGC/xw00q/5rKEyp2KquKT6isKv4mlZOKk4qnqKwqPqGyUvmWik+orFR2FXeonFTcobKq2KmcqOwqTlSecDHGGC9xMcYYL3ExxhgvYX8wxhgvcDHGGC9xMcYYL3ExxhgvcTHGGC9xMcYYL3ExxhgvcTHGGC9xMcYYL/F/cJWxn8Pa/soAAAAASUVORK5CYII=', 'unknown', 0, '2025-10-24 00:30:01', '2025-10-24 00:25:01'),
	(15, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:31:10', '2025-10-24 00:26:10'),
	(16, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:32:24', '2025-10-24 00:27:24'),
	(17, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:33:23', '2025-10-24 00:28:23'),
	(18, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:33:43', '2025-10-24 00:28:43'),
	(19, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:34:03', '2025-10-24 00:29:03'),
	(20, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:34:23', '2025-10-24 00:29:23'),
	(21, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:34:43', '2025-10-24 00:29:43'),
	(22, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:35:54', '2025-10-24 00:30:54'),
	(23, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAAAklEQVR4AewaftIAABNlSURBVO3BQY7cOhYAwUyh73/lHC8JblgtqOyvwYuwPxhjjBe4GGOMl7gYY4yXuBhjjJe4GGOMl7gYY4yXuBhjjJe4GGOMl7gYY4yXuBhjjJf44UMq/1LFicqu4kTljoqdyknFHSqrip3KScUdKruKlcpJxR0qu4qVyq7iDpU7Kv4llZOKncq/VHFyMcYYL3ExxhgvcTHGGC/xw00V36LyLSr/msrfUvEJlSdUPEVlVbFTWVV8QuWkYqfyWypPqfibKr5F5bcuxhjjJS7GGOMlLsYY4yUuxhjjJX54kModFXeonKisKnYqJxXfUrFTOVHZVaxUPlFxorJT+a2KncoTVHYVu4qVyicqVip3VDxB5W9SuaPiCRdjjPESF2OM8RIXY4zxEhdjjPESP/yfq1ipPEXlCSqfqPitijtUPlGxUtlVnFScqNyhclLxr6k8oWKn8v/gYowxXuJijDFe4mKMMV7ih/8jFTuVVcVO5URlV7FTWVXsVFYVO5UTlZOKT6isKnYqO5UTlTsqVhVPUTlRuUNlVfGJipXKHSq7iv8HF2OM8RIXY4zxEhdjjPESF2OM8RI/PKjiv6biCRU7lV3FSuWOip3KquIOlV3FSuUTFb+lsqvYqawqdipPUNlV7FRWFScqu4qdyhMqvqXiX7oYY4yXuBhjjJe4GGOMl/jhJpU3UFlVfKJipbKr2KmsKnYqJyq7ipXKrmKlsqvYqawqdionKruKv6Vip7KrWKk8RWVVsVPZVaxUdhUrlU+orCo+ofJfcjHGGC9xMcYYL3ExxhgvcTHGGC9hf/BSKk+ouEPlpGKn8i0V36Kyq/gtlU9UrFR2FSuVXcVO5VsqVip3VNyhclLxRhdjjPESF2OM8RIXY4zxEhdjjPES9gcfUFlV7FS+peJEZVdxh8pJxbeo7Cp+S+UTFScq31Jxh8qq4ikqd1ScqDyhYqdyUrFT+ZaKJ1yMMcZLXIwxxktcjDHGS/xwk8qu4kTlpOKOijdS+YTKquJbVHYVO5X/EpVdxd+kclJxorKrOKk4UflExUrlDpVdxW9djDHGS1yMMcZLXIwxxktcjDHGS9gffEDlCRU7lZOKE5U7Kk5U7qi4Q2VX8QSVXcUdKicVJyonFXeonFTsVHYVJyqrip3KruK3VHYVd6jsKlYqd1TsVFYVJxdjjPESF2OM8RIXY4zxEj/cVPEJlZXKScUnVFYVT1E5qdipnKisKp6iclLxN6msKj5RsVLZVaxUPlGxUvmEyqpiV7FSeYrKquIpFTuV36r4losxxniJizHGeImLMcZ4iYsxxniJHz5U8YSKE5VdxR0qd1ScqOwq/qWKJ6jsKr6lYqdyonJSsVNZVexUTlR2FauKT6j8lsquYqeyqrij4kTlWy7GGOMlLsYY4yUuxhjjJS7GGOMlfniQyq5ipXJSsVP5loqdyh0q/5LKt6jsKn5L5RMVJypPUHmjik9UrFQ+UbFS2VWsKnYqT7gYY4yXuBhjjJe4GGOMl/jhQyqriqdUrFTequIJFTuVVcWu4kTlpGKnslP5rYpPqPxWxScq7lBZVexUVhV3VJyofKJiVfEJlVXFicq3XIwxxktcjDHGS1yMMcZLXIwxxkv8cJPKrmKnsqrYqawqdip3VJyo7CpWKruKE5WTik9UnKisKp5SsVP5L1HZVexUVhV3qOwqViq7in9J5VsqdipPuBhjjJe4GGOMl7gYY4yXuBhjjJewP7hBZVexU3lCxU7lpOIOlVXFTuWkYqfyhIqdyknFHSq7ipXKruJE5Vsq7lDZVaxUdhV3qJxUrFT+poqdyqriEyqripOLMcZ4iYsxxniJizHGeAn7gxtUnlJxh8q/VHGickfFTuWkYqVyR8UnVJ5Q8S+pPKVipbKruENlVXGHyh0VO5VVxU5lV/FbF2OM8RIXY4zxEhdjjPESF2OM8RL2BzeoPKVipbKrOFHZVaxUdhUnKp+oeILKHRXforKrWKmcVOxUdhVPULmjYqeyqjhReUrFSmVXsVNZVexUdhUrlTsqdiqripOLMcZ4iYsxxniJizHGeIkfbqq4Q+Wk4o6Kk4pvUllV7FRWFU9RuaNipbKreILKruJEZVdxUnGHyrdU/E0Vd6isKu5Q2VX81sUYY7zExRhjvMTFGGO8xMUYY7zED1+msqo4UdlV7FSeUPGUit9S+ZsqTio+obKqOFH5hMqJyh0VJxU7lZXKruJE5QkVn1BZVTxFZVXxLRdjjPESF2OM8RIXY4zxEhdjjPESP3xIZVXxiYqVyq5iVfGUijtUVhU7lZ3Kb1V8QuWk4kRlV7FSeYrKHRXfovKEip3KquIpKicqu4qVyicqVip3VOxUVhUnF2OM8RIXY4zxEhdjjPESP9yksqvYqawqdionFScVd6jsKu6oWKnsKlYqd1TsVFYVn1BZVXxLxVNU7qg4UXmCyt9UsVM5qTip2KmcqDzhYowxXuJijDFe4mKMMV7iYowxXsL+4AMqJxV/k8pvVXxC5QkVO5VVxSdUfqtip3JHxU5lVXGisqvYqfxWxSdUnlDxFJVVxR0qu4o7VFYV/9LFGGO8xMUYY7zExRhjvIT9wQ0qu4oTlV3FSuUpFSuVT1ScqOwqVionFXeoPKXiCSq7iieonFR8k8pJxUrlKRUnKruKO1RWFTuVk4onXIwxxktcjDHGS1yMMcZLXIwxxkv88B9UsVP5loqdyhMqTlSeUrFSuUNlV7FTWVXcobKrWFU8ReUJFTuVVcUdKjuVVcWu4kTlDpVdxUplp3JScXIxxhgvcTHGGC9xMcYYL3Exxhgv8cOXqawqTlR2FTuVE5VVxScqTlR2KicVJxU7lVXFTuUJFTuVXcWJyh0qq4oTlTsqdiq7ipXKruJEZVdxUnGisqtYVexUTipOKnYqT7gYY4yXuBhjjJe4GGOMl7A/+IDKHRUrlZOKncqu4kRlVbFTuaPiRGVXcaKyq/gtlV3FTmVV8QmVk4qVyq5ip/JfV3Gi8omK31K5o2KnsqtYqZxUfEJlVXFyMcYYL3ExxhgvcTHGGC9xMcYYL2F/8BCV/5qKlcquYqeyqviEyqpip7Kq+ITKScW3qHxLxYnKScVTVHYVK5VdxUplV7FTeULFTuW/ruLkYowxXuJijDFe4mKMMV7iYowxXuKHD6msKnYVJyq7ijtUTlROVHYVJyq7ipXKHSp3qJxU7FRWFZ+o+C2VOypOVHYVO5U7VP6Wip3KquKOijtUdhUnKruK37oYY4yXuBhjjJe4GGOMl/jhJpVdxU7lt1R2FScVO5W/SWVVsVO5o2Kl8l+jsqs4UdlVrFROKu6ouEPlDpVdxW+p7CruUNlVPKFip7KqOLkYY4yXuBhjjJe4GGOMl7gYY4yX+OFDFScqT6i4Q+WkYqfyL6nsKnYqq4oTlU9UrFTuqHiKyqriKRUnKruKE5WTihOVXcVKZadyR8W3qOwqfutijDFe4mKMMV7iYowxXsL+4AaVXcVO5W+p2KmsKp6ickfFSmVXcaKyq/gWlb+pYqXylIoTlTsq7lA5qThReYOK37oYY4yXuBhjjJe4GGOMl7gYY4yXsD/4gModFSuVk4qdyq7it1Q+UbFS2VWcqJxU7FT+pYqdyrdU3KFyUrFT+ZaKb1FZVexUdhUrlTsqdip3VPzWxRhjvMTFGGO8xMUYY7zExRhjvIT9wQdUVhU7lV3FicpJxU5lVbFTOak4UdlV3KGyqviEyknFHSp3VJyorCo+obKquEPlpGKnsqt4gsquYqVyR8VO5Y6Kb1FZVZxcjDHGS1yMMcZLXIwxxkv88KGKb6k4UTlR2VXcobKq2Kk8QeWOijtUdhV3qHxLxd+isqvYqfwtFd9SsVPZqfxWxbdcjDHGS1yMMcZLXIwxxktcjDHGS9gf3KByR8WJyq5ip/KEihOVT1SsVO6o2KmsKr5F5W+qOFH5loqdyq7iCSp3VKxU7qj4hMqq4kTljoqTizHGeImLMcZ4iYsxxniJH26q2Kk8oWKnsqtYqewqnlDxCZXfqniKyknFTuWOipXKf03FU1RWFScqu4onVHxC5VtUVhXfcjHGGC9xMcYYL3ExxhgvcTHGGC9hf/AXqewqVip/U8WJyq7iROVvqjhReUrFSuWkYqeyqzhRWVV8QmVVcYfKruJEZVdxonJSsVO5o2KlclKxU9lV/NbFGGO8xMUYY7zExRhjvMTFGGO8hP3BB1ROKv4mlZOKlco3VZyorCp2Kt9SsVNZVexUTip2KquKncoTKu5QeUrFHSqrihOVXcVO5aTib1JZVZxcjDHGS1yMMcZLXIwxxkv88KGKJ6jsKlYqu4pdxUrlpOITKquKncoTVD5RsVLZVaxUdionKruKE5UTlb9J5aTiEyrfUrFSOanYqewq7lB5QsUTLsYY4yUuxhjjJS7GGOMlLsYY4yV+eJDKruK3KnYqu4oTlVXFTmVXsVLZVdxRcaJyh8qq4g6VncpJxU5lVfEUlZXKrmKnslK5o2Knsqr4hMpJxR0qq4o7Kk5UPlHxWxdjjPESF2OM8RIXY4zxEhdjjPES9gf/mMq3VJyoPKXi/4HKHRUnKndUnKh8ouIOlVXFTmVVsVPZVaxU/msqdiqrip3KScXJxRhjvMTFGGO8xMUYY7zEDx9SWVV8S8UnVFYVO5VVxa5ip3JScaLylIoTlVXFTmVX8QSVk4pPqKxUdhWrim+qWKncUbFTWVX816j8SxdjjPESF2OM8RIXY4zxEhdjjPESP3yoYqWyq3iCyq7iROUOlV3FSmWnsqv4rYqdyk7lX6o4UblDZVexUtmprCp2KruKE5U7Kk5UdhUrladUrFTuqDhR2VXsVH7rYowxXuJijDFe4mKMMV7C/uAGlV3Ficqu4gkqT6k4UdlVnKicVNyh8jdVnKjcUfFbKruKncqqYqdyUvE3qawqdiq7ipXKHRUnKp+o+K2LMcZ4iYsxxniJizHGeImLMcZ4iR/+sooTlW+p2KnsVJ6gsqs4UTmp2FXcobKquEPljoqdym9VPKVip3Kisqr4hMqqYlexUtlV7FS+RWVVsVPZqawqTi7GGOMlLsYY4yUuxhjjJS7GGOMlfviQyh0qq4qdyqriKSorlU9UPKHiROUTFSuVXcWJyh0qT6j4FpVdxR0qJyonKp+oWKmcVDylYqdyUnFS8YSLMcZ4iYsxxniJizHGeAn7gw+orCruUPmvqdipnFScqOwq7lBZVexUVhU7lV3FE1ROKnYqu4qVyh0Vd6icVNyh8jdV/C0qu4onXIwxxktcjDHGS1yMMcZLXIwxxkv88GUqv1WxU7mjYqVyR8VOZVexqtiprCp2KruKlcqJyidUVhU7lSeo7CpOKr5F5Q6VXcVKZVexU/mtik+orCp2KicVO5U7VFYVJxdjjPESF2OM8RIXY4zxEvYHD1H5mypOVFYVO5VdxUrlExV/i8quYqXylIqdyknFicpJxYnKUyq+RWVX8QSVb6m4Q+Wk4uRijDFe4mKMMV7iYowxXuJijDFewv7gAyp3VKxUdhV3qKwq7lDZVZyo/NdV7FR2FSuVOyruUNlVnKisKnYqf1PFSmVXcaKyq3iCyq7iDpVVxU5lV/FbF2OM8RIXY4zxEhdjjPESF2OM8RL2Bx9QeULFicquYqeyqvgWlV3Ft6jsKk5UVhVPUfmWip3Kb1XsVHYVJyq7ipXKruJE5QkVO5W/qWKlckfFycUYY7zExRhjvMTFGGO8xA8fqvhbKu5Q2VWsVP5rVHYVd1SsVHYVO5VVxScqfkvlExUrlV3FSmVX8RSVVcWJyq7iDpWTip3KquIOlZOKncqu4rcuxhjjJS7GGOMlLsYY4yUuxhjjJX74kMq/VLGrOFFZVdyh8i0VO5VdxUrlpOIOlTtUdhUnKruKVcVO5Q6Vk4qdykplV7Gq2Kn816jsKk5UTip2KquKk4sxxniJizHGeImLMcZ4iYsxxniJH26q+BaVT6isKnYVK5VdxU5lVfEUlVXFJ1R+S+WOip3KScXfVHGicofKE1R2FScqu4oTlTsq7qg4UXnCxRhjvMTFGGO8xMUYY7zEDw9SuaPiCSonFTuVO1SeoPKJipXKruJEZVexUvmEyhMqdiq/VfGJihOVXcVK5aRip/IvqTxF5aRip/JbF2OM8RIXY4zxEhdjjPESF2OM8RI//B+pOFHZVZyo7CpOVO6o2KmcqJxU7FRWFZ9Q+a2KT1SsVE5UdhUnKruKncpvqewqdionKquKb6r4L7kYY4yXuBhjjJe4GGOMl/jh/5zKHSpPqNiprCruqNip3FGxUvlExbeo/C0VO5VdxYnKqmKnsqtYqewq7qhYqXxCZVWxUzmpeMLFGGO8xMUYY7zExRhjvMTFGGO8xA8PqvibKn6rYqeyqzhR2VV8S8VK5Q6VXcWqYqfyBJVdxUnFTmVV8QmVk4o7Kk4qTip2KquKXcW3qOwq/paLMcZ4iYsxxniJizHGeImLMcZ4iR9uUvnXVE4q3khlV/GEijsqdiqrip3KqmKncqJyorKr2FWcqNxRcaJyR8UTKnYqu4rfUvmWizHGeImLMcZ4iYsxxngJ+4MxxniBizHGeImLMcZ4iYsxxniJizHGeImLMcZ4iYsxxniJizHGeImLMcZ4if8BvWtG7CF8su0AAAAASUVORK5CYII=', 'unknown', 0, '2025-10-24 00:36:46', '2025-10-24 00:31:46'),
	(24, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:53:11', '2025-10-24 00:48:11'),
	(25, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:54:10', '2025-10-24 00:49:10'),
	(26, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:54:30', '2025-10-24 00:49:30'),
	(27, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:54:50', '2025-10-24 00:49:50'),
	(28, 'data:image/png;base64,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', 'unknown', 0, '2025-10-24 00:55:10', '2025-10-24 00:50:10'),
	(29, 'data:image/png;base64,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', 'unknown', 1, '2025-10-24 00:55:30', '2025-10-24 00:50:30');

-- Dumping structure for table billing.whatsapp_web_sessions
CREATE TABLE IF NOT EXISTS `whatsapp_web_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `device_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_data` json DEFAULT NULL,
  `is_connected` tinyint(1) DEFAULT '0',
  `last_activity` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_id` (`device_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_is_connected` (`is_connected`),
  KEY `idx_last_activity` (`last_activity`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table billing.whatsapp_web_sessions: ~38 rows (approximately)
DELETE FROM `whatsapp_web_sessions`;
INSERT INTO `whatsapp_web_sessions` (`id`, `device_id`, `session_data`, `is_connected`, `last_activity`, `created_at`, `updated_at`) VALUES
	(1, 'device_wfk72z22f', '{"type": "whatsapp_web_binding", "deviceId": "device_wfk72z22f", "sessionId": "session_1761191038444", "timestamp": 1761191038444}', 0, '2025-10-22 20:43:58', '2025-10-22 20:43:58', '2025-10-22 20:43:58'),
	(2, 'device_6ajviyi25', '{"type": "whatsapp_web_binding", "deviceId": "device_6ajviyi25", "sessionId": "session_1761193825568", "timestamp": 1761193825568}', 0, '2025-10-22 21:30:25', '2025-10-22 21:30:25', '2025-10-22 21:30:25'),
	(3, 'device_2of1330q2', '{"type": "whatsapp_web_binding", "deviceId": "device_2of1330q2", "sessionId": "session_1761193864885", "timestamp": 1761193864885}', 0, '2025-10-22 21:31:05', '2025-10-22 21:31:05', '2025-10-22 21:31:05'),
	(4, 'device_74oanq4c5', '{"type": "whatsapp_web_binding", "deviceId": "device_74oanq4c5", "sessionId": "session_1761193865671", "timestamp": 1761193865671}', 0, '2025-10-22 21:31:05', '2025-10-22 21:31:05', '2025-10-22 21:31:05'),
	(5, 'device_brki8dsot', '{"type": "whatsapp_web_binding", "deviceId": "device_brki8dsot", "sessionId": "session_1761193866237", "timestamp": 1761193866237}', 0, '2025-10-22 21:31:06', '2025-10-22 21:31:06', '2025-10-22 21:31:06'),
	(6, 'device_bdiffmrsu', '{"type": "whatsapp_web_binding", "deviceId": "device_bdiffmrsu", "sessionId": "session_1761193876261", "timestamp": 1761193876261}', 0, '2025-10-22 21:31:16', '2025-10-22 21:31:16', '2025-10-22 21:31:16'),
	(7, 'device_8ehu0db99', '{"type": "whatsapp_web_binding", "deviceId": "device_8ehu0db99", "sessionId": "session_1761193885710", "timestamp": 1761193885710}', 0, '2025-10-22 21:31:25', '2025-10-22 21:31:25', '2025-10-22 21:31:25'),
	(8, 'device_gcn9nym4y', '{"type": "whatsapp_web_binding", "deviceId": "device_gcn9nym4y", "sessionId": "session_1761193885908", "timestamp": 1761193885908}', 0, '2025-10-22 21:31:25', '2025-10-22 21:31:25', '2025-10-22 21:31:25'),
	(9, 'device_0mr6ir93h', '{"type": "whatsapp_web_binding", "deviceId": "device_0mr6ir93h", "sessionId": "session_1761193886124", "timestamp": 1761193886124}', 0, '2025-10-22 21:31:26', '2025-10-22 21:31:26', '2025-10-22 21:31:26'),
	(10, 'device_8p229k9gf', '{"type": "whatsapp_web_binding", "deviceId": "device_8p229k9gf", "sessionId": "session_1761193887221", "timestamp": 1761193887221}', 0, '2025-10-22 21:31:27', '2025-10-22 21:31:27', '2025-10-22 21:31:27'),
	(11, 'device_9pbfi64gl', '{"type": "whatsapp_web_binding", "deviceId": "device_9pbfi64gl", "sessionId": "session_1761193887266", "timestamp": 1761193887266}', 0, '2025-10-22 21:31:27', '2025-10-22 21:31:27', '2025-10-22 21:31:27'),
	(12, 'device_de0i44ls1', '{"type": "whatsapp_web_binding", "deviceId": "device_de0i44ls1", "sessionId": "session_1761193958291", "timestamp": 1761193958291}', 0, '2025-10-22 21:32:38', '2025-10-22 21:32:38', '2025-10-22 21:32:38'),
	(13, 'device_s0ex4c7oh', '{"type": "whatsapp_web_binding", "deviceId": "device_s0ex4c7oh", "sessionId": "session_1761193959010", "timestamp": 1761193959010}', 0, '2025-10-22 21:32:39', '2025-10-22 21:32:39', '2025-10-22 21:32:39'),
	(14, 'device_79qrxkgiz', '{"type": "whatsapp_web_binding", "deviceId": "device_79qrxkgiz", "sessionId": "session_1761193959641", "timestamp": 1761193959641}', 0, '2025-10-22 21:32:39', '2025-10-22 21:32:39', '2025-10-22 21:32:39'),
	(15, 'device_5jmqkmawh', '{"type": "whatsapp_web_binding", "deviceId": "device_5jmqkmawh", "sessionId": "session_1761193960091", "timestamp": 1761193960091}', 0, '2025-10-22 21:32:40', '2025-10-22 21:32:40', '2025-10-22 21:32:40'),
	(16, 'device_1lt3g8wgo', '{"type": "whatsapp_web_binding", "deviceId": "device_1lt3g8wgo", "sessionId": "session_1761193990553", "timestamp": 1761193990553}', 0, '2025-10-22 21:33:10', '2025-10-22 21:33:10', '2025-10-22 21:33:10'),
	(17, 'device_04m3j8jsn', '{"type": "whatsapp_web_binding", "deviceId": "device_04m3j8jsn", "sessionId": "session_1761289243431", "timestamp": 1761289243431}', 0, '2025-10-24 00:00:43', '2025-10-24 00:00:43', '2025-10-24 00:00:43'),
	(18, 'device_pvbb7pr5m', '{"type": "whatsapp_web_binding", "deviceId": "device_pvbb7pr5m", "sessionId": "session_1761289279133", "timestamp": 1761289279133}', 0, '2025-10-24 00:01:19', '2025-10-24 00:01:19', '2025-10-24 00:01:19'),
	(19, 'device_qbmgz8g7j', '{"type": "whatsapp_web_binding", "deviceId": "device_qbmgz8g7j", "sessionId": "session_1761289281632", "timestamp": 1761289281632}', 0, '2025-10-24 00:01:21', '2025-10-24 00:01:21', '2025-10-24 00:01:21'),
	(20, 'device_iqs7nopnh', '{"type": "whatsapp_web_binding", "deviceId": "device_iqs7nopnh", "sessionId": "session_1761289284671", "timestamp": 1761289284671}', 0, '2025-10-24 00:01:24', '2025-10-24 00:01:24', '2025-10-24 00:01:24'),
	(21, 'device_z1kmms5ma', '{"type": "whatsapp_web_binding", "deviceId": "device_z1kmms5ma", "sessionId": "session_1761289285309", "timestamp": 1761289285309}', 0, '2025-10-24 00:01:25', '2025-10-24 00:01:25', '2025-10-24 00:01:25'),
	(22, 'device_9sksm8uyt', '{"type": "whatsapp_web_binding", "deviceId": "device_9sksm8uyt", "sessionId": "session_1761289286000", "timestamp": 1761289286000}', 0, '2025-10-24 00:01:26', '2025-10-24 00:01:26', '2025-10-24 00:01:26'),
	(23, 'device_zx9jgdz6e', '{"type": "whatsapp_web_binding", "deviceId": "device_zx9jgdz6e", "sessionId": "session_1761289289230", "timestamp": 1761289289230}', 0, '2025-10-24 00:01:29', '2025-10-24 00:01:29', '2025-10-24 00:01:29'),
	(24, 'device_v8i6edtnl', '{"type": "whatsapp_web_binding", "deviceId": "device_v8i6edtnl", "sessionId": "session_1761289289960", "timestamp": 1761289289960}', 0, '2025-10-24 00:01:29', '2025-10-24 00:01:29', '2025-10-24 00:01:29'),
	(25, 'device_bmhazu9fq', '{"type": "whatsapp_web_binding", "deviceId": "device_bmhazu9fq", "sessionId": "session_1761289293767", "timestamp": 1761289293767}', 0, '2025-10-24 00:01:33', '2025-10-24 00:01:33', '2025-10-24 00:01:33'),
	(26, 'device_5dmmkcxwd', '{"type": "whatsapp_web_binding", "deviceId": "device_5dmmkcxwd", "sessionId": "session_1761289293810", "timestamp": 1761289293811}', 0, '2025-10-24 00:01:33', '2025-10-24 00:01:33', '2025-10-24 00:01:33'),
	(27, 'device_8f1q1a5tm', '{"type": "whatsapp_web_binding", "deviceId": "device_8f1q1a5tm", "sessionId": "session_1761289294718", "timestamp": 1761289294718}', 0, '2025-10-24 00:01:34', '2025-10-24 00:01:34', '2025-10-24 00:01:34'),
	(28, 'device_v037kjc39', '{"type": "whatsapp_web_binding", "deviceId": "device_v037kjc39", "sessionId": "session_1761289294764", "timestamp": 1761289294764}', 0, '2025-10-24 00:01:34', '2025-10-24 00:01:34', '2025-10-24 00:01:34'),
	(29, 'device_rjnmkijbe', '{"type": "whatsapp_web_binding", "deviceId": "device_rjnmkijbe", "sessionId": "session_1761289545861", "timestamp": 1761289545861}', 0, '2025-10-24 00:05:46', '2025-10-24 00:05:46', '2025-10-24 00:05:46'),
	(30, 'device_m317htvq7', '{"type": "whatsapp_web_binding", "deviceId": "device_m317htvq7", "sessionId": "session_1761289621616", "timestamp": 1761289621616}', 0, '2025-10-24 00:07:01', '2025-10-24 00:07:01', '2025-10-24 00:07:01'),
	(31, 'device_b5bwnev5h', '{"type": "whatsapp_web_binding", "deviceId": "device_b5bwnev5h", "sessionId": "session_1761289640239", "timestamp": 1761289640239}', 0, '2025-10-24 00:07:20', '2025-10-24 00:07:20', '2025-10-24 00:07:20'),
	(32, 'device_v6pe3opab', '{"type": "whatsapp_web_binding", "deviceId": "device_v6pe3opab", "sessionId": "session_1761289640975", "timestamp": 1761289640975}', 0, '2025-10-24 00:07:21', '2025-10-24 00:07:21', '2025-10-24 00:07:21'),
	(33, 'device_tpvab50wf', '{"type": "whatsapp_web_binding", "deviceId": "device_tpvab50wf", "sessionId": "session_1761289641510", "timestamp": 1761289641510}', 0, '2025-10-24 00:07:21', '2025-10-24 00:07:21', '2025-10-24 00:07:21'),
	(34, 'device_ur8mndotz', '{"type": "whatsapp_web_binding", "deviceId": "device_ur8mndotz", "sessionId": "session_1761289642023", "timestamp": 1761289642023}', 0, '2025-10-24 00:07:22', '2025-10-24 00:07:22', '2025-10-24 00:07:22'),
	(35, 'device_6t8i43cjc', '{"type": "whatsapp_web_binding", "deviceId": "device_6t8i43cjc", "sessionId": "session_1761289642966", "timestamp": 1761289642966}', 0, '2025-10-24 00:07:22', '2025-10-24 00:07:22', '2025-10-24 00:07:22'),
	(36, 'device_j6vdcd45p', '{"type": "whatsapp_web_binding", "deviceId": "device_j6vdcd45p", "sessionId": "session_1761289646069", "timestamp": 1761289646069}', 0, '2025-10-24 00:07:26', '2025-10-24 00:07:26', '2025-10-24 00:07:26'),
	(37, 'device_adeu0kkny', '{"type": "whatsapp_web_binding", "deviceId": "device_adeu0kkny", "sessionId": "session_1761289646357", "timestamp": 1761289646357}', 0, '2025-10-24 00:07:26', '2025-10-24 00:07:26', '2025-10-24 00:07:26'),
	(38, 'device_x21echkjm', '{"type": "whatsapp_web_binding", "deviceId": "device_x21echkjm", "sessionId": "session_1761289646791", "timestamp": 1761289646791}', 0, '2025-10-24 00:07:26', '2025-10-24 00:07:26', '2025-10-24 00:07:26');

-- Dumping structure for trigger billing.trg_telegram_update_stats_after_log
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `trg_telegram_update_stats_after_log` AFTER INSERT ON `telegram_chat_logs` FOR EACH ROW BEGIN
    INSERT INTO telegram_bot_statistics (
        date, total_messages, total_commands, successful_sends, failed_sends
    ) VALUES (
        DATE(NEW.created_at),
        1,
        CASE WHEN NEW.message_type = 'command' THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_success = 1 THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_success = 0 THEN 1 ELSE 0 END
    )
    ON DUPLICATE KEY UPDATE
        total_messages = total_messages + 1,
        total_commands = total_commands + CASE WHEN NEW.message_type = 'command' THEN 1 ELSE 0 END,
        successful_sends = successful_sends + CASE WHEN NEW.is_success = 1 THEN 1 ELSE 0 END,
        failed_sends = failed_sends + CASE WHEN NEW.is_success = 0 THEN 1 ELSE 0 END;
        
    -- Update user's last active time
    UPDATE telegram_users 
    SET last_active_at = NEW.created_at
    WHERE id = NEW.user_id;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `v_active_incidents`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_active_incidents` AS select `si`.`id` AS `incident_id`,`si`.`customer_id` AS `customer_id`,`c`.`name` AS `customer_name`,`c`.`area` AS `area`,coalesce(`c`.`odc_location`,'') AS `odc_location`,`si`.`service_type` AS `service_type`,`si`.`start_time` AS `start_time`,`si`.`duration_minutes` AS `duration_minutes`,`si`.`incident_type` AS `incident_type`,`si`.`status` AS `status`,NULL AS `technician_name`,NULL AS `technician_chat_id`,`si`.`alert_sent_telegram` AS `alert_sent_telegram`,`si`.`alert_sent_whatsapp` AS `alert_sent_whatsapp` from (`sla_incidents` `si` join `customers` `c` on((`si`.`customer_id` = `c`.`id`))) where (`si`.`status` = 'ongoing') order by `si`.`duration_minutes` desc,`si`.`start_time`;

-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `v_active_prepaid_customers`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_active_prepaid_customers` AS select `c`.`id` AS `id`,`c`.`customer_code` AS `customer_code`,`c`.`name` AS `name`,`c`.`phone` AS `phone`,`c`.`billing_mode` AS `billing_mode`,`c`.`status` AS `status`,`pps`.`id` AS `subscription_id`,`pp`.`name` AS `package_name`,`pps`.`activation_date` AS `activation_date`,`pps`.`expiry_date` AS `expiry_date`,(to_days(`pps`.`expiry_date`) - to_days(now())) AS `days_remaining`,`pps`.`purchase_price` AS `purchase_price`,`sp`.`download_mbps` AS `download_mbps`,`sp`.`upload_mbps` AS `upload_mbps` from (((`customers` `c` join `prepaid_package_subscriptions` `pps` on((`c`.`id` = `pps`.`customer_id`))) join `prepaid_packages` `pp` on((`pps`.`package_id` = `pp`.`id`))) left join `speed_profiles` `sp` on((`pp`.`speed_profile_id` = `sp`.`id`))) where ((`c`.`billing_mode` = 'prepaid') and (`pps`.`status` = 'active') and (`pps`.`expiry_date` > now()));

-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `v_current_connection_status`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_current_connection_status` AS select `c`.`id` AS `customer_id`,`c`.`name` AS `customer_name`,`c`.`area` AS `area`,`c`.`connection_type` AS `connection_type`,`c`.`pppoe_username` AS `username`,coalesce(`sips`.`status`,(select `connection_logs`.`status` from `connection_logs` where (`connection_logs`.`customer_id` = `c`.`id`) order by `connection_logs`.`timestamp` desc limit 1),'unknown') AS `current_status`,`sips`.`response_time_ms` AS `ping_ms`,(select count(0) from `sla_incidents` where ((`sla_incidents`.`customer_id` = `c`.`id`) and (`sla_incidents`.`status` = 'ongoing'))) AS `active_incidents` from (`customers` `c` left join `static_ip_ping_status` `sips` on((`c`.`id` = `sips`.`customer_id`)));

-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `v_expiring_soon_customers`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_expiring_soon_customers` AS select `c`.`id` AS `id`,`c`.`customer_code` AS `customer_code`,`c`.`name` AS `name`,`c`.`phone` AS `phone`,`pps`.`expiry_date` AS `expiry_date`,(to_days(`pps`.`expiry_date`) - to_days(now())) AS `days_remaining`,`pp`.`name` AS `package_name`,`pps`.`purchase_price` AS `purchase_price` from ((`customers` `c` join `prepaid_package_subscriptions` `pps` on((`c`.`id` = `pps`.`customer_id`))) join `prepaid_packages` `pp` on((`pps`.`package_id` = `pp`.`id`))) where ((`c`.`billing_mode` = 'prepaid') and (`pps`.`status` = 'active') and (`pps`.`expiry_date` between now() and (now() + interval 7 day)));

-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `v_monthly_sla_summary`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_monthly_sla_summary` AS select `sr`.`month_year` AS `month_year`,count(distinct `sr`.`customer_id`) AS `total_customers`,sum((case when (`sr`.`sla_status` = 'met') then 1 else 0 end)) AS `customers_met_sla`,sum((case when (`sr`.`sla_status` = 'breach') then 1 else 0 end)) AS `customers_breach_sla`,round(avg(`sr`.`sla_percentage`),2) AS `avg_sla_percentage`,sum(`sr`.`incident_count`) AS `total_incidents`,sum(`sr`.`downtime_minutes`) AS `total_downtime_minutes`,sum(`sr`.`discount_amount`) AS `total_discount_amount` from `sla_records` `sr` group by `sr`.`month_year` order by `sr`.`month_year` desc;

-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `v_telegram_daily_stats`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_telegram_daily_stats` AS select cast(`telegram_chat_logs`.`created_at` as date) AS `date`,count(0) AS `total_messages`,count((case when (`telegram_chat_logs`.`message_type` = 'command') then 1 end)) AS `total_commands`,count((case when (`telegram_chat_logs`.`is_success` = 1) then 1 end)) AS `successful_messages`,count((case when (`telegram_chat_logs`.`is_success` = 0) then 1 end)) AS `failed_messages`,count(distinct `telegram_chat_logs`.`user_id`) AS `active_users` from `telegram_chat_logs` group by cast(`telegram_chat_logs`.`created_at` as date) order by `date` desc;

-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `v_telegram_technician_performance`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_telegram_technician_performance` AS select `tu`.`id` AS `id`,`tu`.`telegram_username` AS `telegram_username`,`tu`.`first_name` AS `first_name`,json_unquote(json_extract(`tu`.`area_coverage`,'$')) AS `areas`,count(distinct `tia`.`id`) AS `total_assignments`,count(distinct (case when (`tia`.`status` = 'completed') then `tia`.`id` end)) AS `completed_assignments`,count(distinct (case when (`tia`.`status` = 'working') then `tia`.`id` end)) AS `ongoing_assignments`,avg(timestampdiff(MINUTE,`tia`.`assigned_at`,`tia`.`completed_at`)) AS `avg_completion_minutes` from (`telegram_users` `tu` left join `telegram_incident_assignments` `tia` on((`tu`.`id` = `tia`.`technician_user_id`))) where ((`tu`.`role` = 'teknisi') and (`tu`.`is_active` = 1)) group by `tu`.`id`;

-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `v_telegram_users_active`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_telegram_users_active` AS select `tu`.`id` AS `id`,`tu`.`telegram_chat_id` AS `telegram_chat_id`,`tu`.`telegram_username` AS `telegram_username`,`tu`.`first_name` AS `first_name`,`tu`.`role` AS `role`,`tu`.`area_coverage` AS `area_coverage`,`tu`.`registered_at` AS `registered_at`,`tu`.`last_active_at` AS `last_active_at`,count(distinct `tcl`.`id`) AS `total_messages`,count(distinct (case when (`tcl`.`message_type` = 'command') then `tcl`.`id` end)) AS `total_commands` from (`telegram_users` `tu` left join `telegram_chat_logs` `tcl` on((`tu`.`id` = `tcl`.`user_id`))) where (`tu`.`is_active` = 1) group by `tu`.`id`;

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
