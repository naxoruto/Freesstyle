#!/bin/bash
# ===================================================
# Deploy script for DigitalOcean Droplet
# Usage: ./deploy.sh [domain]
# ===================================================
set -e

DOMAIN="${1:-TU_DOMINIO.com}"
APP_DIR="/app/freestyle"

echo "🚀 Deploying Freestyle Arena to $DOMAIN..."

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

# ---- 3. Set domain in nginx config ----
echo "🔧 Configuring domain: $DOMAIN"
sed -i "s/TU_DOMINIO.com/$DOMAIN/g" nginx.conf

# ---- 4. Create .env if missing ----
if [ ! -f .env ]; then
    DB_PASS=$(openssl rand -hex 16)
    echo "DB_PASSWORD=$DB_PASS" > .env
    echo "WS_URL=https://$DOMAIN/ws" >> .env
    echo "✅ Created .env with random DB password"
fi

# ---- 5. Setup cert directories ----
mkdir -p certbot/www certbot/conf

# ---- 6. Build and start ----
echo "🐳 Building and starting containers..."
WS_URL="https://$DOMAIN/ws" docker compose -f docker-compose.prod.yml build --build-arg NEXT_PUBLIC_WS_URL="https://$DOMAIN/ws"
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "✅ Deploy complete!"
echo "   App: http://$DOMAIN"
echo ""
echo "📋 Next steps:"
echo "   1. Point your domain DNS A record to this Droplet's IP"
echo "   2. For HTTPS: uncomment SSL sections in nginx.conf"
echo "   3. Reload nginx: docker compose -f docker-compose.prod.yml exec nginx nginx -s reload"
echo "   4. Get SSL cert with Certbot (install separately or use DigitalOcean's free SSL)"
