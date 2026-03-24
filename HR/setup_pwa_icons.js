// PWA Icon Setup Script
// Run this to copy the logo to PWA icon files
// Note: You need to have sharp or jimp installed, or do this manually

import fs from 'fs';
import path from 'path';

const publicDir = path.join(process.cwd(), 'public');
const logoPath = path.join(publicDir, 'VijayShipping_Logo.png');
const icon192Path = path.join(publicDir, 'pwa-192x192.png');
const icon512Path = path.join(publicDir, 'pwa-512x512.png');

// Check if logo exists
if (!fs.existsSync(logoPath)) {
  console.error('Error: VijayShipping_Logo.png not found in public folder');
  process.exit(1);
}

// Copy logo to icon files
// Note: In production, you should resize these to exact dimensions (192x192 and 512x512)
fs.copyFileSync(logoPath, icon192Path);
fs.copyFileSync(logoPath, icon512Path);

console.log('PWA icons created successfully!');
console.log('- pwa-192x192.png');
console.log('- pwa-512x512.png');

// Note: For production, resize these images to exact dimensions
// You can use: npm install sharp
// Then resize programmatically