// Create properly sized SVG icons from the main SVG
const fs = require('fs');

// Read the main SVG
const mainSvg = fs.readFileSync('icon.svg', 'utf8');

// Function to create resized SVG
function createSizedSVG(size) {
  // Replace the width and height in the SVG
  const resizedSvg = mainSvg
    .replace('width="800px"', `width="${size}px"`)
    .replace('height="800px"', `height="${size}px"`);
  
  return resizedSvg;
}

// Create SVG files for each size
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const svgContent = createSizedSVG(size);
  const filename = `icon${size}.svg`;
  
  fs.writeFileSync(filename, svgContent);
  console.log(`Created ${filename}`);
});

console.log('SVG icons created successfully!');