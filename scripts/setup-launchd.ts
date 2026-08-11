#!/usr/bin/env tsx

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const LABEL = 'app.vault-maintenance';
const PROJECT_DIR = join(import.meta.dirname, '..');
const logDir = join(homedir(), 'Library', 'Logs', 'vault-maintenance');

// Get the absolute path to the Node binary currently in use
const nodePath = execSync('which node', { encoding: 'utf-8' }).trim();
const npxPath = execSync('which npx', { encoding: 'utf-8' }).trim();

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${npxPath}</string>
        <string>tsx</string>
        <string>${join(PROJECT_DIR, 'src', 'index.ts')}</string>
        <string>--verbose</string>
        <string>--log-dir</string>
        <string>${logDir}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>/tmp/vault-maintenance.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/vault-maintenance.stderr.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${join(nodePath, '..')}:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>`;

const plistPath = join(
  homedir(),
  'Library',
  'LaunchAgents',
  `${LABEL}.plist`
);

await writeFile(plistPath, plist, 'utf-8');
console.log(`Wrote: ${plistPath}`);
console.log(`\nTo load: launchctl load ${plistPath}`);
console.log(`To start now: launchctl start ${LABEL}`);
console.log(`To unload: launchctl unload ${plistPath}`);
