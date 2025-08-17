const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if ImageMagick is available
function checkImageMagick() {
  try {
    execSync('convert -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('ImageMagick not found. Please install it:');
    console.error('macOS: brew install imagemagick');
    console.error('Ubuntu: sudo apt-get install imagemagick');
    console.error('Windows: Download from https://imagemagick.org/');
    return false;
  }
}

// Image optimization configurations
const configs = {
  mobile: {
    width: 800,
    quality: 75,
    suffix: '-mobile'
  },
  tablet: {
    width: 1200,
    quality: 80,
    suffix: '-tablet'
  },
  desktop: {
    width: 1920,
    quality: 85,
    suffix: '-desktop'
  },
  thumbnail: {
    width: 300,
    quality: 70,
    suffix: '-thumb'
  }
};

function optimizeImage(inputPath, outputDir, filename, config) {
  const nameWithoutExt = path.parse(filename).name;
  const outputPath = path.join(outputDir, `${nameWithoutExt}${config.suffix}.webp`);
  
  try {
    // Convert to WebP with specified quality and resize
    const command = `convert "${inputPath}" -resize ${config.width}x -quality ${config.quality} -format webp "${outputPath}"`;
    execSync(command, { stdio: 'ignore' });
    
    // Also create JPEG fallback
    const jpegOutputPath = path.join(outputDir, `${nameWithoutExt}${config.suffix}.jpg`);
    const jpegCommand = `convert "${inputPath}" -resize ${config.width}x -quality ${config.quality} "${jpegOutputPath}"`;
    execSync(jpegCommand, { stdio: 'ignore' });
    
    return { webp: outputPath, jpeg: jpegOutputPath };
  } catch (error) {
    console.error(`Error processing ${filename}:`, error.message);
    return null;
  }
}

function createOptimizedImages(sourceDir, outputBaseDir) {
  if (!checkImageMagick()) {
    process.exit(1);
  }

  console.log('Starting image optimization...');
  
  // Create output directories
  Object.keys(configs).forEach(configName => {
    const outputDir = path.join(outputBaseDir, configName);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  // Get all image files
  const imageFiles = fs.readdirSync(sourceDir).filter(file => 
    /\.(jpg|jpeg|png)$/i.test(file)
  );

  console.log(`Found ${imageFiles.length} images to process`);

  let processedCount = 0;
  const results = {};

  imageFiles.forEach(filename => {
    const inputPath = path.join(sourceDir, filename);
    console.log(`Processing ${filename}...`);
    
    results[filename] = {};
    
    Object.entries(configs).forEach(([configName, config]) => {
      const outputDir = path.join(outputBaseDir, configName);
      const result = optimizeImage(inputPath, outputDir, filename, config);
      if (result) {
        results[filename][configName] = result;
      }
    });
    
    processedCount++;
    console.log(`Processed ${processedCount}/${imageFiles.length}: ${filename}`);
  });

  // Generate a manifest file
  const manifestPath = path.join(outputBaseDir, 'image-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2));
  
  console.log('\nOptimization complete!');
  console.log(`Processed ${processedCount} images`);
  console.log(`Manifest saved to: ${manifestPath}`);
  
  // Show size comparison
  showSizeComparison(sourceDir, outputBaseDir);
}

function showSizeComparison(sourceDir, outputBaseDir) {
  console.log('\nSize comparison:');
  
  const originalFiles = fs.readdirSync(sourceDir).filter(file => 
    /\.(jpg|jpeg|png)$/i.test(file)
  );
  
  let originalTotalSize = 0;
  originalFiles.forEach(file => {
    const stats = fs.statSync(path.join(sourceDir, file));
    originalTotalSize += stats.size;
  });
  
  let optimizedTotalSize = 0;
  Object.keys(configs).forEach(configName => {
    const configDir = path.join(outputBaseDir, configName);
    if (fs.existsSync(configDir)) {
      const files = fs.readdirSync(configDir);
      files.forEach(file => {
        const stats = fs.statSync(path.join(configDir, file));
        optimizedTotalSize += stats.size;
      });
    }
  });
  
  const reduction = ((originalTotalSize - optimizedTotalSize) / originalTotalSize * 100).toFixed(1);
  
  console.log(`Original total: ${(originalTotalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Optimized total: ${(optimizedTotalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Size reduction: ${reduction}%`);
}

// Main execution
const sourceDir = process.argv[2] || './pages';
const outputDir = process.argv[3] || './optimized-images';

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  process.exit(1);
}

createOptimizedImages(sourceDir, outputDir);