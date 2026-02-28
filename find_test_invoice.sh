#!/bin/bash
mysql -u root -padi billing -e "SELECT id, invoice_number, status, total_amount, remaining_amount FROM invoices WHERE status != 'paid' LIMIT 1" 2>/dev/null
