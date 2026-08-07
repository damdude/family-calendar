#!/usr/bin/env node
/**
 * Reset this dev machine's config back to a brand-new device, so the first-boot
 * flow (mode picker → Wi-Fi → pairing) can be walked through again locally.
 *
 * Only touches data/config.json, and backs it up first. Family data, photos and
 * the database are left alone.
 */

import fs from 'node:fs';
import path from 'node:path';

const CONFIG = path.resolve('data/config.json');
const BACKUP = `${CONFIG}.before-first-boot`;

let config = {};
if (fs.existsSync(CONFIG)) {
	config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
	fs.copyFileSync(CONFIG, BACKUP);
}

config.displayMode = null; // → show the TV / touchscreen picker
config.wifiSkipped = false; // → don't skip the Wi-Fi step
config.setupComplete = false; // → land on /setup instead of the dashboard

fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2));

console.log('Reset to first boot. Open http://localhost:5173');
if (fs.existsSync(BACKUP)) console.log(`Previous config backed up to ${path.basename(BACKUP)}`);
console.log('\nTo also exercise the Wi-Fi step (a laptop is always "online"), run the');
console.log('dev server with:  FC_FORCE_OFFLINE=1 npm run dev');
