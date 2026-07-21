#!/usr/bin/env node

/**
 * Development server with public tunnel (ngrok/localtunnel) and QR code
 * Usage: npm run dev:tunnel
 */

import { spawn } from 'child_process';
import qrcode from 'qrcode-terminal';
import chalk from 'chalk';

let tunnelUrl = null;
let devServerReady = false;

// Display banner
function displayBanner(url) {
  console.clear();
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                                                        ║'));
  console.log(chalk.bold.cyan('║      ') + chalk.bold.white('CFO BRAIN 4.0 - PUBLIC TUNNEL') + chalk.bold.cyan('             ║'));
  console.log(chalk.bold.cyan('║                                                        ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.bold.green('✅ Tunnel đang chạy!\n'));

  // Public URL
  console.log(chalk.bold('🌍 Public URL (chia sẻ với bất kỳ ai):'));
  console.log(chalk.gray('   └─ ') + chalk.green.bold(url) + '\n');

  // QR Code
  console.log(chalk.bold('📱 Quét QR Code để mở trên điện thoại:\n'));
  qrcode.generate(url, { small: true }, (qr) => {
    console.log(qr);
  });

  console.log(chalk.bold.yellow('\n✨ Ưu điểm:'));
  console.log(chalk.gray('   • Không cần cùng WiFi'));
  console.log(chalk.gray('   • Có HTTPS → PWA hoạt động đầy đủ'));
  console.log(chalk.gray('   • Chia sẻ với bất kỳ ai trên thế giới'));
  console.log(chalk.gray('   • Test trên nhiều thiết bị cùng lúc\n'));

  console.log(chalk.bold.green('🚀 Sẵn sàng test!\n'));
  console.log(chalk.gray('─'.repeat(60)));
}

// Check if localtunnel is installed
async function checkLocaltunnel() {
  return new Promise((resolve) => {
    const check = spawn('npx', ['localtunnel', '--version'], { shell: true });
    check.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// Start localtunnel
async function startTunnel(port) {
  console.log(chalk.gray('\n🌐 Creating public tunnel...\n'));

  const hasLocaltunnel = await checkLocaltunnel();
  
  if (!hasLocaltunnel) {
    console.log(chalk.yellow('📦 Installing localtunnel...'));
  }

  const tunnel = spawn('npx', ['localtunnel', '--port', port], {
    shell: true,
  });

  tunnel.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Extract URL from output
    const urlMatch = output.match(/https:\/\/[^\s]+/);
    if (urlMatch && !tunnelUrl) {
      tunnelUrl = urlMatch[0];
      
      if (devServerReady) {
        displayBanner(tunnelUrl);
      }
    }
  });

  tunnel.stderr.on('data', (data) => {
    const output = data.toString();
    if (!output.includes('your url is')) {
      console.error(chalk.red('Tunnel error:'), output);
    }
  });

  tunnel.on('error', (error) => {
    console.error(chalk.red('❌ Failed to start tunnel:'), error);
    console.log(chalk.yellow('\n💡 Thử cài đặt localtunnel:'));
    console.log(chalk.gray('   npm install -g localtunnel\n'));
    process.exit(1);
  });

  return tunnel;
}

// Main
async function main() {
  const PORT = process.env.PORT || 3000;

  console.log(chalk.bold.cyan('\n🚀 Starting CFO Brain with public tunnel...\n'));

  // Start dev server
  console.log(chalk.gray('📦 Starting development server...\n'));

  const devServer = spawn('npm', ['run', 'dev'], {
    shell: true,
  });

  devServer.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Check if dev server is ready
    if (output.includes('Local:') || output.includes('localhost')) {
      if (!devServerReady) {
        devServerReady = true;
        console.log(chalk.green('✅ Dev server ready!\n'));
        
        if (tunnelUrl) {
          displayBanner(tunnelUrl);
        }
      }
    }
    
    // Show dev server output
    if (!devServerReady) {
      process.stdout.write(chalk.gray(output));
    }
  });

  devServer.stderr.on('data', (data) => {
    if (!devServerReady) {
      process.stderr.write(chalk.gray(data.toString()));
    }
  });

  devServer.on('error', (error) => {
    console.error(chalk.red('❌ Failed to start dev server:'), error);
    process.exit(1);
  });

  // Wait a bit for dev server to start
  setTimeout(async () => {
    const tunnel = await startTunnel(PORT);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n👋 Stopping server and tunnel...'));
      devServer.kill();
      tunnel.kill();
      process.exit(0);
    });
  }, 3000);
}

main();
