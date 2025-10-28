const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

const ORANGE_COLOR = '#FF914D';
const EMOJI = '🔖';

// Icon configurations
const icons = [
  { name: 'icon.png', size: 1024 },
  { name: 'adaptive-icon.png', size: 1024 },
  { name: 'splash-icon.png', size: 400 },
  { name: 'favicon.png', size: 48 },
  { name: 'smashbook-logo.png', size: 512 },
];

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fill background with orange
  ctx.fillStyle = ORANGE_COLOR;
  ctx.fillRect(0, 0, size, size);

  // Calculate emoji size (about 60% of canvas size)
  const emojiFontSize = Math.floor(size * 0.6);
  
  // Set up text rendering for emoji
  ctx.font = `${emojiFontSize}px Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'black'; // This doesn't affect emoji color on most systems
  
  // Draw emoji in center
  ctx.fillText(EMOJI, size / 2, size / 2);

  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Generated: ${outputPath}`);
}

// Generate all icons
const assetsDir = path.join(__dirname, '..', 'assets', 'images');

console.log('🔖 Generating app icons with bookmark emoji on orange background...\n');

icons.forEach(({ name, size }) => {
  const outputPath = path.join(assetsDir, name);
  try {
    generateIcon(size, outputPath);
  } catch (error) {
    console.error(`❌ Error generating ${name}:`, error.message);
  }
});

console.log('\n✨ Icon generation complete!');

