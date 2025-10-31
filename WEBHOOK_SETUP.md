# Setup Auto-Update dari GitHub via Webhook

## Opsi 1: Webhook Otomatis (Recommended)

Aplikasi akan otomatis update setiap kali ada push ke branch `main` di GitHub.

### Setup di Server Production:

1. **Buat file webhook secret:**
```bash
# Di server production
cd /opt/billing
echo "your-super-secret-key-change-this" > .webhook_secret
chmod 600 .webhook_secret
```

2. **Update webhook-update.js dengan secret:**
Edit `webhook-update.js` dan ganti `SECRET` dengan secret key yang sama.

3. **Buat executable auto-update.sh:**
```bash
chmod +x auto-update.sh
```

4. **Start webhook server dengan PM2:**
```bash
cd /opt/billing
WEBHOOK_SECRET=$(cat .webhook_secret) pm2 start webhook-update.js --name webhook-server
pm2 save
```

5. **Setup GitHub Webhook:**
   - Buka repository di GitHub
   - Go to Settings > Webhooks > Add webhook
   - **Payload URL**: `http://your-server-ip:3001/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: (secret key yang sama seperti di .webhook_secret)
   - **Events**: Pilih "Just the push event"
   - Klik "Add webhook"

6. **Test:**
   - Push perubahan ke branch `main`
   - Webhook akan otomatis trigger auto-update
   - Cek log: `pm2 logs webhook-server`

---

## Opsi 2: Cron Job (Periodik Check)

Aplikasi akan check update setiap X menit/jam.

### Setup Cron Job:

```bash
# Edit crontab
crontab -e

# Tambahkan baris ini untuk check setiap 5 menit:
*/5 * * * * /opt/billing/auto-update.sh >> /opt/billing/logs/cron-update.log 2>&1

# Atau setiap jam:
0 * * * * /opt/billing/auto-update.sh >> /opt/billing/logs/cron-update.log 2>&1
```

---

## Opsi 3: Manual Update via Script

Jalankan script manual kapan saja:

```bash
bash /opt/billing/auto-update.sh
```

Atau via SSH dari local:
```bash
npm run deploy:ssh
```

---

## Troubleshooting

### Webhook tidak ter-trigger:
- Pastikan port 3001 terbuka di firewall
- Cek webhook status di GitHub (Settings > Webhooks)
- Cek log: `pm2 logs webhook-server`

### Auto-update gagal:
- Cek log: `/opt/billing/logs/auto-update.log`
- Pastikan permission benar: `chown -R adi:adi /opt/billing`
- Test manual: `bash /opt/billing/auto-update.sh`

