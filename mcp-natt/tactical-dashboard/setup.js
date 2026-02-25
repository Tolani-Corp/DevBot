// setup.js — One-time setup for NATT Tactical Dashboard

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n████████  NATT TACTICAL DASHBOARD SETUP  ████████');
console.log('Checking environment...\n');

// Check Node version
const nodeVersion = process.version;
const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
if (major < 18) {
  console.error(`✗ Node.js 18+ required. Found: ${nodeVersion}`);
  process.exit(1);
}
console.log(`✓ Node.js ${nodeVersion}`);

// Check dist
const distPath = resolve(__dirname, '../dist/index.js');
if (!existsSync(distPath)) {
  console.warn('\n⚠  NATT MCP server not built yet.');
  console.warn('   Run: cd .. && npm run build');
  console.warn('   Then re-run this setup.\n');
} else {
  console.log('✓ NATT MCP dist found');
}

// Create memory dir
const memDir = resolve(__dirname, '../.natt-memory');
if (!existsSync(memDir)) {
  mkdirSync(memDir, { recursive: true });
  console.log('✓ Created .natt-memory directory');
} else {
  console.log('✓ .natt-memory directory exists');
}

// Install dependencies
console.log('\nInstalling dashboard dependencies...');
try {
  execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
  console.log('✓ Dependencies installed');
} catch (err) {
  console.error('✗ npm install failed:', err.message);
  process.exit(1);
}

console.log('\n████████  SETUP COMPLETE  ████████');
console.log('\nTo start the dashboard:');
console.log('  npm start\n');
console.log('Then open a browser and navigate to:');
console.log('  http://localhost:7474\n');
