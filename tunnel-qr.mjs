#!/usr/bin/env node

/**
 * Create public tunnel with QR code
 * Works from anywhere, has HTTPS
 */

import { spawn } from 'child_process';
import qrcode from 'qrcode-terminal';

console.log('\n🚀 Đang tạo public tunnel...\n');
console.log('⏳ Vui lòng đợi 5-10 giây...\n');

// Start localtunnel
const tunnel = spawn('npx', ['localtunnel', '--port', '3000'], {
  shell: true,
});

let tunnelUrl = null;

tunnel.stdout.on('data', (data) => {
  const output = data.toString();
  
  // Extract URL
  const urlMatch = output.match(/https:\/\/[^\s]+/);
  if (urlMatch && !tunnelUrl) {
    tunnelUrl = urlMatch[0];
    
    console.clear();
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║      ✅ TUNNEL THÀNH CÔNG - QUÉT QR NGAY!              ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log('🌍 Public URL (có HTTPS):');
    console.log('   ' + tunnelUrl + '\n');
    
    console.log('📱 Quét QR Code (hoạt động từ BẤT KỲ ĐÂU):\n');
    
    qrcode.generate(tunnelUrl, { small: true });
    
    console.log('\n✨ Ưu điểm:');
    console.log('   ✅ Có HTTPS → PWA hoạt động đầy đủ');
    console.log('   ✅ Không cần cùng WiFi');
    console.log('   ✅ Chia sẻ với bất kỳ ai');
    console.log('   ✅ Test trên nhiều thiết bị\n');
    
    console.log('💡 Lưu ý:');
    console.log('   • Dev server phải đang chạy (npm run dev)');
    console.log('   • Tunnel sẽ chạy cho đến khi bạn tắt (Ctrl+C)');
    console.log('   • URL này chỉ hoạt động khi tunnel đang chạy\n');
    
    console.log('🎉 Sẵn sàng! Quét QR code ngay!\n');
  }
});

tunnel.stderr.on('data', (data) => {
  const output = data.toString();
  if (!output.includes('your url is')) {
    console.error('⚠️  ', output);
  }
});

tunnel.on('error', (error) => {
  console.error('\n❌ Lỗi tạo tunnel:', error.message);
  console.log('\n💡 Thử cài đặt localtunnel:');
  console.log('   npm install -g localtunnel\n');
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
    console.log('   2. Chạy lại: npm run tunnel\n');
  }
}, 30000);
