#!/bin/bash
mysql -u root -padi billing -e "SHOW COLUMNS FROM discounts" 2>/dev/null
echo "---CHECK AMOUNT---"
mysql -u root -padi billing -e "SHOW COLUMNS FROM discounts LIKE 'amount'" 2>/dev/null
echo "---DONE---"
