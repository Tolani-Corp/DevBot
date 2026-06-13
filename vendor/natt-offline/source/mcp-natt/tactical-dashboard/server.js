// server.js — NATT Tactical Dashboard Server
// Lightweight Express API for edge/survival installs

import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT ?? '7474', 10);
const MEMORY_DIR = resolve(__dirname, '../.natt-memory');
const VAULT_FILE = join(MEMORY_DIR, 'password-vault.json');
const AAR_FILE = join(MEMORY_DIR, 'aar-history.json');
const WEIGHTS_FILE = join(MEMORY_DIR, 'algorithm-weights.json');
const FEEDBACK_FILE = join(MEMORY_DIR, 'feedback-log.json');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ── Utilities ──────────────────────────────────────────────────

function safeReadJson(filePath, fallback = []) {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function getCpuTemp() {
  try {
    // Linux (Raspberry Pi)
    const temp = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8');
    return (parseInt(temp.trim(), 10) / 1000).toFixed(1) + '°C';
  } catch {
    return 'N/A';
  }
}

function getNetworkInterfaces() {
  const ifaces = os.networkInterfaces();
  const results = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of (addrs ?? [])) {
      if (!addr.internal && addr.family === 'IPv4') {
        results.push({ name, address: addr.address });
      }
    }
  }
  return results;
}

function getSystemStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: Math.floor(os.uptime()),
    cpuTemp: getCpuTemp(),
    memory: {
      totalMB: Math.round(totalMem / 1024 / 1024),
      usedMB: Math.round(usedMem / 1024 / 1024),
      freeMB: Math.round(freeMem / 1024 / 1024),
      percent: Math.round((usedMem / totalMem) * 100),
    },
    load: os.loadavg(),
    network: getNetworkInterfaces(),
    timestamp: new Date().toISOString(),
  };
}

// ── Routes ─────────────────────────────────────────────────────

// System health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ...getSystemStats() });
});

// Password vault
app.get('/api/vault', (req, res) => {
  const vault = safeReadJson(VAULT_FILE, []);
  const sorted = vault.sort((a, b) => b.successCount - a.successCount).slice(0, 20);
  res.json(sorted);
});

// AAR history
app.get('/api/aar', (req, res) => {
  const history = safeReadJson(AAR_FILE, []);
  res.json(history.slice(-10).reverse());
});

// Algorithm weights
app.get('/api/weights', (req, res) => {
  const weights = safeReadJson(WEIGHTS_FILE, {});
  res.json(weights);
});

// Submit feedback for CLLM improvement
app.post('/api/feedback', async (req, res) => {
  try {
    await mkdir(MEMORY_DIR, { recursive: true });
    const log = safeReadJson(FEEDBACK_FILE, []);
    const entry = {
      id: `fb-${Date.now()}`,
      type: req.body.type ?? 'unknown',
      taskId: req.body.taskId ?? null,
      comment: req.body.comment ?? null,
      rating: req.body.rating ?? null,
      timestamp: new Date().toISOString(),
    };
    log.push(entry);
    await writeFile(FEEDBACK_FILE, JSON.stringify(log, null, 2));
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PANIC — wipe all memory files
app.post('/api/panic', async (req, res) => {
  try {
    const confirm = req.body.confirm;
    if (confirm !== 'WIPE') {
      return res.status(400).json({ ok: false, error: 'Send { confirm: "WIPE" } to confirm.' });
    }
    if (existsSync(MEMORY_DIR)) {
      const files = readdirSync(MEMORY_DIR);
      for (const file of files) {
        rmSync(join(MEMORY_DIR, file), { force: true });
      }
    }
    res.json({ ok: true, message: 'Memory wiped.', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Dynamic tool runner — POST /api/tool/:name
app.post('/api/tool/:name', async (req, res) => {
  const { name } = req.params;
  const safePattern = /^[a-z0-9_]+$/;
  if (!safePattern.test(name)) {
    return res.status(400).json({ ok: false, error: 'Invalid tool name.' });
  }
  try {
    const handlerPath = resolve(__dirname, `../dist/handlers/${name}.js`);
    if (!existsSync(handlerPath)) {
      return res.status(404).json({ ok: false, error: `Tool '${name}' not found. Run npm run build-natt first.` });
    }
    const handler = await import(handlerPath);
    const result = await handler.handle(req.body ?? {});
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  const interfaces = getNetworkInterfaces();
  console.log('\n┌─────────────────────────────────────────────────────┐');
  console.log('│         NATT TACTICAL DASHBOARD — ONLINE            │');
  console.log('├─────────────────────────────────────────────────────┤');
  console.log(`│  Local:    http://localhost:${PORT}                    │`);
  for (const iface of interfaces) {
    const url = `http://${iface.address}:${PORT}`;
    const padded = url.padEnd(44);
    console.log(`│  ${iface.name}: ${padded}│`);
  }
  console.log('│                                                     │');
  console.log('│  Ctrl+C to shut down. Panic: POST /api/panic        │');
  console.log('└─────────────────────────────────────────────────────┘\n');
});

export default app;
