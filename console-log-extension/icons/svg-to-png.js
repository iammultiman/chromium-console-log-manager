// Convert SVG to PNG using Sharp
const sharp = require('sharp');
const fs = require('fs');

async function convertSvgToPng() {
  // Read the main SVG file
  const svgBuffer = fs.readFileSync('icon.svg');
  
  // Sizes to generate
  const sizes = [16, 32, 48, 128];
  
  for (const size of sizes) {
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(`icon${size}.png`);
      
      console.log(`✓ Created icon${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to create icon${size}.png:`, error.message);
    }
  }
  
  console.log('PNG conversion complete!');
}

// Run the conversion
convertSvgToPng().catch(console.error);