/**
 * Verification test for Export UI Integration
 * Tests that the export functionality has been properly integrated
 */

describe('Export UI Integration - Verification', () => {
  test('should have export functionality methods in options.js', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsJsPath = path.join(__dirname, '../options/options.js');
    const optionsJsContent = fs.readFileSync(optionsJsPath, 'utf8');
    
    // Check that export methods are present
    expect(optionsJsContent).toContain('async exportLogs()');
    expect(optionsJsContent).toContain('async previewExport()');
    expect(optionsJsContent).toContain('async copyExportToClipboard()');
    expect(optionsJsContent).toContain('getSelectedExportFormat()');
    expect(optionsJsContent).toContain('getExportFilterCriteria()');
    expect(optionsJsContent).toContain('downloadExportFile(exportResult)');
    expect(optionsJsContent).toContain('showExportLoading(show)');
    expect(optionsJsContent).toContain('showExportSuccess(message)');
    expect(optionsJsContent).toContain('showExportError(message)');
  });

  test('should have ExportManager included in options.html', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsHtmlPath = path.join(__dirname, '../options/options.html');
    const optionsHtmlContent = fs.readFileSync(optionsHtmlPath, 'utf8');
    
    // Check that ExportManager and SensitiveDataDetector are included
    expect(optionsHtmlContent).toContain('<script src="../models/ExportManager.js"></script>');
    expect(optionsHtmlContent).toContain('<script src="../models/SensitiveDataDetector.js"></script>');
  });

  test('should have export-related CSS styles', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsCssPath = path.join(__dirname, '../options/options.css');
    const optionsCssContent = fs.readFileSync(optionsCssPath, 'utf8');
    
    // Check that export-related styles are present
    expect(optionsCssContent).toContain('.export-message');
    expect(optionsCssContent).toContain('.export-preview-text');
    expect(optionsCssContent).toContain('.security-warning');
    expect(optionsCssContent).toContain('.security-summary');
  });

  test('should have export tab structure in options.html', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsHtmlPath = path.join(__dirname, '../options/options.html');
    const optionsHtmlContent = fs.readFileSync(optionsHtmlPath, 'utf8');
    
    // Check that export tab elements are present
    expect(optionsHtmlContent).toContain('id="export-tab"');
    expect(optionsHtmlContent).toContain('name="export-format"');
    expect(optionsHtmlContent).toContain('name="export-scope"');
    expect(optionsHtmlContent).toContain('id="exclude-sensitive-data"');
    expect(optionsHtmlContent).toContain('id="export-logs"');
    expect(optionsHtmlContent).toContain('id="preview-export"');
    expect(optionsHtmlContent).toContain('id="copy-export"');
    expect(optionsHtmlContent).toContain('id="export-preview-content"');
  });

  test('should have ExportManager constructor call in options.js', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsJsPath = path.join(__dirname, '../options/options.js');
    const optionsJsContent = fs.readFileSync(optionsJsPath, 'utf8');
    
    // Check that ExportManager is instantiated
    expect(optionsJsContent).toContain('this.exportManager = new ExportManager(this.storageManager)');
  });

  test('should have export event listeners in options.js', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsJsPath = path.join(__dirname, '../options/options.js');
    const optionsJsContent = fs.readFileSync(optionsJsPath, 'utf8');
    
    // Check that export event listeners are set up
    expect(optionsJsContent).toContain('exportLogsBtn.addEventListener(\'click\', () => this.exportLogs())');
    expect(optionsJsContent).toContain('previewExportBtn.addEventListener(\'click\', () => this.previewExport())');
    expect(optionsJsContent).toContain('copyExportBtn.addEventListener(\'click\', () => this.copyExportToClipboard())');
  });

  test('should have export format handling in options.js', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsJsPath = path.join(__dirname, '../options/options.js');
    const optionsJsContent = fs.readFileSync(optionsJsPath, 'utf8');
    
    // Check that all export formats are handled
    expect(optionsJsContent).toContain('case \'json\':');
    expect(optionsJsContent).toContain('case \'csv\':');
    expect(optionsJsContent).toContain('case \'txt\':');
    expect(optionsJsContent).toContain('exportToJSON');
    expect(optionsJsContent).toContain('exportToCSV');
    expect(optionsJsContent).toContain('exportToText');
  });

  test('should have security features integrated', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsJsPath = path.join(__dirname, '../options/options.js');
    const optionsJsContent = fs.readFileSync(optionsJsPath, 'utf8');
    
    // Check that security features are integrated
    expect(optionsJsContent).toContain('validateExportRequest');
    expect(optionsJsContent).toContain('createSecurePreview');
    expect(optionsJsContent).toContain('excludeSensitive');
    expect(optionsJsContent).toContain('hasSensitiveData');
  });

  test('should have preview functionality integrated', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsJsPath = path.join(__dirname, '../options/options.js');
    const optionsJsContent = fs.readFileSync(optionsJsPath, 'utf8');
    
    // Check that preview functionality is integrated
    expect(optionsJsContent).toContain('generateJSONPreview');
    expect(optionsJsContent).toContain('generateCSVPreview');
    expect(optionsJsContent).toContain('generateTextPreview');
    expect(optionsJsContent).toContain('displayExportPreview');
  });

  test('should have clipboard functionality integrated', () => {
    const fs = require('fs');
    const path = require('path');
    
    const optionsJsPath = path.join(__dirname, '../options/options.js');
    const optionsJsContent = fs.readFileSync(optionsJsPath, 'utf8');
    
    // Check that clipboard functionality is integrated
    expect(optionsJsContent).toContain('navigator.clipboard.writeText');
    expect(optionsJsContent).toContain('Copy to clipboard');
    expect(optionsJsContent).toContain('limit: 1000'); // Clipboard export limit
  });
});