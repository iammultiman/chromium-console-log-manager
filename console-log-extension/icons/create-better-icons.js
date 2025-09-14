// Create better PNG icons for the extension
// This script creates simple but recognizable icons

const fs = require('fs');

// Create a simple PNG data for each size
// This creates a basic icon with the green color scheme

function createIconData(size) {
  // Create a simple base64 encoded PNG for a green square with "LOG" text
  // This is a simplified approach - in production you'd use a proper image library
  
  const canvas = `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#00bd02" rx="${size/8}"/>
    <text x="${size/2}" y="${size/2 + size/8}" text-anchor="middle" fill="white" 
          font-family="Arial, sans-serif" font-size="${size/4}" font-weight="bold">LOG</text>
  </svg>`;
  
  return canvas;
}

// Generate SVG-based icons for each size
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const svgContent = createIconData(size);
  const filename = `icon${size}.svg`;
  
  try {
    fs.writeFileSync(filename, svgContent);
    console.log(`Generated ${filename}`);
  } catch (error) {
    console.error(`Error generating ${filename}:`, error);
  }
});

console.log('Icon generation complete. Note: These are SVG files.');
console.log('For PNG conversion, you would need to use a tool like sharp or canvas.');