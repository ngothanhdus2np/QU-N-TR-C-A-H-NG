#!/usr/bin/env node

// Simple script to show QR code for current dev server
const qrcode = require('qrcode-terminal');
const os = require('os');

// Get local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();
const port = 3000;
const url = `http://${localIP}:${port}`;

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║                                                        ║');
console.log('║           📱 CFO BRAIN - QR CODE                       ║');
console.log('║                                                        ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

console.log('🌐 URL: ' + url + '\n');
console.log('📱 Quét QR Code bằng camera điện thoại:\n');

qrcode.generate(url, { small: true });

console.log('\n💡 Lưu ý:');
console.log('   • Điện thoại phải cùng WiFi với máy tính');
console.log('   • Dev server phải đang chạy (npm run dev)');
console.log('   • Nếu không vào được, thử: http://localhost:3000\n');
