#!/usr/bin/env bash
# ─── DevBot / DevTown / NATT — Raspberry Pi 5 Bare-Metal Setup ─────────────────
# OS:   Raspberry Pi OS Bookworm 64-bit (arm64) OR Ubuntu Server 24.04 LTS arm64
# SoC:  BCM2712 / ARM Cortex-A76 quad-core 2.4 GHz
# RAM:  16GB LPDDR4X
#
# Run as root or with sudo:
#   bash setup.sh [--skip-docker] [--skip-postgres] [--skip-redis] [--nvme /dev/nvme0n1]
#
# What this script does:
#   1. System update + essential tools
#   2. Mount NVMe SSD at /mnt/nvme (format if needed)
#   3. Apply kernel / sysctl performance tuning
#   4. Install Node.js 22 (NodeSource arm64 binary)
#   5. Install pnpm via corepack
#   6. Install Redis 7 (system service)
#   7. Install PostgreSQL 16 (pgdg repo)
#   8. Install Docker CE for arm64 (optional)
#   9. Clone and build DevBot
#   10. Clone and build DevTown
#   11. Install systemd services for DevBot + workers
#   12. Configure /boot/firmware/config.txt for Pi 5 performance

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
INSTALL_DOCKER=true
INSTALL_POSTGRES=true
INSTALL_REDIS=true
NVME_DEVICE="/dev/nvme0n1"
DEVBOT_DIR="/opt/devbot"
DEVTOWN_DIR="/opt/devtown"
DEVBOT_USER="devbot"
NODE_VERSION="22"
PG_VERSION="16"
REDIS_VERSION="7"

# ── Parse args ─────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-docker)    INSTALL_DOCKER=false    ;;
    --skip-postgres)  INSTALL_POSTGRES=false  ;;
    --skip-redis)     INSTALL_REDIS=false     ;;
    --nvme)           NVME_DEVICE="$2"; shift ;;
  esac
  shift
done

# ── Color output ───────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓] $1${NC}"; }
warn()  { echo -e "${YELLOW}[!] $1${NC}"; }
error() { echo -e "${RED}[✗] $1${NC}" >&2; exit 1; }

[[ $EUID -ne 0 ]] && error "Run as root: sudo bash setup.sh"

# ── 1. System update ───────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq \
    curl wget git unzip build-essential \
    ca-certificates gnupg lsb-release \
    htop iotop nethogs \
    ufw fail2ban \
    zram-tools \
    python3 python3-pip \
    libssl-dev libffi-dev \
    tzdata \
    # For Playwright arm64 Chromium
    chromium chromium-driver \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libgtk-3-0 libgbm1 libasound2

info "System packages installed."

# ── 2. NVMe setup ─────────────────────────────────────────────────────────────
if [[ -b "${NVME_DEVICE}" ]]; then
  info "Setting up NVMe SSD at ${NVME_DEVICE}..."
  NVME_PART="${NVME_DEVICE}p1"

  if ! blkid "${NVME_PART}" &>/dev/null; then
    warn "Partitioning ${NVME_DEVICE}..."
    parted "${NVME_DEVICE}" --script mklabel gpt mkpart primary ext4 0% 100%
    mkfs.ext4 -F "${NVME_PART}"
    info "NVMe formatted as ext4."
  fi

  mkdir -p /mnt/nvme
  if ! grep -q "/mnt/nvme" /etc/fstab; then
    NVME_UUID=$(blkid -s UUID -o value "${NVME_PART}")
    echo "UUID=${NVME_UUID}  /mnt/nvme  ext4  defaults,noatime,nodiratime  0  2" >> /etc/fstab
    mount /mnt/nvme
    info "NVMe mounted at /mnt/nvme and added to fstab."
  fi

  # Create directory structure
  mkdir -p \
    /mnt/nvme/docker/postgres \
    /mnt/nvme/docker/redis \
    /mnt/nvme/natt/vault \
    /mnt/nvme/natt/cron \
    /mnt/nvme/logs/devbot \
    /mnt/nvme/logs/devtown
else
  warn "NVMe device ${NVME_DEVICE} not found — using SD card. Not recommended for production."
  mkdir -p \
    /mnt/nvme/docker/postgres \
    /mnt/nvme/docker/redis \
    /mnt/nvme/natt/vault \
    /mnt/nvme/natt/cron
fi

# ── 3. Kernel / sysctl tuning ─────────────────────────────────────────────────
info "Applying sysctl performance tuning..."
cat > /etc/sysctl.d/99-devbot.conf << 'EOF'
# DevBot Pi 5 — kernel performance tuning
vm.overcommit_memory   = 1       # Allow Redis fork without OOM kill
vm.swappiness          = 1       # Minimize swap use (prefer RAM on 16GB)
net.core.somaxconn     = 65535   # High connection backlog for Slack webhooks
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog  = 65535
fs.file-max            = 1048576 # Max open file descriptors
net.ipv4.tcp_tw_reuse  = 1
net.ipv4.ip_local_port_range = 1024 65535
EOF
sysctl -p /etc/sysctl.d/99-devbot.conf

# ── zram swap ─────────────────────────────────────────────────────────────────
info "Configuring zram swap (4GB, lz4)..."
echo 'PERCENT=25' >> /etc/default/zramswap
systemctl enable --now zramswap 2>/dev/null || true

# ── 4. Node.js 22 (NodeSource arm64) ──────────────────────────────────────────
info "Installing Node.js ${NODE_VERSION} (arm64)..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
node_version=$(node --version)
info "Node.js installed: ${node_version}"

# ── 5. pnpm ───────────────────────────────────────────────────────────────────
info "Enabling pnpm via corepack..."
corepack enable
corepack prepare pnpm@latest --activate
pnpm_version=$(pnpm --version)
info "pnpm installed: ${pnpm_version}"

# ── 6. Redis 7 ────────────────────────────────────────────────────────────────
if [[ "${INSTALL_REDIS}" == "true" ]]; then
  info "Installing Redis ${REDIS_VERSION}..."
  apt-get install -y redis-server

  # Relocate data to NVMe
  systemctl stop redis-server || true
  sed -i "s|^dir .*|dir /mnt/nvme/docker/redis|" /etc/redis/redis.conf
  chown -R redis:redis /mnt/nvme/docker/redis

  # Apply Pi5-optimized config
  cp "$(dirname "$0")/redis.pi5.conf" /etc/redis/redis.conf

  systemctl enable --now redis-server
  redis-cli ping | grep -q PONG && info "Redis is running." || error "Redis failed to start."
fi

# ── 7. PostgreSQL 16 (pgdg) ───────────────────────────────────────────────────
if [[ "${INSTALL_POSTGRES}" == "true" ]]; then
  info "Installing PostgreSQL ${PG_VERSION}..."
  CODENAME=$(lsb_release -cs)
  echo "deb https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
  apt-get update -qq
  apt-get install -y "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}"

  # Relocate data dir to NVMe
  PG_DATA="/mnt/nvme/docker/postgres"
  PG_CONF="/etc/postgresql/${PG_VERSION}/main"

  systemctl stop postgresql || true

  if [[ ! -f "${PG_DATA}/PG_VERSION" ]]; then
    rm -rf "${PG_DATA}"
    sudo -u postgres "/usr/lib/postgresql/${PG_VERSION}/bin/initdb" \
      -D "${PG_DATA}" --auth-local peer --auth-host scram-sha-256
    info "PostgreSQL data directory initialized at ${PG_DATA}"
  fi

  # Update postgresql.conf to point to NVMe data dir
  sed -i "s|^data_directory = .*|data_directory = '${PG_DATA}'|" "${PG_CONF}/postgresql.conf"

  # Apply Pi5-optimized settings
  cat "$(dirname "$0")/postgresql.pi5.conf" >> "${PG_CONF}/postgresql.conf"

  chown -R postgres:postgres "${PG_DATA}"
  systemctl enable --now postgresql

  # Create devbot role + database
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='devbot'" \
    | grep -q 1 || sudo -u postgres psql -c \
    "CREATE USER devbot WITH PASSWORD 'devbot'; CREATE DATABASE devbot OWNER devbot;"
  sudo -u postgres psql -d devbot -c "GRANT ALL PRIVILEGES ON DATABASE devbot TO devbot;"
  info "PostgreSQL running — user 'devbot' and database 'devbot' created."
fi

# ── 8. Docker CE (optional) ───────────────────────────────────────────────────
if [[ "${INSTALL_DOCKER}" == "true" ]]; then
  info "Installing Docker CE (arm64)..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "${DEVBOT_USER}" 2>/dev/null || true
  systemctl enable --now docker
  docker version | head -3
  info "Docker installed."
fi

# ── 9. DevBot user ────────────────────────────────────────────────────────────
info "Creating devbot system user..."
id -u "${DEVBOT_USER}" &>/dev/null || useradd --system --shell /bin/bash \
    --home "${DEVBOT_DIR}" --create-home "${DEVBOT_USER}"
usermod -aG redis "${DEVBOT_USER}" 2>/dev/null || true

# ── 10. Clone + build DevBot ─────────────────────────────────────────────────
info "Cloning DevBot..."
[[ -d "${DEVBOT_DIR}/.git" ]] || \
  sudo -u "${DEVBOT_USER}" git clone \
    https://github.com/Tolani-Corp/DevBot.git "${DEVBOT_DIR}"

cd "${DEVBOT_DIR}"
sudo -u "${DEVBOT_USER}" git pull --ff-only

info "Installing DevBot dependencies..."
sudo -u "${DEVBOT_USER}" pnpm install --frozen-lockfile

info "Building DevBot..."
sudo -u "${DEVBOT_USER}" pnpm build

# Create .natt dirs
mkdir -p "${DEVBOT_DIR}/.natt/vault" "${DEVBOT_DIR}/.natt/cron"
chown -R "${DEVBOT_USER}:${DEVBOT_USER}" "${DEVBOT_DIR}/.natt"

# Symlink logs to NVMe
ln -sf /mnt/nvme/logs/devbot "${DEVBOT_DIR}/logs" 2>/dev/null || true
chown -R "${DEVBOT_USER}:${DEVBOT_USER}" /mnt/nvme/logs/devbot

info "DevBot built at ${DEVBOT_DIR}"

# ── 11. Clone + build DevTown ─────────────────────────────────────────────────
info "Cloning DevTown..."
[[ -d "${DEVTOWN_DIR}/.git" ]] || \
  sudo -u "${DEVBOT_USER}" git clone \
    https://github.com/Tolani-Corp/DevTown.git "${DEVTOWN_DIR}"

cd "${DEVTOWN_DIR}"
sudo -u "${DEVBOT_USER}" git pull --ff-only
sudo -u "${DEVBOT_USER}" pnpm install --frozen-lockfile
sudo -u "${DEVBOT_USER}" pnpm build
info "DevTown built at ${DEVTOWN_DIR}"

# ── 12. Copy systemd services ─────────────────────────────────────────────────
info "Installing systemd services..."
cp "$(dirname "$0")/devbot.service"      /etc/systemd/system/
cp "$(dirname "$0")/devbot-worker.service" /etc/systemd/system/
cp "$(dirname "$0")/devbot-natt-cron.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable devbot devbot-worker devbot-natt-cron
info "Services enabled. Start with: systemctl start devbot devbot-worker devbot-natt-cron"

# ── 13. Pi 5 /boot/firmware/config.txt performance tuning ────────────────────
BOOT_CONFIG="/boot/firmware/config.txt"
if [[ -f "${BOOT_CONFIG}" ]]; then
  info "Applying Pi 5 boot config tuning..."
  # Only append settings not already present
  grep -q "^gpu_mem=" "${BOOT_CONFIG}"  || echo "gpu_mem=128"      >> "${BOOT_CONFIG}"
  grep -q "^arm_boost=" "${BOOT_CONFIG}" || echo "arm_boost=1"     >> "${BOOT_CONFIG}"
  grep -q "^dtparam=rtc" "${BOOT_CONFIG}" || echo "dtparam=rtc=on" >> "${BOOT_CONFIG}"
  grep -q "^dtparam=i2c_arm" "${BOOT_CONFIG}" || echo "dtparam=i2c_arm=on" >> "${BOOT_CONFIG}"
  grep -q "^hdmi_blanking" "${BOOT_CONFIG}" || echo "hdmi_blanking=1" >> "${BOOT_CONFIG}"
  warn "Reboot required for boot config changes to take effect."
fi

# ── 14. Firewall ─────────────────────────────────────────────────────────────
info "Configuring ufw firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
info "Firewall enabled. Ports: 22, 80, 443."
warn "Redis (6379) and PostgreSQL (5432) are bound to 127.0.0.1 — not exposed externally."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  DevBot + DevTown Pi 5 Setup Complete${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Next steps:"
echo "  1. Copy .env.example → /opt/devbot/.env  and fill in all values"
echo "  2. systemctl start devbot devbot-worker devbot-natt-cron"
echo "  3. journalctl -u devbot -f   # follow logs"
echo ""
echo "  NATT vault:   /mnt/nvme/natt/vault"
echo "  NATT cron:    /mnt/nvme/natt/cron"
echo "  DevBot logs:  /mnt/nvme/logs/devbot"
echo ""
warn "Reboot recommended to apply boot config changes."
echo ""
