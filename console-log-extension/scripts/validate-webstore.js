#!/usr/bin/env node

/**
 * Chrome Web Store Validation Script
 * Validates extension against Chrome Web Store requirements and policies
 */

const fs = require('fs');
const path = require('path');

class WebStoreValidator {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.errors = [];
    this.warnings = [];
  }

  log(message) {
    console.log(`[Validate] ${message}`);
  }

  error(message) {
    this.errors.push(message);
    console.error(`[Error] ${message}`);
  }

  warn(message) {
    this.warnings.push(message);
    console.warn(`[Warning] ${message}`);
  }

  validateManifest() {
    this.log('Validating manifest for Web Store compliance...');
    
    const manifestPath = path.join(this.rootDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Manifest version
    if (manifest.manifest_version !== 3) {
      this.error('Chrome Web Store requires Manifest V3');
    }

    // Name validation
    if (!manifest.name || manifest.name.length < 3) {
      this.error('Extension name must be at least 3 characters');
    }
    if (manifest.name.length > 75) {
      this.error('Extension name must be 75 characters or less');
    }

    // Description validation
    if (!manifest.description || manifest.description.length < 10) {
      this.error('Description must be at least 10 characters');
    }
    if (manifest.description.length > 132) {
      this.error('Description must be 132 characters or less for Web Store');
    }

    // Version validation
    const versionRegex = /^\d+(\.\d+){0,3}$/;
    if (!versionRegex.test(manifest.version)) {
      this.error('Version must be in format x, x.y, x.y.z, or x.y.z.w');
    }

    // Icons validation
    const requiredIconSizes = [16, 48, 128];
    for (const size of requiredIconSizes) {
      if (!manifest.icons || !manifest.icons[size]) {
        this.error(`Missing required icon size: ${size}x${size}`);
      } else {
        const iconPath = path.join(this.rootDir, manifest.icons[size]);
        if (!fs.existsSync(iconPath)) {
          this.error(`Icon file not found: ${manifest.icons[size]}`);
        }
      }
    }

    // Permissions validation
    this.validatePermissions(manifest);

    return manifest;
  }

  validatePermissions(manifest) {
    this.log('Validating permissions...');

    // Check for overly broad permissions
    if (manifest.host_permissions && manifest.host_permissions.includes('<all_urls>')) {
      this.warn('Using <all_urls> permission - ensure this is justified in store description');
    }

    // Check for sensitive permissions
    const sensitivePermissions = [
      'tabs', 'history', 'bookmarks', 'topSites', 'browsingData',
      'cookies', 'downloads', 'management', 'nativeMessaging'
    ];

    const usedSensitive = manifest.permissions?.filter(p => sensitivePermissions.includes(p)) || [];
    if (usedSensitive.length > 0) {
      this.warn(`Using sensitive permissions: ${usedSensitive.join(', ')} - ensure these are justified`);
    }

    // Check for deprecated permissions
    const deprecatedPermissions = ['background', 'persistent'];
    const usedDeprecated = manifest.permissions?.filter(p => deprecatedPermissions.includes(p)) || [];
    if (usedDeprecated.length > 0) {
      this.error(`Using deprecated permissions: ${usedDeprecated.join(', ')}`);
    }
  }

  validateContentSecurityPolicy() {
    this.log('Validating Content Security Policy...');
    
    const manifestPath = path.join(this.rootDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (manifest.content_security_policy) {
      const csp = manifest.content_security_policy;
      
      // Check for unsafe practices
      if (typeof csp === 'string') {
        if (csp.includes("'unsafe-eval'")) {
          this.error("CSP contains 'unsafe-eval' which is not allowed");
        }
        if (csp.includes("'unsafe-inline'")) {
          this.warn("CSP contains 'unsafe-inline' - consider removing if possible");
        }
      } else if (typeof csp === 'object') {
        Object.values(csp).forEach(policy => {
          if (policy.includes("'unsafe-eval'")) {
            this.error("CSP contains 'unsafe-eval' which is not allowed");
          }
          if (policy.includes("'unsafe-inline'")) {
            this.warn("CSP contains 'unsafe-inline' - consider removing if possible");
          }
        });
      }
    }
  }

  validateFileStructure() {
    this.log('Validating file structure...');
    
    const manifestPath = path.join(this.rootDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Check all referenced files exist
    const referencedFiles = [];

    // Background script
    if (manifest.background?.service_worker) {
      referencedFiles.push(manifest.background.service_worker);
    }

    // Content scripts
    if (manifest.content_scripts) {
      manifest.content_scripts.forEach(script => {
        if (script.js) referencedFiles.push(...script.js);
        if (script.css) referencedFiles.push(...script.css);
      });
    }

    // Action popup
    if (manifest.action?.default_popup) {
      referencedFiles.push(manifest.action.default_popup);
    }

    // Options page
    if (manifest.options_page) {
      referencedFiles.push(manifest.options_page);
    }
    if (manifest.options_ui?.page) {
      referencedFiles.push(manifest.options_ui.page);
    }

    // Icons
    if (manifest.icons) {
      referencedFiles.push(...Object.values(manifest.icons));
    }
    if (manifest.action?.default_icon) {
      if (typeof manifest.action.default_icon === 'string') {
        referencedFiles.push(manifest.action.default_icon);
      } else {
        referencedFiles.push(...Object.values(manifest.action.default_icon));
      }
    }

    // Web accessible resources
    if (manifest.web_accessible_resources) {
      manifest.web_accessible_resources.forEach(resource => {
        if (resource.resources) {
          referencedFiles.push(...resource.resources);
        }
      });
    }

    // Check if all referenced files exist
    for (const file of referencedFiles) {
      const filePath = path.join(this.rootDir, file);
      if (!fs.existsSync(filePath)) {
        this.error(`Referenced file not found: ${file}`);
      }
    }
  }

  validatePackageSize() {
    this.log('Validating package size...');
    
    let totalSize = 0;
    const maxSize = 128 * 1024 * 1024; // 128MB limit

    const calculateSize = (dirPath) => {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          // Skip certain directories
          if (['node_modules', '.git', 'tests', 'scripts', 'packages', 'dist'].includes(file)) {
            continue;
          }
          calculateSize(filePath);
        } else {
          // Skip certain file types
          if (file.endsWith('.md') || file.startsWith('.') || file.endsWith('.test.js')) {
            continue;
          }
          totalSize += stats.size;
        }
      }
    };

    calculateSize(this.rootDir);

    this.log(`Estimated package size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    if (totalSize > maxSize) {
      this.error(`Package size exceeds 128MB limit: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    } else if (totalSize > maxSize * 0.8) {
      this.warn(`Package size is close to 128MB limit: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    }

    return totalSize;
  }

  validateCodeQuality() {
    this.log('Validating code quality...');
    
    // Check for common issues in JavaScript files
    const jsFiles = this.findJavaScriptFiles();
    
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for eval usage (skip validation files)
      if (content.includes('eval(') && !file.includes('validate-webstore.js')) {
        this.error(`File ${path.relative(this.rootDir, file)} contains eval() which is not allowed`);
      }
      
      // Check for inline event handlers
      if (content.match(/on\w+\s*=/)) {
        this.warn(`File ${path.relative(this.rootDir, file)} may contain inline event handlers`);
      }
      
      // Check for external script loading
      if (content.includes('document.createElement(\'script\')')) {
        this.warn(`File ${path.relative(this.rootDir, file)} dynamically creates script elements`);
      }
    }
  }

  findJavaScriptFiles() {
    const jsFiles = [];
    
    const findJS = (dirPath) => {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          if (!['node_modules', '.git', 'tests', 'packages', 'dist'].includes(file)) {
            findJS(filePath);
          }
        } else if (file.endsWith('.js') && !file.endsWith('.test.js')) {
          jsFiles.push(filePath);
        }
      }
    };

    findJS(this.rootDir);
    return jsFiles;
  }

  validatePrivacyCompliance() {
    this.log('Validating privacy compliance...');
    
    // Check for external network requests in code
    const jsFiles = this.findJavaScriptFiles();
    
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for fetch/XMLHttpRequest to external domains
      if (content.includes('fetch(') || content.includes('XMLHttpRequest')) {
        this.warn(`File ${path.relative(this.rootDir, file)} may make network requests - ensure privacy compliance`);
      }
      
      // Check for analytics or tracking
      const trackingPatterns = [
        'google-analytics', 'gtag', 'analytics', 'tracking',
        'mixpanel', 'segment', 'amplitude'
      ];
      
      for (const pattern of trackingPatterns) {
        if (content.toLowerCase().includes(pattern)) {
          this.warn(`File ${path.relative(this.rootDir, file)} may contain tracking code: ${pattern}`);
        }
      }
    }
  }

  generateReport() {
    this.log('Generating validation report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        status: this.errors.length === 0 ? 'PASS' : 'FAIL'
      },
      errors: this.errors,
      warnings: this.warnings,
      recommendations: [
        'Review all warnings and address if possible',
        'Test extension thoroughly before submission',
        'Prepare detailed store description justifying permissions',
        'Create high-quality screenshots and promotional images',
        'Write comprehensive privacy policy',
        'Test on different Chrome versions'
      ]
    };

    const reportPath = path.join(this.rootDir, 'webstore-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  validate() {
    try {
      this.log('Starting Chrome Web Store validation...');
      
      this.validateManifest();
      this.validateContentSecurityPolicy();
      this.validateFileStructure();
      this.validatePackageSize();
      this.validateCodeQuality();
      this.validatePrivacyCompliance();
      
      const report = this.generateReport();
      
      // Print summary
      console.log('\n' + '='.repeat(50));
      console.log('VALIDATION SUMMARY');
      console.log('='.repeat(50));
      
      if (report.summary.status === 'PASS') {
        console.log('✅ VALIDATION PASSED');
        console.log('Extension is ready for Chrome Web Store submission!');
      } else {
        console.log('❌ VALIDATION FAILED');
        console.log(`Found ${report.summary.errors} error(s) that must be fixed.`);
      }
      
      if (report.summary.warnings > 0) {
        console.log(`⚠️  Found ${report.summary.warnings} warning(s) to review.`);
      }
      
      console.log('\nDetailed report saved to: webstore-validation-report.json');
      
      return report;
      
    } catch (error) {
      this.error(`Validation failed: ${error.message}`);
      return { summary: { status: 'ERROR', errors: this.errors.length, warnings: this.warnings.length } };
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new WebStoreValidator();
  const report = validator.validate();
  process.exit(report.summary.status === 'PASS' ? 0 : 1);
}

module.exports = WebStoreValidator;