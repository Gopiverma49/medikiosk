const { spawn } = require('child_process');
const os = require('os');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

const CACHE_FILE = path.join(__dirname, '.tunnel-info.json');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wireless')) {
          return net.address;
        }
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIpAddress();
const localUrl = `http://${localIp}:3000`;

function saveCache(publicUrl) {
  try {
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify(
        {
          localIp,
          localUrl,
          publicUrl: publicUrl || null,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (_) {}
}

saveCache(null);

console.log('\n' + '='.repeat(68));
console.log('\x1b[1m\x1b[32m%s\x1b[0m', '  🏥 MEDIKIOSK UNIVERSAL MOBILE ACCESS GATEWAY');
console.log('='.repeat(68));
console.log('\x1b[36m%s\x1b[0m', '⚡ Connecting secure mobile tunnel (works on both Wi-Fi and 4G/5G)...');

let tunnelProcess = null;
let currentPublicUrl = null;
let qrRenderedUrl = null;
let reconnectTimer = null;
let healthCheckTimer = null;
let isShuttingDown = false;
let failedHealthChecks = 0;
let providerIndex = 0;

const PROVIDERS = [
  {
    name: 'Serveo.net',
    cmd: 'ssh',
    args: [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=10',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'TCPKeepAlive=yes',
      '-o', 'ExitOnForwardFailure=yes',
      '-R', '80:127.0.0.1:3000',
      'serveo.net',
    ],
    regex: /https:\/\/[a-zA-Z0-9-]+\.serveousercontent\.com/,
  },
  {
    name: 'Localhost.run',
    cmd: 'ssh',
    args: [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=10',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'TCPKeepAlive=yes',
      '-o', 'ExitOnForwardFailure=yes',
      '-R', '80:127.0.0.1:3000',
      'nokey@localhost.run',
    ],
    regex: /https:\/\/[a-zA-Z0-9-]+\.lhr\.life/,
  },
];

function renderUnifiedQr(url, providerName) {
  if (qrRenderedUrl === url) return;
  qrRenderedUrl = url;

  console.log('\n' + '='.repeat(68));
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '  📱 SCAN TO OPEN MEDIKIOSK ON YOUR PHONE');
  console.log('='.repeat(68));
  console.log('\x1b[90m%s\x1b[0m', 'Works on any mobile phone (same Wi-Fi or 4G/5G Mobile Data):\n');

  qrcode.generate(url, { small: true }, (qr) => {
    console.log(qr);
    console.log(`🌐 Universal Mobile Link: \x1b[1m\x1b[36m${url}\x1b[0m`);
    console.log(`📶 Network: \x1b[32mWorks on both Wi-Fi and Mobile Data (4G/5G)\x1b[0m`);
    console.log(`⚡ Keep-Alive: \x1b[32mACTIVE (Auto-reconnecting via ${providerName})\x1b[0m`);
    console.log(`💻 Local LAN URL: \x1b[90m${localUrl}\x1b[0m`);
    console.log('='.repeat(68) + '\n');
  });
}

function startTunnel() {
  if (isShuttingDown) return;
  if (tunnelProcess) {
    try {
      tunnelProcess.kill('SIGINT');
    } catch (_) {}
    tunnelProcess = null;
  }

  const provider = PROVIDERS[providerIndex % PROVIDERS.length];

  try {
    tunnelProcess = spawn(provider.cmd, provider.args);
  } catch (err) {
    console.error(`\x1b[31m[Tunnel] Failed to spawn ${provider.name}: ${err.message}\x1b[0m`);
    scheduleReconnect();
    return;
  }

  let urlDetected = false;

  const handleData = (chunk) => {
    const text = chunk.toString();
    const match = text.match(provider.regex);
    if (match && (!urlDetected || currentPublicUrl !== match[0])) {
      urlDetected = true;
      currentPublicUrl = match[0];
      saveCache(currentPublicUrl);
      failedHealthChecks = 0;

      renderUnifiedQr(currentPublicUrl, provider.name);
    }
  };

  tunnelProcess.stdout.on('data', handleData);
  tunnelProcess.stderr.on('data', handleData);

  tunnelProcess.on('error', (err) => {
    // Suppress verbose ssh errors unless critical
  });

  tunnelProcess.on('close', (code) => {
    if (isShuttingDown) return;
    providerIndex++; // Fallback/alternate provider
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (isShuttingDown || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startTunnel();
  }, 3000);
}

// Active Health Check: Pings the public URL every 35 seconds to ensure traffic forwards properly
clearInterval(healthCheckTimer);
healthCheckTimer = setInterval(() => {
  if (!currentPublicUrl || isShuttingDown) return;

  const client = currentPublicUrl.startsWith('https') ? https : http;
  const req = client.get(currentPublicUrl, { timeout: 8000 }, (res) => {
    if (res.statusCode < 500) {
      failedHealthChecks = 0;
    } else {
      failedHealthChecks++;
    }
  });

  req.on('error', () => {
    failedHealthChecks++;
    if (failedHealthChecks >= 2) {
      failedHealthChecks = 0;
      if (tunnelProcess) {
        try {
          tunnelProcess.kill('SIGINT');
        } catch (_) {}
      }
    }
  });

  req.on('timeout', () => {
    req.destroy();
  });
}, 35000);

startTunnel();

// Clean up child process on exit
const cleanExit = () => {
  isShuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  if (tunnelProcess && !tunnelProcess.killed) {
    try {
      tunnelProcess.kill('SIGINT');
    } catch (_) {}
  }
  process.exit(0);
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
process.on('exit', cleanExit);
