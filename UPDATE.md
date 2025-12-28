# Simple Update Command for ~/billing

# Run this in terminal (you're already in ~/billing):
git fetch --tags && git checkout v2.3.14 && npm install && npm run build && pm2 restart billing-app && pm2 save
