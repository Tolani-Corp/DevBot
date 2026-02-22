# DevBot + DevTown + NATT — Raspberry Pi 5 Deployment Guide

> **Platform**: Raspberry Pi 5 (BCM2712 / ARM Cortex-A76 quad-core 2.4 GHz, 16GB LPDDR4X)  
> **OS**: Raspberry Pi OS Bookworm 64-bit **or** Ubuntu Server 24.04 LTS arm64  
> **Architecture**: `linux/arm64` (aarch64)

---

## Hardware Requirements

| Component | Minimum | Recommended |
|---|---|---|
| Board | Raspberry Pi 5 4GB | **Raspberry Pi 5 16GB** |
| Storage | 64GB A2 microSD | **NVMe SSD via HAT+ (1TB M.2 2230)** |
| Power | 15W USB-C | **Official 27W USB-C PSU** |
| Cooling | Heatsink | **Official Active Cooler or Argon NEO 5 BRED** |
| RTC Battery | — | **CR2032 (cron accuracy on power loss)** |

See [pi5-hardware.json](pi5-hardware.json) for full accessory list.

---

## Option A — Docker Compose (Recommended)

No system dependencies other than Docker.

### Prerequisites

```bash
# 1. Install Docker CE for arm64
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Mount NVMe (if using HAT+)
#    See setup.sh for automatic partitioning, or mount manually:
sudo mkfs.ext4 /dev/nvme0n1p1
echo "UUID=$(blkid -s UUID -o value /dev/nvme0n1p1)  /mnt/nvme  ext4  defaults,noatime  0  2" | sudo tee -a /etc/fstab
sudo mount /mnt/nvme

# 3. Create volume directories
sudo mkdir -p /mnt/nvme/docker/{postgres,redis} /mnt/nvme/natt/{vault,cron}
```

### Deploy

```bash
cd /opt
git clone https://github.com/Tolani-Corp/DevBot.git && cd DevBot

# Copy and fill environment file
cp pi5/.env.pi5.example .env
nano .env   # Fill ANTHROPIC_API_KEY, SLACK_BOT_TOKEN, GITHUB_TOKEN, etc.

# Build the arm64 image and start all services
docker compose -f pi5/docker-compose.pi5.yml up -d --build

# Follow logs
docker compose -f pi5/docker-compose.pi5.yml logs -f devbot

# Run DB migrations
docker compose -f pi5/docker-compose.pi5.yml exec devbot node dist/db/migrate.js
```

### Service Architecture (Docker)

```
┌─────────────────────────────────────────────────────────┐
│  Pi 5 (16GB)                                            │
│                                                         │
│  ┌──────────┐   :80/443   ┌─────────┐                  │
│  │  Caddy   │─────────────│ DevBot  │ :3100             │
│  └──────────┘             └────┬────┘                   │
│                                │                         │
│  ┌──────────────┐    ┌─────────┴──────────┐             │
│  │ devbot-worker│    │  devbot-natt-cron  │             │
│  └──────┬───────┘    └─────────┬──────────┘             │
│         │                      │                         │
│  ┌──────┴──────┐      ┌────────┴───────┐                │
│  │  Redis 7    │      │ PostgreSQL 16   │                │
│  │  /mnt/nvme  │      │  /mnt/nvme     │                │
│  └─────────────┘      └────────────────┘                │
│                                                         │
│  /mnt/nvme/natt/vault   → NATT mission vault            │
│  /mnt/nvme/natt/cron    → Cron schedules                │
└─────────────────────────────────────────────────────────┘
```

---

## Option B — Bare Metal (systemd)

Higher performance, lower overhead. Uses approximately 512MB less RAM than Docker.

### Full automated setup

```bash
cd /tmp
git clone https://github.com/Tolani-Corp/DevBot.git devbot-setup
sudo bash devbot-setup/pi5/setup.sh --nvme /dev/nvme0n1
```

The script handles:
- System update + build tools
- NVMe formatting and mounting
- sysctl performance tuning + zram swap
- Node.js 22 (NodeSource arm64 binary)
- pnpm via corepack
- Redis 7 (apt) with NVMe data dir
- PostgreSQL 16 (pgdg repo) with NVMe data dir + Pi5-tuned config
- DevBot + DevTown clone, install, build
- systemd service installation
- ufw firewall rules
- Pi 5 `/boot/firmware/config.txt` tuning

### After setup

```bash
# Fill environment file
sudo cp /opt/devbot/pi5/.env.pi5.example /opt/devbot/.env
sudo nano /opt/devbot/.env   # Fill in all API keys

# Run DB migrations
sudo -u devbot node /opt/devbot/dist/db/migrate.js

# Start all services
sudo systemctl start devbot devbot-worker devbot-natt-cron

# Enable on boot (already done by setup.sh)
sudo systemctl enable devbot devbot-worker devbot-natt-cron

# Check status
sudo systemctl status devbot
sudo journalctl -u devbot -f
```

---

## DevTown Setup

```bash
# After running DevBot setup.sh (Node.js + NVMe already configured)
sudo bash /opt/devbot/pi5/../DevTown/pi5/setup-devtown.sh
# OR from the DevTown directory:
sudo bash /opt/devtown/pi5/setup-devtown.sh
```

---

## NATT Ghost Agent on Pi 5

### Playwright / Chromium

Pi OS arm64 ships Chromium via `apt`. Never use `npx playwright install` on Pi — it has no arm64 Chromium binary.

```bash
# Verify system Chromium
/usr/bin/chromium-browser --version
# → Chromium 130.x.x arm64

# Verify env vars are set in .env:
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
CHROMIUM_FLAGS=--no-sandbox --disable-gpu --disable-dev-shm-usage
```

### NATT Vault (NVMe-backed)

```bash
# All missions archived to NVMe
ls /mnt/nvme/natt/vault/

# NATT cron schedules
cat /mnt/nvme/natt/cron/schedules.json
```

### NATT Cron Tuning

The Pi 5 has an onboard RTC (real-time clock). Enable it for accurate cron scheduling:

```bash
# Enable RTC
echo "dtparam=rtc=on" | sudo tee -a /boot/firmware/config.txt

# Insert CR2032 battery in the onboard battery holder
# Sync clock
sudo hwclock --systohc

# Verify
sudo hwclock --show
```

### Ghost Mode Resource Limits on Pi

See [natt-pi5-runtime.json](natt-pi5-runtime.json) for concurrency limits per ghost mode.

During **active** missions on Pi 5, CPU will reach 2.0–2.4 GHz across 3–4 cores.  
Monitor temperature:

```bash
watch -n 2 "cat /sys/class/thermal/thermal_zone0/temp | awk '{print \$1/1000 \"°C\"}'"
```

If > 75°C: install the Official Active Cooler or reduce `maxConcurrentRequests` to 1.

---

## Performance Tuning Applied

| Setting | Value | Location |
|---|---|---|
| `NODE_OPTIONS` heap | 4096 MB | `.env` |
| PostgreSQL `shared_buffers` | 2 GB | `postgresql.pi5.conf` |
| PostgreSQL `effective_cache_size` | 6 GB | `postgresql.pi5.conf` |
| PostgreSQL `random_page_cost` | 1.1 (NVMe) | `postgresql.pi5.conf` |
| Redis `maxmemory` | 512 MB | `redis.pi5.conf` |
| Redis `appendfsync` | `everysec` | `redis.pi5.conf` |
| Redis lazy freeing | all enabled | `redis.pi5.conf` |
| zram swap | 4 GB (lz4) | `setup.sh` |
| `vm.swappiness` | 1 | `setup.sh` |
| `vm.overcommit_memory` | 1 | `setup.sh` |
| `net.core.somaxconn` | 65535 | `setup.sh` |
| Pi CPU boost | `arm_boost=1` | `/boot/firmware/config.txt` |
| GPU memory | 128 MB | `/boot/firmware/config.txt` |
| RTC | enabled | `/boot/firmware/config.txt` |

---

## File Reference

```
pi5/
  Dockerfile.arm64          → ARM64 multi-stage Docker build
  docker-compose.pi5.yml    → Pi 5 compose stack with NVMe volumes
  setup.sh                  → Bare-metal automated setup script
  Caddyfile                 → Caddy reverse proxy config
  devbot.service            → systemd: DevBot API + Slack bot
  devbot-worker.service     → systemd: BullMQ worker
  devbot-natt-cron.service  → systemd: NATT cron scheduler
  redis.pi5.conf            → Redis 7 Pi5-optimized config
  postgresql.pi5.conf       → PostgreSQL 16 Pi5-optimized settings
  postgres-init.sql         → DB extensions init (pg_stat_statements, uuid-ossp)
  .env.pi5.example          → Environment variable template
  natt-pi5-runtime.json     → NATT Ghost Agent runtime config for Pi 5
  pi5-hardware.json         → Full Pi 5 hardware spec + accessories
  README.md                 → This file
```

---

## Troubleshooting

**Node.js not found after install:**
```bash
source /etc/profile.d/nvm.sh || export PATH=$PATH:/usr/bin
node --version   # Should show v22.x
```

**Playwright / Chromium not launching:**
```bash
chromium-browser --version          # Verify installed
chromium-browser --no-sandbox --headless data:text/html,<h1>test</h1>  # Quick test
```

**Redis won't start:**
```bash
journalctl -u redis-server -n 50
# Common: data dir ownership issue
sudo chown -R redis:redis /mnt/nvme/docker/redis
```

**PostgreSQL fails to start:**
```bash
sudo -u postgres pg_lsclusters
journalctl -u postgresql -n 50
# Common: data dir not initialized on NVMe
sudo systemctl stop postgresql
sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D /mnt/nvme/docker/postgres
sudo systemctl start postgresql
```

**Thermal throttling:**
```bash
vcgencmd measure_temp                    # VideoCore GPU temp
cat /sys/class/thermal/thermal_zone0/temp  # SoC temp (millidegrees)
vcgencmd get_throttled                   # Throttle flags (0x0 = good)
```
