#!/usr/bin/env node

/**
 * Development server with QR code for mobile testing
 * Usage: npm run dev:mobile
 */

import { spawn } from 'child_process';
import qrcode from 'qrcode-terminal';
import chalk from 'chalk';
import os from 'os';

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Display banner
function displayBanner(localIP, port) {
  console.clear();
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                                                        ║'));
  console.log(chalk.bold.cyan('║           ') + chalk.bold.white('CFO BRAIN 4.0 - DEV SERVER') + chalk.bold.cyan('              ║'));
  console.log(chalk.bold.cyan('║                                                        ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.bold.green('✅ Server đang chạy!\n'));

  // Local URLs
  console.log(chalk.bold('📍 Local URLs:'));
  console.log(chalk.gray('   ├─ ') + chalk.cyan(`http://localhost:${port}`));
  console.log(chalk.gray('   └─ ') + chalk.cyan(`http://127.0.0.1:${port}\n`));

  // Network URLs
  console.log(chalk.bold('🌐 Network URLs (dùng trên cùng WiFi):'));
  console.log(chalk.gray('   └─ ') + chalk.yellow(`http://${localIP}:${port}\n`));

  // QR Code
  console.log(chalk.bold('📱 Quét QR Code để mở trên điện thoại:\n'));
  qrcode.generate(`http://${localIP}:${port}`, { small: true }, (qr) => {
    console.log(qr);
  });

  console.log(chalk.bold.yellow('\n⚠️  Lưu ý:'));
  console.log(chalk.gray('   • Điện thoại phải cùng WiFi với máy tính'));
  console.log(chalk.gray('   • PWA chỉ hoạt động trên HTTPS hoặc localhost'));
  console.log(chalk.gray('   • Để test PWA đầy đủ, dùng: npm run dev:tunnel\n'));

  console.log(chalk.bold.green('🚀 Sẵn sàng phát triển!\n'));
  console.log(chalk.gray('─'.repeat(60)));
}

// Main
async function main() {
  const PORT = process.env.PORT || 3000;
  const localIP = getLocalIP();

  // Display banner
  displayBanner(localIP, PORT);

  // Start dev server
  console.log(chalk.gray('\n📦 Starting development server...\n'));

  const devServer = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
  });

  devServer.on('error', (error) => {
    console.error(chalk.red('❌ Failed to start dev server:'), error);
    process.exit(1);
  });

  devServer.on('close', (code) => {
    if (code !== 0) {
      console.error(chalk.red(`❌ Dev server exited with code ${code}`));
    }
    process.exit(code);
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Stopping dev server...'));
    devServer.kill();
    process.exit(0);
  });
}

main();
