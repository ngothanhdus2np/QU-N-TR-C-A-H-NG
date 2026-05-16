#!/usr/bin/env node

/**
 * Create Cloudflare tunnel with QR code
 * No confirmation screen, works immediately
 */

import { spawn } from 'child_process';
import qrcode from 'qrcode-terminal';

console.log('\n🚀 Đang tạo Cloudflare tunnel...\n');
console.log('⏳ Vui lòng đợi 5-10 giây...\n');

// Start cloudflared tunnel
const tunnel = spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://localhost:3000'], {
  shell: true,
});

let tunnelUrl = null;

tunnel.stdout.on('data', (data) => {
  const output = data.toString();
  
  // Extract URL from cloudflared output
  const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (urlMatch && !tunnelUrl) {
    tunnelUrl = urlMatch[0];
    
    console.clear();
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║      ✅ TUNNEL THÀNH CÔNG - QUÉT QR NGAY!              ║');
    console.log('║         (Không cần xác nhận IP)                        ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log('🌍 Public URL (có HTTPS):');
    console.log('   ' + tunnelUrl + '\n');
    
    console.log('📱 Quét QR Code (hoạt động NGAY LẬP TỨC):\n');
    
    qrcode.generate(tunnelUrl, { small: true });
    
    console.log('\n✨ Ưu điểm Cloudflare:');
    console.log('   ✅ Không hỏi IP (vào ngay)');
    console.log('   ✅ Có HTTPS → PWA hoạt động đầy đủ');
    console.log('   ✅ Nhanh hơn localtunnel');
    console.log('   ✅ Ổn định hơn');
    console.log('   ✅ Miễn phí 100%\n');
    
    console.log('💡 Lưu ý:');
    console.log('   • Dev server phải đang chạy (npm run dev)');
    console.log('   • Tunnel sẽ chạy cho đến khi bạn tắt (Ctrl+C)');
    console.log('   • URL này chỉ hoạt động khi tunnel đang chạy\n');
    
    console.log('🎉 Sẵn sàng! Quét QR code ngay!\n');
  }
});

tunnel.stderr.on('data', (data) => {
  const output = data.toString();
  // Cloudflared outputs to stderr, check for URL there too
  const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (urlMatch && !tunnelUrl) {
    tunnelUrl = urlMatch[0];
    
    console.clear();
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║      ✅ TUNNEL THÀNH CÔNG - QUÉT QR NGAY!              ║');
    console.log('║         (Không cần xác nhận IP)                        ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log('🌍 Public URL (có HTTPS):');
    console.log('   ' + tunnelUrl + '\n');
    
    console.log('📱 Quét QR Code (hoạt động NGAY LẬP TỨC):\n');
    
    qrcode.generate(tunnelUrl, { small: true });
    
    console.log('\n✨ Ưu điểm Cloudflare:');
    console.log('   ✅ Không hỏi IP (vào ngay)');
    console.log('   ✅ Có HTTPS → PWA hoạt động đầy đủ');
    console.log('   ✅ Nhanh hơn localtunnel');
    console.log('   ✅ Ổn định hơn');
    console.log('   ✅ Miễn phí 100%\n');
    
    console.log('💡 Lưu ý:');
    console.log('   • Dev server phải đang chạy (npm run dev)');
    console.log('   • Tunnel sẽ chạy cho đến khi bạn tắt (Ctrl+C)\n');
    
    console.log('🎉 Sẵn sàng! Quét QR code ngay!\n');
  }
});

tunnel.on('error', (error) => {
  console.error('\n❌ Lỗi tạo tunnel:', error.message);
  console.log('\n💡 Cloudflared sẽ tự động tải về lần đầu');
  console.log('   Vui lòng đợi và thử lại\n');
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Đang tắt tunnel...');
  tunnel.kill();
  process.exit(0);
});

// Timeout if tunnel doesn't start
setTimeout(() => {
  if (!tunnelUrl) {
    console.log('\n⏰ Tunnel mất quá lâu...');
    console.log('\n💡 Thử:');
    console.log('   1. Kiểm tra internet');
    console.log('   2. Đợi cloudflared tải về (lần đầu)');
    console.log('   3. Chạy lại: npm run cf\n');
  }
}, 60000);
