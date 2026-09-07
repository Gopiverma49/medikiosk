const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

console.log('\x1b[36m%s\x1b[0m', '⚡ Starting Cloudflare Tunnel & generating mobile QR code...');

// Spawn cloudflared tunnel
const isWin = process.platform === 'win32';
const cloudflared = isWin
  ? spawn('npx.cmd cloudflared tunnel --url http://localhost:3000', { shell: true })
  : spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://localhost:3000']);

let qrGenerated = false;

function handleOutput(data) {
  const text = data.toString();

  // Print raw output if QR not generated or in debug
  if (!qrGenerated) {
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      qrGenerated = true;
      const baseUrl = match[0];

      console.log('\n' + '='.repeat(60));
      console.log('\x1b[32m%s\x1b[0m', '✅ CLOUDFLARE TUNNEL ONLINE!');
      console.log('='.repeat(60));
      console.log('\n\x1b[1m\x1b[33m%s\x1b[0m', '📱 SCAN WITH YOUR PHONE CAMERA:');
      console.log('\x1b[90m%s\x1b[0m', '(Opens MediKiosk Home Page)');

      // Generate scannable QR code in terminal
      qrcode.generate(baseUrl, { small: true }, (qr) => {
        console.log(qr);
      });

      console.log('='.repeat(60) + '\n');
    }
  }
}

cloudflared.stdout.on('data', handleOutput);
cloudflared.stderr.on('data', handleOutput);

cloudflared.on('close', (code) => {
  console.log(`Cloudflare tunnel process exited with code ${code}`);
  process.exit(code || 0);
});

// Clean up on process exit
const cleanExit = () => {
  if (cloudflared && !cloudflared.killed) {
    cloudflared.kill('SIGINT');
  }
  process.exit(0);
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
