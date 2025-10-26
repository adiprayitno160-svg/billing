# 🔧 Troubleshooting Guide

Panduan mengatasi masalah umum pada Billing System.

---

## 📋 Table of Contents

- [Application Issues](#-application-issues)
- [Database Issues](#-database-issues)
- [MikroTik Integration](#-mikrotik-integration)
- [Payment Gateway](#-payment-gateway)
- [Performance Issues](#-performance-issues)
- [Error Messages](#-error-messages)

---

## 🚀 Application Issues

### Application Won't Start

**Symptoms:**
```
PM2 shows "errored" or "stopped" status
```

**Diagnosis:**
```bash
# Check PM2 status
pm2 status

# Check error logs
pm2 logs billing-system --err --lines 50
```

**Common Causes & Solutions:**

#### 1. Port Already in Use

```bash
# Check what's using port 3000
sudo netstat -tulpn | grep 3000

# Or
sudo lsof -i :3000

# Kill the process
sudo kill -9 PID

# Or change port in .env
PORT=3001
```

#### 2. Missing Environment Variables

```bash
# Check .env file exists
ls -la .env

# Check required variables
cat .env | grep DB_HOST
cat .env | grep DB_USER
cat .env | grep SESSION_SECRET

# If missing, copy from example
cp .env.example .env
nano .env
```

#### 3. Missing node_modules

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --production
```

#### 4. Missing dist folder

```bash
# Rebuild application
npm run build

# Check dist exists
ls -la dist/
```

### Application Crashes Repeatedly

**Symptoms:**
```
PM2 shows high restart count
Application restarts every few seconds
```

**Diagnosis:**
```bash
# Watch logs in real-time
pm2 logs billing-system

# Check restart count
pm2 status
# If restart > 10, there's a problem
```

**Common Causes & Solutions:**

#### 1. Database Connection Error

```bash
# Test database connection
mysql -u DB_USER -p DB_PASSWORD DB_NAME -e "SELECT 1;"

# Check .env database settings
cat .env | grep DB_

# Fix connection and restart
pm2 restart billing-system
```

#### 2. Memory Leak

```bash
# Check memory usage
pm2 monit

# If memory keeps growing:
# 1. Update to latest version
# 2. Set max memory restart
pm2 start dist/server.js --name billing-system --max-memory-restart 500M

# 3. Check for memory leaks in logs
pm2 logs | grep "heap"
```

#### 3. Uncaught Exception

```bash
# Check error logs
pm2 logs billing-system --err

# Common errors:
# - Unhandled promise rejection
# - Type errors
# - Reference errors

# Update to latest version
git pull origin main
npm install
npm run build
pm2 restart billing-system
```

### Cannot Login

**Symptoms:**
```
Login form shows "Invalid credentials"
```

**Solutions:**

#### 1. Check Default Credentials

```
Username: admin
Password: admin123
```

#### 2. Reset Admin Password

```bash
# Connect to database
mysql -u DB_USER -p DB_NAME

# Check admin user exists
SELECT * FROM users WHERE username = 'admin';

# Reset password (password: admin123)
UPDATE users SET password = '$2b$10$abcdefghijklmnopqrstuvwxyz' WHERE username = 'admin';
```

#### 3. Check Session Secret

```bash
# Make sure SESSION_SECRET is set in .env
cat .env | grep SESSION_SECRET

# Generate new if missing
openssl rand -base64 32

# Add to .env
echo "SESSION_SECRET=generated_secret_here" >> .env

# Restart
pm2 restart billing-system
```

### Page Not Loading

**Symptoms:**
```
Browser shows "Cannot connect" or timeout
```

**Diagnosis:**
```bash
# Check application running
pm2 status

# Check port accessible
curl http://localhost:3000

# Check nginx (if used)
sudo systemctl status nginx
sudo nginx -t
```

**Solutions:**

#### 1. Application Not Running

```bash
pm2 start dist/server.js --name billing-system
```

#### 2. Firewall Blocking

```bash
# Ubuntu/Debian
sudo ufw status
sudo ufw allow 3000/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

#### 3. Nginx Not Configured

```bash
# Check nginx config
sudo nano /etc/nginx/sites-available/billing

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

---

## 🗄️ Database Issues

### Cannot Connect to Database

**Error:**
```
Error: Access denied for user 'billing_user'@'localhost' (using password: YES)
```

**Solutions:**

#### 1. Wrong Credentials

```bash
# Test connection manually
mysql -u billing_user -p billing_system

# If fails, check .env
cat .env | grep DB_

# Reset password
mysql -u root -p
> ALTER USER 'billing_user'@'localhost' IDENTIFIED BY 'new_password';
> FLUSH PRIVILEGES;

# Update .env
nano .env
# DB_PASSWORD=new_password
```

#### 2. User Doesn't Exist

```bash
mysql -u root -p << EOF
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON billing_system.* TO 'billing_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

#### 3. Database Doesn't Exist

```bash
mysql -u root -p << EOF
CREATE DATABASE billing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
```

### Database Connection Pool Error

**Error:**
```
Error: Too many connections
```

**Solutions:**

#### 1. Increase MySQL max_connections

```bash
mysql -u root -p
> SET GLOBAL max_connections = 200;
> SHOW VARIABLES LIKE 'max_connections';

# Make permanent in /etc/mysql/my.cnf
[mysqld]
max_connections = 200

# Restart MySQL
sudo systemctl restart mysql
```

#### 2. Close Unused Connections

```bash
mysql -u root -p
> SHOW PROCESSLIST;
> KILL process_id;
```

#### 3. Reduce Connection Pool Size

Edit `src/db/pool.ts`:
```typescript
const pool = mysql.createPool({
  connectionLimit: 10, // Reduce from default
  // ...
});
```

### Slow Database Queries

**Symptoms:**
```
Pages load slowly
High CPU usage on database server
```

**Diagnosis:**
```bash
mysql -u root -p
> SHOW PROCESSLIST;
> SHOW FULL PROCESSLIST;

# Check slow queries
> SHOW VARIABLES LIKE 'slow_query_log';
> SET GLOBAL slow_query_log = 'ON';
```

**Solutions:**

#### 1. Add Missing Indexes

```sql
-- Check tables without indexes
SELECT TABLE_NAME 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'billing_system';

-- Add indexes on frequently queried columns
ALTER TABLE invoices ADD INDEX idx_customer_id (customer_id);
ALTER TABLE invoices ADD INDEX idx_status (status);
ALTER TABLE payments ADD INDEX idx_invoice_id (invoice_id);
```

#### 2. Optimize Tables

```bash
mysql -u root -p billing_system
> OPTIMIZE TABLE customers;
> OPTIMIZE TABLE invoices;
> OPTIMIZE TABLE payments;
```

#### 3. Clear Old Data

```bash
# Backup first!
mysqldump -u root -p billing_system > backup.sql

# Delete old logs
mysql -u root -p billing_system
> DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH);
> DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
```

---

## 🔌 MikroTik Integration

### Cannot Connect to MikroTik

**Error:**
```
Error: Connection timeout to MikroTik
```

**Diagnosis:**
```bash
# Test connectivity
ping MIKROTIK_IP

# Test API port
telnet MIKROTIK_IP 8728

# Or
nc -zv MIKROTIK_IP 8728
```

**Solutions:**

#### 1. API Service Not Enabled

```bash
# On MikroTik
/ip service enable api
/ip service print
```

#### 2. Firewall Blocking

```bash
# On MikroTik
/ip firewall filter print
# Add rule to allow billing server
/ip firewall filter add chain=input src-address=BILLING_SERVER_IP dst-port=8728 protocol=tcp action=accept
```

#### 3. Wrong Credentials

```bash
# Check .env
cat .env | grep MIKROTIK

# Test on MikroTik
/user print
/user add name=billing_api password=secure_password group=full
```

### PPPoE Secret Not Created

**Error:**
```
Failed to create PPPoE secret on MikroTik
```

**Solutions:**

#### 1. Check User Permissions

```bash
# On MikroTik
/user group print detail

# Ensure user has 'write' policy
/user set billing_api group=full
```

#### 2. Profile Doesn't Exist

```bash
# Check profile exists
/ppp profile print

# Create if missing
/ppp profile add name=default local-address=10.10.10.1 remote-address=pppoe-pool
```

#### 3. Username Already Exists

```bash
# Check if username exists
/ppp secret print where name=customer001

# Remove old secret
/ppp secret remove [find name=customer001]
```

### Customer Not Isolated

**Symptoms:**
```
Customer telat bayar tapi masih bisa internet
```

**Diagnosis:**
```bash
# On MikroTik
/ip firewall address-list print where list=isolir

# Check firewall rules
/ip firewall filter print
```

**Solutions:**

#### 1. IP Not Added to Address List

```bash
# Check billing system logs
pm2 logs billing-system | grep isolir

# Manually add to test
/ip firewall address-list add list=isolir address=10.10.10.50 comment="Test"

# Verify
/ip firewall address-list print where list=isolir
```

#### 2. Firewall Rule Missing

```bash
# Add firewall rule
/ip firewall filter add chain=forward src-address-list=isolir action=reject comment="Block Isolir"

# Move to top (important!)
/ip firewall filter move [find comment="Block Isolir"] 0

# Verify
/ip firewall filter print
```

#### 3. Wrong IP Address

```bash
# Check active PPPoE session
/ppp active print

# Verify IP matches in isolir list
/ip firewall address-list print where list=isolir
```

---

## 💳 Payment Gateway

### Payment Not Processed

**Symptoms:**
```
Customer paid but invoice still "Unpaid"
```

**Diagnosis:**
```bash
# Check callback logs
pm2 logs billing-system | grep callback

# Check payment records
mysql -u DB_USER -p DB_NAME
> SELECT * FROM payments WHERE invoice_id = 123;
```

**Solutions:**

#### 1. Callback URL Not Accessible

```bash
# Test callback URL from internet
curl https://yourdomain.com/api/payment/midtrans/callback

# Check nginx
sudo nginx -t

# Check firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

#### 2. Signature Verification Failed

```bash
# Check API keys in .env
cat .env | grep MIDTRANS_SERVER_KEY

# Check logs for signature errors
pm2 logs billing-system | grep signature

# Verify keys match with dashboard
```

#### 3. Webhook Not Configured

```bash
# Check payment gateway dashboard
# Midtrans: Settings → Configuration → Notification URL
# Xendit: Settings → Webhooks
# Tripay: Settings → Callback URL

# Should be: https://yourdomain.com/api/payment/GATEWAY/callback
```

### Payment Method Not Available

**Symptoms:**
```
Payment gateway tidak muncul di halaman bayar
```

**Solutions:**

#### 1. API Keys Not Set

```bash
# Check .env
cat .env | grep MIDTRANS
cat .env | grep XENDIT
cat .env | grep TRIPAY

# Add missing keys
nano .env

# Restart
pm2 restart billing-system
```

#### 2. Gateway Disabled

```bash
# Check database
mysql -u DB_USER -p DB_NAME
> SELECT * FROM payment_gateways WHERE status = 'active';

# Enable gateway
> UPDATE payment_gateways SET status = 'active' WHERE name = 'midtrans';
```

---

## ⚡ Performance Issues

### High Memory Usage

**Symptoms:**
```
PM2 shows high memory usage
Server becomes slow
```

**Diagnosis:**
```bash
# Check memory
pm2 monit

# Check system memory
free -h

# Check processes
top
```

**Solutions:**

#### 1. Restart Application

```bash
pm2 restart billing-system
```

#### 2. Enable Max Memory Restart

```bash
pm2 delete billing-system
pm2 start dist/server.js --name billing-system --max-memory-restart 500M
pm2 save
```

#### 3. Upgrade Server RAM

If memory consistently high, upgrade:
- 2GB → 4GB
- 4GB → 8GB

### High CPU Usage

**Symptoms:**
```
CPU usage always > 80%
Application slow to respond
```

**Diagnosis:**
```bash
# Check CPU
top

# Check application CPU
pm2 monit
```

**Solutions:**

#### 1. Optimize Database Queries

```bash
# Enable slow query log
mysql -u root -p
> SET GLOBAL slow_query_log = 'ON';
> SET GLOBAL long_query_time = 2;

# Check slow queries
> SHOW FULL PROCESSLIST;
```

#### 2. Add Caching

Enable Redis caching for:
- Session data
- Frequent queries
- API responses

#### 3. Use PM2 Cluster Mode

```bash
pm2 delete billing-system
pm2 start dist/server.js --name billing-system -i max
pm2 save
```

### Slow Page Load

**Symptoms:**
```
Pages take > 5 seconds to load
```

**Solutions:**

#### 1. Enable Gzip Compression

```nginx
# In nginx config
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/css text/javascript application/javascript application/json;
```

#### 2. Optimize Static Files

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

#### 3. Use CDN

Upload static assets to CDN:
- Images
- CSS
- JavaScript
- Fonts

---

## ❌ Error Messages

### "MODULE_NOT_FOUND"

**Error:**
```
Error: Cannot find module 'express'
```

**Solution:**
```bash
npm install
npm run build
pm2 restart billing-system
```

### "EADDRINUSE"

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Find and kill process
sudo lsof -i :3000
sudo kill -9 PID

# Or change port
nano .env
# PORT=3001
pm2 restart billing-system
```

### "ECONNREFUSED"

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solution:**
```bash
# Start MySQL
sudo systemctl start mysql

# Check MySQL running
sudo systemctl status mysql

# Test connection
mysql -u root -p
```

### "ER_ACCESS_DENIED_ERROR"

**Error:**
```
Error: Access denied for user 'billing_user'@'localhost'
```

**Solution:**
```bash
# Reset password
mysql -u root -p
> ALTER USER 'billing_user'@'localhost' IDENTIFIED BY 'new_password';
> FLUSH PRIVILEGES;

# Update .env
nano .env
# DB_PASSWORD=new_password
```

### "ER_BAD_DB_ERROR"

**Error:**
```
Error: Unknown database 'billing_system'
```

**Solution:**
```bash
mysql -u root -p
> CREATE DATABASE billing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### "ETIMEDOUT"

**Error:**
```
Error: Connection timeout
```

**Solutions:**

#### 1. Check Network

```bash
ping API_HOST
```

#### 2. Check Firewall

```bash
sudo ufw status
```

#### 3. Increase Timeout

Edit code to increase timeout from 30s to 60s

---

## 🔍 Debugging Tips

### Enable Debug Mode

```bash
# Add to .env
DEBUG=true
LOG_LEVEL=debug

# Restart
pm2 restart billing-system

# View detailed logs
pm2 logs billing-system
```

### Check Application Health

```bash
# Create health check endpoint
curl http://localhost:3000/health

# Should return:
# {"status":"ok","database":"connected","mikrotik":"connected"}
```

### Monitor Real-time

```bash
# Watch logs
pm2 logs billing-system --lines 100

# Monitor resources
pm2 monit

# Watch specific file
tail -f logs/error.log
```

### Test API Endpoints

```bash
# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Test customer list
curl http://localhost:3000/api/customers \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

---

## 📞 Getting Help

### Before Asking for Help

1. ✅ Check this troubleshooting guide
2. ✅ Search existing GitHub issues
3. ✅ Check application logs
4. ✅ Try basic solutions (restart, reinstall)
5. ✅ Gather error messages and logs

### When Reporting Issues

Include:
- **OS & Version**: Ubuntu 22.04
- **Node Version**: v18.19.0
- **Error Message**: Full error text
- **Logs**: Relevant log entries
- **Steps to Reproduce**: What you did before error
- **Expected**: What should happen
- **Actual**: What actually happens

### Contact Support

- 🐛 GitHub Issues: https://github.com/adiprayitno160-svg/billing/issues
- 💬 Discussions: https://github.com/adiprayitno160-svg/billing/discussions
- 📧 Email: support@example.com

---

**Last Updated**: January 26, 2025  
**Version**: 1.0.0

[← Back to Documentation](../README_INSTALLATION.md)

