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

# ---- 4. Create/update .env with correct WS_URL ----
WS_URL="http://$PUBLIC_IP"

if [ -f .env ]; then
    # Preserve existing DB_PASSWORD
    DB_PASS=$(grep DB_PASSWORD .env | cut -d= -f2 || true)
fi

if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -hex 16)
fi

cat > .env <<EOF
DB_PASSWORD=$DB_PASS
WS_URL=$WS_URL
EOF

echo "✅ .env configured: WS_URL=$WS_URL"

# ---- 5. Build containers ONE AT A TIME (1GB RAM can't do parallel) ----
echo "🐳 Building server (1/2)..."
docker compose -f docker-compose.prod.yml build --no-cache server

echo "🐳 Building web (2/2)..."
docker compose -f docker-compose.prod.yml build --no-cache web

echo "🚀 Starting all services..."
docker compose -f docker-compose.prod.yml up -d

# Wait a moment and check container health
echo "⏳ Checking container health..."
sleep 5

echo ""
echo "📋 Container status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "📋 Last 10 lines of web logs:"
docker logs freestyle-web --tail 10 2>&1 || true

echo ""
echo "📋 Last 10 lines of server logs:"
docker logs freestyle-server --tail 10 2>&1 || true

echo ""
echo "✅ Deploy complete!"
echo "   🌐 App: http://$PUBLIC_IP"
echo "   🔌 WebSocket: http://$PUBLIC_IP/socket.io/"
