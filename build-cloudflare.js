const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Cloudflare Pages optimized image configurations
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
  }
};

async function optimizeWithSharp(inputPath, outputDir, filename, config) {
  const nameWithoutExt = path.parse(filename).name;
  const webpOutput = path.join(outputDir, `${nameWithoutExt}${config.suffix}.webp`);
  const jpegOutput = path.join(outputDir, `${nameWithoutExt}${config.suffix}.jpg`);
  
  try {
    // Use sharp for image optimization (works in Node.js environments)
    const sharp = require('sharp');
    
    // Create WebP version
    await sharp(inputPath)
      .resize(config.width, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality: config.quality })
      .toFile(webpOutput);
    
    // Create JPEG fallback
    await sharp(inputPath)
      .resize(config.width, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality: config.quality })
      .toFile(jpegOutput);
    
    return { webp: webpOutput, jpeg: jpegOutput };
  } catch (error) {
    console.error(`Error processing ${filename} with Sharp:`, error.message);
    
    // Fallback to copying original if Sharp fails
    const fallbackOutput = path.join(outputDir, filename);
    fs.copyFileSync(inputPath, fallbackOutput);
    return { original: fallbackOutput };
  }
}

async function buildForCloudflare() {
  console.log('Building for Cloudflare Pages...');
  
  const buildDir = './dist';
  const sourceDir = './flipbook-v2';
  
  // Clean and create build directory
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });
  
  // Copy static files
  console.log('Copying static files...');
  fs.copyFileSync(path.join(sourceDir, 'index.html'), path.join(buildDir, 'index.html'));
  
  // Create optimized images directory
  const optimizedDir = path.join(buildDir, 'pages');
  fs.mkdirSync(optimizedDir, { recursive: true });
  
  // Check if we can use Sharp for optimization
  let useSharp = false;
  try {
    require('sharp');
    useSharp = true;
    console.log('Using Sharp for image optimization...');
  } catch (error) {
    console.log('Sharp not available, copying original images...');
  }
  
  const pagesDir = path.join(sourceDir, 'pages');
  const imageFiles = fs.readdirSync(pagesDir).filter(file => 
    /\.(jpg|jpeg|png)$/i.test(file)
  );
  
  console.log(`Processing ${imageFiles.length} images...`);
  
  if (useSharp) {
    // Optimize images with Sharp
    for (const filename of imageFiles) {
      const inputPath = path.join(pagesDir, filename);
      console.log(`Optimizing ${filename}...`);
      
      for (const [configName, config] of Object.entries(configs)) {
        await optimizeWithSharp(inputPath, optimizedDir, filename, config);
      }
    }
  } else {
    // Fallback: copy original images
    imageFiles.forEach(filename => {
      const inputPath = path.join(pagesDir, filename);
      const outputPath = path.join(optimizedDir, filename);
      fs.copyFileSync(inputPath, outputPath);
    });
  }
  
  // Update HTML to use optimized images
  updateHtmlForOptimizedImages(buildDir, useSharp);
  
  // Create _headers file for caching
  createHeadersFile(buildDir);
  
  console.log('Build complete! Deploy the ./dist directory to Cloudflare Pages.');
}

function updateHtmlForOptimizedImages(buildDir, useOptimized) {
  const htmlPath = path.join(buildDir, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  if (useOptimized) {
    // Replace the JavaScript template literal that generates image paths
    html = html.replace(
      /slide\.innerHTML = `<div class="slide-inner"><img src="pages\/page\$\{i\}\.jpg" \/><\/div>`;/,
      `slide.innerHTML = \`<div class="slide-inner">
        <picture>
          <source media="(max-width: 768px)" srcset="pages/page\${i}-mobile.webp" type="image/webp">
          <source media="(max-width: 1024px)" srcset="pages/page\${i}-tablet.webp" type="image/webp">
          <source srcset="pages/page\${i}-desktop.webp" type="image/webp">
          <source media="(max-width: 768px)" srcset="pages/page\${i}-mobile.jpg">
          <source media="(max-width: 1024px)" srcset="pages/page\${i}-tablet.jpg">
          <img src="pages/page\${i}-desktop.jpg" />
        </picture>
      </div>\`;`
    );
  }
  
  fs.writeFileSync(htmlPath, html);
}

function createHeadersFile(buildDir) {
  const headersContent = `# Cache images for 1 year
/pages/*
  Cache-Control: public, max-age=31536000, immutable

# Cache HTML for 1 hour
/*.html
  Cache-Control: public, max-age=3600

# Enable compression
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
`;
  
  fs.writeFileSync(path.join(buildDir, '_headers'), headersContent);
}

// Run build
buildForCloudflare().catch(console.error);