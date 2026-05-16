#!/usr/bin/env node

/**
 * Script to generate PWA icons from a source image
 * Usage: node scripts/generate-pwa-icons.js
 * 
 * Requirements: Install sharp
 * npm install --save-dev sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('❌ Error: sharp is not installed');
  console.log('📦 Please install sharp: npm install --save-dev sharp');
  process.exit(1);
}

// Icon sizes needed for PWA
const ICON_SIZES = [
  16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512, 1024
];

// Splash screen sizes for iOS
const SPLASH_SIZES = [
  { width: 2048, height: 2732, name: 'splash-2048x2732.png' }, // iPad Pro 12.9"
  { width: 1668, height: 2388, name: 'splash-1668x2388.png' }, // iPad Pro 11"
  { width: 1536, height: 2048, name: 'splash-1536x2048.png' }, // iPad
  { width: 1284, height: 2778, name: 'splash-1284x2778.png' }, // iPhone 14 Pro Max
  { width: 1170, height: 2532, name: 'splash-1170x2532.png' }, // iPhone 14 Pro
  { width: 1125, height: 2436, name: 'splash-1125x2436.png' }, // iPhone X/XS/11 Pro
];

// Paths
const SOURCE_IMAGE = path.join(__dirname, '../assets/logos/logo-acb-inkythuatso/logo-acb-inkythuatso.png');
const ICONS_DIR = path.join(__dirname, '../public/assets/logos');
const SPLASH_DIR = path.join(__dirname, '../public/assets/splash');

// Create directories if they don't exist
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}
if (!fs.existsSync(SPLASH_DIR)) {
  fs.mkdirSync(SPLASH_DIR, { recursive: true });
}

// Check if source image exists
if (!fs.existsSync(SOURCE_IMAGE)) {
  console.error(`❌ Source image not found: ${SOURCE_IMAGE}`);
  console.log('📝 Please provide a source image (PNG, at least 1024x1024)');
  process.exit(1);
}

console.log('🎨 Generating PWA icons and splash screens...\n');

// Generate icons
async function generateIcons() {
  console.log('📱 Generating icons...');
  
  for (const size of ICON_SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}.png`);
    
    try {
      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`  ✅ Generated ${size}x${size} icon`);
    } catch (error) {
      console.error(`  ❌ Failed to generate ${size}x${size} icon:`, error.message);
    }
  }
}

// Generate splash screens
async function generateSplashScreens() {
  console.log('\n🖼️  Generating splash screens...');
  
  for (const splash of SPLASH_SIZES) {
    const outputPath = path.join(SPLASH_DIR, splash.name);
    
    try {
      // Create splash screen with logo centered
      const logoSize = Math.min(splash.width, splash.height) * 0.3; // 30% of smallest dimension
      
      await sharp({
        create: {
          width: splash.width,
          height: splash.height,
          channels: 4,
          background: { r: 79, g: 70, b: 229, alpha: 1 } // Indigo-600
        }
      })
      .composite([
        {
          input: await sharp(SOURCE_IMAGE)
            .resize(Math.round(logoSize), Math.round(logoSize), {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer(),
          gravity: 'center'
        }
      ])
      .png()
      .toFile(outputPath);
      
      console.log(`  ✅ Generated ${splash.width}x${splash.height} splash screen`);
    } catch (error) {
      console.error(`  ❌ Failed to generate ${splash.name}:`, error.message);
    }
  }
}

// Generate favicon
async function generateFavicon() {
  console.log('\n🌐 Generating favicon...');
  
  const faviconPath = path.join(__dirname, '../public/favicon.ico');
  
  try {
    await sharp(SOURCE_IMAGE)
      .resize(32, 32)
      .toFile(faviconPath.replace('.ico', '.png'));
    
    console.log('  ✅ Generated favicon.png (rename to .ico if needed)');
  } catch (error) {
    console.error('  ❌ Failed to generate favicon:', error.message);
  }
}

// Main execution
async function main() {
  try {
    await generateIcons();
    await generateSplashScreens();
    await generateFavicon();
    
    console.log('\n✨ All PWA assets generated successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Check the generated icons in public/assets/logos/');
    console.log('  2. Check the splash screens in public/assets/splash/');
    console.log('  3. Update manifest.json if needed');
    console.log('  4. Test the PWA on your device');
  } catch (error) {
    console.error('\n❌ Error generating PWA assets:', error);
    process.exit(1);
  }
}

main();
