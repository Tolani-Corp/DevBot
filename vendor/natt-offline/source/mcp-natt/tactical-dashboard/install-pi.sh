#!/usr/bin/env bash
# install-pi.sh — One-shot Raspberry Pi installer for NATT Tactical Dashboard
# Run with: curl -sSL <url>/install-pi.sh | bash
# Or locally: bash install-pi.sh

set -e

NATT_DIR="$HOME/natt"
DASHBOARD_DIR="$NATT_DIR/tactical-dashboard"
SERVICE_FILE="/etc/systemd/system/natt-tactical.service"

echo ""
echo "████████  NATT TACTICAL — PI INSTALLER  ████████"
echo ""

# Check for Node.js 18+
if ! command -v node &>/dev/null; then
  echo "Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Node.js 18+ required. Found: $(node --version)"
  exit 1
fi
echo "✓ Node.js $(node --version)"

# Check for git
if ! command -v git &>/dev/null; then
  echo "Installing git..."
  sudo apt-get install -y git
fi
echo "✓ git $(git --version)"

# Clone or update repo
if [ -d "$NATT_DIR/.git" ]; then
  echo "Updating existing installation..."
  cd "$NATT_DIR"
  git pull
else
  echo "Cloning NATT MCP server..."
  git clone https://github.com/Tolani-Corp/DevBot.git "$HOME/DevBot" || true
  # If repo is local copy, just use current directory
  if [ -f "$(pwd)/mcp-natt/package.json" ]; then
    NATT_DIR="$(pwd)/mcp-natt"
    DASHBOARD_DIR="$NATT_DIR/tactical-dashboard"
  fi
fi

# Build NATT MCP server
echo ""
echo "Building NATT MCP server..."
cd "$NATT_DIR"
npm install
npm run build
echo "✓ NATT MCP built"

# Install dashboard dependencies
echo ""
echo "Installing dashboard dependencies..."
cd "$DASHBOARD_DIR"
npm install
echo "✓ Dashboard dependencies installed"

# Create memory directory
mkdir -p "$NATT_DIR/.natt-memory"
echo "✓ Memory directory created"

# Install systemd service
echo ""
echo "Installing systemd service..."
sed "s|/home/pi/natt|$NATT_DIR|g" "$DASHBOARD_DIR/natt-tactical.service" | sudo tee "$SERVICE_FILE" > /dev/null
sudo systemctl daemon-reload
sudo systemctl enable natt-tactical
sudo systemctl start natt-tactical
echo "✓ Service installed and started"

# Get IP addresses
echo ""
echo "████████  INSTALLATION COMPLETE  ████████"
echo ""
echo "Dashboard is running at:"
echo "  http://localhost:7474"
echo ""
ip route show | grep -E 'src [0-9]+' | awk '{print "  http://"$9":7474"}' | head -5
echo ""
echo "To check status: sudo systemctl status natt-tactical"
echo "To view logs:    sudo journalctl -u natt-tactical -f"
echo ""
