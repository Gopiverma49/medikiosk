const { spawn } = require('child_process');
const os = require('os');
const qrcode = require('qrcode-terminal');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

console.log('\x1b[36m%s\x1b[0m', '⚡ Starting secure mobile tunnel & generating QR code...');

let qrGenerated = false;
let tunnelProcess = null;

function renderSingleQr(url, label) {
  if (qrGenerated) return;
  qrGenerated = true;

  console.log('\n' + '='.repeat(60));
  console.log('\x1b[32m%s\x1b[0m', `✅ MOBILE ACCESS ONLINE (${label})`);
  console.log('='.repeat(60));
  console.log('\n\x1b[1m\x1b[33m%s\x1b[0m', '📱 SCAN WITH YOUR PHONE CAMERA:');
  console.log('\x1b[90m%s\x1b[0m', '(Opens MediKiosk directly on your phone)');

  qrcode.generate(url, { small: true }, (qr) => {
    console.log(qr);
    console.log(`🌐 Public URL: \x1b[1m\x1b[36m${url}\x1b[0m`);
    console.log('='.repeat(60) + '\n');
  });
}

// Start Serveo HTTPS Tunnel (replaces broken trycloudflare.com DNS)
tunnelProcess = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ServerAliveInterval=30',
  '-R', '80:127.0.0.1:3000',
  'serveo.net'
]);

const handleOutput = (data) => {
  const text = data.toString();
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.serveousercontent\.com/);
  if (match) {
    renderSingleQr(match[0], 'Secure HTTPS');
  }
};

tunnelProcess.stdout.on('data', handleOutput);
tunnelProcess.stderr.on('data', handleOutput);

// If tunnel doesn't respond within 5 seconds, fall back to single local Wi-Fi QR
const fallbackTimer = setTimeout(() => {
  if (!qrGenerated) {
    const localIp = getLocalIpAddress();
    renderSingleQr(`http://${localIp}:3000`, 'Local Wi-Fi');
  }
}, 5000);

// Clean up child process on exit
const cleanExit = () => {
  clearTimeout(fallbackTimer);
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill('SIGINT');
  }
  process.exit(0);
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
process.on('exit', cleanExit);
