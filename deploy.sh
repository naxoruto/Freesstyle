#!/bin/bash
# ===================================================
# Deploy for DigitalOcean Droplet (no domain needed)
# Usage: ./deploy.sh
# ===================================================
set -e

APP_DIR="/app/freestyle"

# Auto-detect public IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "localhost")

echo "🚀 Deploying Freestyle Arena..."
echo "   Public IP: $PUBLIC_IP"

# ---- 1. Install Docker if needed ----
if ! command -v docker &>/dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "⚠️  Log out and back in for Docker permissions, then re-run this script."
    exit 0
fi

# ---- 2. Clone repo ----
if [ ! -d "$APP_DIR" ]; then
    echo "📥 Cloning repository..."
    git clone https://github.com/axxeler8/freestyle.git "$APP_DIR"
else
    echo "📥 Pulling latest changes..."
    cd "$APP_DIR"
    git pull origin main
fi

cd "$APP_DIR"

# ---- 3. Update nginx to use IP ----
echo "🔧 Configuring nginx for IP: $PUBLIC_IP"
sed -i "s/server_name .*/server_name $PUBLIC_IP;/" nginx.conf

# ---- 4. Create .env if missing ----
if [ ! -f .env ]; then
    DB_PASS=$(openssl rand -hex 16)
    echo "DB_PASSWORD=$DB_PASS" > .env
    echo "✅ Created .env with random DB password"
fi

# ---- 5. Build and start ----
echo "🐳 Building containers..."
WS_URL="http://$PUBLIC_IP/ws" docker compose -f docker-compose.prod.yml build --build-arg NEXT_PUBLIC_WS_URL="http://$PUBLIC_IP/ws"
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "✅ Deploy complete!"
echo "   🌐 App: http://$PUBLIC_IP"
echo "   🔌 WebSocket: http://$PUBLIC_IP/ws"
