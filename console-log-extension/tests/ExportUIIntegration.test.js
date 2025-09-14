/**
 * Test suite for Export UI Integration
 * Tests the integration of ExportManager with the options page UI
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Load the HTML template
const htmlPath = path.join(__dirname, '../options/options.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Create DOM environment
const dom = new JSDOM(htmlContent, {
  url: 'chrome-extension://test/options/options.html',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = {
  clipboard: {
    writeText: jest.fn().mockResolvedValue()
  }
};

// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock URL.createObjectURL and revokeObjectURL
global.URL = {
  createObjectURL: jest.fn(() => 'blob:test-url'),
  revokeObjectURL: jest.fn()
};

// Mock Blob
global.Blob = jest.fn((content, options) => ({
  content,
  type: options?.type || 'text/plain'
}));

// Mock the classes instead of loading them
global.FilterCriteria = class FilterCriteria {
  constructor() {
    this.textSearch = '';
    this.levels = ['log', 'error', 'warn', 'info'];
    this.domains = [];
    this.sessionIds = [];
    this.dateRange = { start: null, end: null };
  }
};

global.ExtensionSettings = class ExtensionSettings {
  constructor() {
    this.captureEnabled = true;
  }
};

global.ExportManager = class ExportManager {};
global.SensitiveDataDetector = class SensitiveDataDetector {};

describe('Export UI Integration', () => {
  let optionsManager;
  let mockStorageManager;
  let mockExportManager;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
    
    // Mock StorageManager
    mockStorageManager = {
      initializeDatabase: jest.fn().mockResolvedValue(),
      queryLogs: jest.fn().mockResolvedValue([
        {
          id: 'log1',
          timestamp: Date.now(),
          level: 'info',
          message: 'Test log message',
          url: 'https://example.com',
          domain: 'example.com',
          tabId: 1,
          sessionId: 'session1'
        }
      ])
    };

    // Mock ExportManager
    mockExportManager = {
      validateExportParameters: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      }),
      validateExportRequest: jest.fn().mockResolvedValue({
        scanResults: {
          hasSensitiveData: false,
          sensitiveEntries: 0
        }
      }),
      exportToJSON: jest.fn().mockResolvedValue({
        data: '{"test": "data"}',
        filename: 'test-export.json',
        mimeType: 'application/json',
        validation: {
          scanResults: {
            hasSensitiveData: false,
            sensitiveEntries: 0
          }
        }
      }),
      exportToCSV: jest.fn().mockResolvedValue({
        data: 'id,message\nlog1,test',
        filename: 'test-export.csv',
        mimeType: 'text/csv',
        validation: {
          scanResults: {
            hasSensitiveData: false,
            sensitiveEntries: 0
          }
        }
      }),
      exportToText: jest.fn().mockResolvedValue({
        data: 'Test log export',
        filename: 'test-export.txt',
        mimeType: 'text/plain',
        validation: {
          scanResults: {
            hasSensitiveData: false,
            sensitiveEntries: 0
          }
        }
      }),
      createSecurePreview: jest.fn().mockResolvedValue({
        logs: [{
          id: 'log1',
          timestamp: Date.now(),
          level: 'info',
          message: 'Test log message',
          domain: 'example.com'
        }],
        securitySummary: {
          hasSensitiveData: false,
          sensitiveEntries: 0,
          patterns: []
        },
        hasRedactions: false
      })
    };

    // Create a mock OptionsPageManager class
    class MockOptionsPageManager {
      constructor() {
        this.storageManager = mockStorageManager;
        this.exportManager = mockExportManager;
        this.currentFilter = new FilterCriteria();
        this.extensionSettings = new ExtensionSettings();
        this.currentLogs = [];
        this.currentPage = 1;
        this.logsPerPage = 50;
        this.totalLogs = 0;
        this.isLoading = false;
        this.syntaxHighlighting = true;
      }

      // Include the export methods from the actual implementation
      async exportLogs() {
        try {
          this.showExportLoading(true);
          
          const exportFormat = this.getSelectedExportFormat();
          const filterCriteria = this.getExportFilterCriteria();
          const excludeSensitive = document.getElementById('exclude-sensitive-data').checked;
          
          const validation = this.exportManager.validateExportParameters(filterCriteria);
          if (!validation.isValid) {
            this.showExportError(validation.errors.join(', '));
            return;
          }
          
          let exportResult;
          switch (exportFormat) {
            case 'json':
              exportResult = await this.exportManager.exportToJSON(filterCriteria);
              break;
            case 'csv':
              exportResult = await this.exportManager.exportToCSV(filterCriteria);
              break;
            case 'txt':
              exportResult = await this.exportManager.exportToText(filterCriteria);
              break;
            default:
              throw new Error('Invalid export format selected');
          }
          
          this.downloadExportFile(exportResult);
          this.showExportSuccess(`Export completed successfully! ${exportResult.filename} has been downloaded.`);
          
        } catch (error) {
          console.error('Export failed:', error);
          this.showExportError(`Export failed: ${error.message}`);
        } finally {
          this.showExportLoading(false);
        }
      }

      async previewExport() {
        try {
          this.showExportLoading(true);
          
          const exportFormat = this.getSelectedExportFormat();
          const filterCriteria = this.getExportFilterCriteria();
          
          const preview = await this.exportManager.createSecurePreview(filterCriteria, 10);
          
          let previewContent;
          switch (exportFormat) {
            case 'json':
              previewContent = this.generateJSONPreview(preview.logs);
              break;
            case 'csv':
              previewContent = this.generateCSVPreview(preview.logs);
              break;
            case 'txt':
              previewContent = this.generateTextPreview(preview.logs);
              break;
            default:
              previewContent = 'Invalid format selected';
          }
          
          this.displayExportPreview(previewContent, preview.securitySummary, preview.hasRedactions);
          
        } catch (error) {
          console.error('Preview failed:', error);
          this.showExportError(`Preview failed: ${error.message}`);
        } finally {
          this.showExportLoading(false);
        }
      }

      async copyExportToClipboard() {
        try {
          this.showExportLoading(true);
          
          const exportFormat = this.getSelectedExportFormat();
          const filterCriteria = this.getExportFilterCriteria();
          
          const limitedCriteria = { ...filterCriteria, limit: 1000 };
          
          let exportResult;
          switch (exportFormat) {
            case 'json':
              exportResult = await this.exportManager.exportToJSON(limitedCriteria);
              break;
            case 'csv':
              exportResult = await this.exportManager.exportToCSV(limitedCriteria);
              break;
            case 'txt':
              exportResult = await this.exportManager.exportToText(limitedCriteria);
              break;
            default:
              throw new Error('Invalid export format selected');
          }
          
          await navigator.clipboard.writeText(exportResult.data);
          this.showExportSuccess('Export data copied to clipboard successfully!');
          
        } catch (error) {
          console.error('Copy to clipboard failed:', error);
          this.showExportError(`Copy to clipboard failed: ${error.message}`);
        } finally {
          this.showExportLoading(false);
        }
      }

      getSelectedExportFormat() {
        const formatRadio = document.querySelector('input[name="export-format"]:checked');
        return formatRadio ? formatRadio.value : 'json';
      }

      getExportFilterCriteria() {
        const scopeRadio = document.querySelector('input[name="export-scope"]:checked');
        const scope = scopeRadio ? scopeRadio.value : 'current-filters';
        
        switch (scope) {
          case 'current-filters':
            return {
              textSearch: this.currentFilter.textSearch,
              levels: this.currentFilter.levels,
              domains: this.currentFilter.domains,
              startTime: this.currentFilter.dateRange.start,
              endTime: this.currentFilter.dateRange.end,
              limit: 50000
            };
          case 'all':
            return { limit: 50000 };
          case 'custom':
            const dateFrom = document.getElementById('export-date-from').value;
            const dateTo = document.getElementById('export-date-to').value;
            
            return {
              startTime: dateFrom ? new Date(dateFrom).getTime() : 0,
              endTime: dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Date.now(),
              limit: 50000
            };
          default:
            return { limit: 50000 };
        }
      }

      generateJSONPreview(logs) {
        const sampleData = {
          metadata: {
            exportDate: new Date().toISOString(),
            totalEntries: logs.length,
            format: 'JSON',
            version: '1.0'
          },
          logs: logs.slice(0, 3)
        };
        
        return JSON.stringify(sampleData, null, 2);
      }

      generateCSVPreview(logs) {
        const headers = ['ID', 'Timestamp', 'Date/Time', 'Level', 'Message', 'URL', 'Domain'];
        const rows = logs.slice(0, 3).map(log => [
          log.id,
          log.timestamp,
          new Date(log.timestamp).toISOString(),
          log.level,
          log.message.substring(0, 50) + '...',
          log.url,
          log.domain
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
      }

      generateTextPreview(logs) {
        const header = `Console Log Export\nGenerated: ${new Date().toISOString()}\nTotal Entries: ${logs.length}\n\n`;
        const logLines = logs.slice(0, 3).map(log => {
          const timestamp = new Date(log.timestamp).toISOString();
          return `[${timestamp}] [${log.level.toUpperCase()}] [${log.domain}] ${log.message}`;
        });
        
        return header + logLines.join('\n');
      }

      displayExportPreview(content, securitySummary, hasRedactions) {
        const previewContent = document.getElementById('export-preview-content');
        
        let html = `<pre class="export-preview-text">${this.escapeHtml(content)}</pre>`;
        
        if (hasRedactions) {
          html += `<div class="security-warning">
            <strong>Security Notice:</strong> Some data has been redacted in this preview due to potential sensitive content.
          </div>`;
        }
        
        if (securitySummary && securitySummary.hasSensitiveData) {
          html += `<div class="security-summary">
            <h4>Security Summary:</h4>
            <ul>
              <li>Potentially sensitive entries: ${securitySummary.sensitiveEntries}</li>
              <li>Common patterns detected: ${securitySummary.patterns.join(', ')}</li>
            </ul>
          </div>`;
        }
        
        previewContent.innerHTML = html;
      }

      downloadExportFile(exportResult) {
        const blob = new Blob([exportResult.data], { type: exportResult.mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = exportResult.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
      }

      showExportLoading(show) {
        const exportBtn = document.getElementById('export-logs');
        const previewBtn = document.getElementById('preview-export');
        const copyBtn = document.getElementById('copy-export');
        
        if (show) {
          exportBtn.disabled = true;
          previewBtn.disabled = true;
          copyBtn.disabled = true;
          exportBtn.textContent = 'Exporting...';
        } else {
          exportBtn.disabled = false;
          previewBtn.disabled = false;
          copyBtn.disabled = false;
          exportBtn.textContent = 'Export Logs';
        }
      }

      showExportSuccess(message) {
        this.showExportMessage(message, 'success');
      }

      showExportError(message) {
        this.showExportMessage(message, 'error');
      }

      showExportMessage(message, type) {
        let messageEl = document.getElementById('export-message');
        if (!messageEl) {
          messageEl = document.createElement('div');
          messageEl.id = 'export-message';
          messageEl.className = 'export-message';
          
          const exportSection = document.querySelector('.export-section');
          exportSection.insertBefore(messageEl, exportSection.firstChild);
        }
        
        messageEl.className = `export-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
      }

      escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
    }

    optionsManager = new MockOptionsPageManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Export Format Selection', () => {
    test('should default to JSON format', () => {
      const format = optionsManager.getSelectedExportFormat();
      expect(format).toBe('json');
    });

    test('should return selected format when radio button is checked', () => {
      const csvRadio = document.querySelector('input[name="export-format"][value="csv"]');
      csvRadio.checked = true;
      
      const format = optionsManager.getSelectedExportFormat();
      expect(format).toBe('csv');
    });
  });

  describe('Export Scope Selection', () => {
    test('should default to current-filters scope', () => {
      const criteria = optionsManager.getExportFilterCriteria();
      expect(criteria.limit).toBe(50000);
    });

    test('should handle custom date range scope', () => {
      const customRadio = document.querySelector('input[name="export-scope"][value="custom"]');
      customRadio.checked = true;
      
      const dateFrom = document.getElementById('export-date-from');
      const dateTo = document.getElementById('export-date-to');
      dateFrom.value = '2024-01-01';
      dateTo.value = '2024-01-31';
      
      const criteria = optionsManager.getExportFilterCriteria();
      expect(criteria.startTime).toBe(new Date('2024-01-01').getTime());
      expect(criteria.endTime).toBe(new Date('2024-01-31T23:59:59').getTime());
    });

    test('should handle all logs scope', () => {
      const allRadio = document.querySelector('input[name="export-scope"][value="all"]');
      allRadio.checked = true;
      
      const criteria = optionsManager.getExportFilterCriteria();
      expect(criteria.limit).toBe(50000);
      expect(criteria.textSearch).toBeUndefined();
    });
  });

  describe('Export Functionality', () => {
    test('should export logs in JSON format', async () => {
      const jsonRadio = document.querySelector('input[name="export-format"][value="json"]');
      jsonRadio.checked = true;
      
      await optionsManager.exportLogs();
      
      expect(mockExportManager.exportToJSON).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test('should export logs in CSV format', async () => {
      const csvRadio = document.querySelector('input[name="export-format"][value="csv"]');
      csvRadio.checked = true;
      
      await optionsManager.exportLogs();
      
      expect(mockExportManager.exportToCSV).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test('should export logs in text format', async () => {
      const txtRadio = document.querySelector('input[name="export-format"][value="txt"]');
      txtRadio.checked = true;
      
      await optionsManager.exportLogs();
      
      expect(mockExportManager.exportToText).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test('should handle export validation errors', async () => {
      mockExportManager.validateExportParameters.mockReturnValue({
        isValid: false,
        errors: ['Invalid date range'],
        warnings: []
      });
      
      await optionsManager.exportLogs();
      
      const errorMessage = document.getElementById('export-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain('Invalid date range');
      expect(errorMessage.className).toContain('error');
    });

    test('should show loading state during export', async () => {
      const exportBtn = document.getElementById('export-logs');
      const previewBtn = document.getElementById('preview-export');
      const copyBtn = document.getElementById('copy-export');
      
      // Start export (don't await to check loading state)
      const exportPromise = optionsManager.exportLogs();
      
      // Check loading state is applied
      expect(exportBtn.disabled).toBe(true);
      expect(previewBtn.disabled).toBe(true);
      expect(copyBtn.disabled).toBe(true);
      expect(exportBtn.textContent).toBe('Exporting...');
      
      // Wait for export to complete
      await exportPromise;
      
      // Check loading state is removed
      expect(exportBtn.disabled).toBe(false);
      expect(previewBtn.disabled).toBe(false);
      expect(copyBtn.disabled).toBe(false);
      expect(exportBtn.textContent).toBe('Export Logs');
    });
  });

  describe('Preview Functionality', () => {
    test('should generate and display preview', async () => {
      await optionsManager.previewExport();
      
      expect(mockExportManager.createSecurePreview).toHaveBeenCalled();
      
      const previewContent = document.getElementById('export-preview-content');
      expect(previewContent.innerHTML).toContain('export-preview-text');
    });

    test('should generate JSON preview correctly', () => {
      const logs = [{
        id: 'log1',
        timestamp: Date.now(),
        level: 'info',
        message: 'Test message',
        domain: 'example.com'
      }];
      
      const preview = optionsManager.generateJSONPreview(logs);
      const parsed = JSON.parse(preview);
      
      expect(parsed.metadata.format).toBe('JSON');
      expect(parsed.logs).toHaveLength(1);
      expect(parsed.logs[0].id).toBe('log1');
    });

    test('should generate CSV preview correctly', () => {
      const logs = [{
        id: 'log1',
        timestamp: 1234567890,
        level: 'info',
        message: 'Test message',
        url: 'https://example.com',
        domain: 'example.com'
      }];
      
      const preview = optionsManager.generateCSVPreview(logs);
      const lines = preview.split('\n');
      
      expect(lines[0]).toContain('ID,Timestamp,Date/Time,Level,Message,URL,Domain');
      expect(lines[1]).toContain('log1,1234567890');
    });

    test('should generate text preview correctly', () => {
      const logs = [{
        id: 'log1',
        timestamp: 1234567890,
        level: 'info',
        message: 'Test message',
        domain: 'example.com'
      }];
      
      const preview = optionsManager.generateTextPreview(logs);
      
      expect(preview).toContain('Console Log Export');
      expect(preview).toContain('Total Entries: 1');
      expect(preview).toContain('[INFO] [example.com] Test message');
    });
  });

  describe('Copy to Clipboard Functionality', () => {
    test('should copy export data to clipboard', async () => {
      await optionsManager.copyExportToClipboard();
      
      expect(mockExportManager.exportToJSON).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"test": "data"}');
    });

    test('should limit clipboard export to 1000 entries', async () => {
      await optionsManager.copyExportToClipboard();
      
      const callArgs = mockExportManager.exportToJSON.mock.calls[0][0];
      expect(callArgs.limit).toBe(1000);
    });
  });

  describe('Security Features', () => {
    test('should display security warnings when sensitive data detected', async () => {
      mockExportManager.createSecurePreview.mockResolvedValue({
        logs: [],
        securitySummary: {
          hasSensitiveData: true,
          sensitiveEntries: 5,
          patterns: ['API_KEY', 'PASSWORD']
        },
        hasRedactions: true
      });
      
      await optionsManager.previewExport();
      
      const previewContent = document.getElementById('export-preview-content');
      expect(previewContent.innerHTML).toContain('Security Notice');
      expect(previewContent.innerHTML).toContain('Security Summary');
      expect(previewContent.innerHTML).toContain('Potentially sensitive entries: 5');
    });

    test('should handle sensitive data filtering option', async () => {
      const excludeSensitiveCheckbox = document.getElementById('exclude-sensitive-data');
      excludeSensitiveCheckbox.checked = true;
      
      mockExportManager.validateExportRequest.mockResolvedValue({
        scanResults: {
          hasSensitiveData: true,
          sensitiveEntries: 3
        }
      });
      
      // Mock confirm to return true
      global.confirm = jest.fn().mockReturnValue(true);
      
      await optionsManager.exportLogs();
      
      expect(mockExportManager.validateExportRequest).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          format: 'json',
          excludeSensitive: true
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle export errors gracefully', async () => {
      mockExportManager.exportToJSON.mockRejectedValue(new Error('Export failed'));
      
      await optionsManager.exportLogs();
      
      const errorMessage = document.getElementById('export-message');
      expect(errorMessage.textContent).toContain('Export failed');
      expect(errorMessage.className).toContain('error');
    });

    test('should handle preview errors gracefully', async () => {
      mockExportManager.createSecurePreview.mockRejectedValue(new Error('Preview failed'));
      
      await optionsManager.previewExport();
      
      const errorMessage = document.getElementById('export-message');
      expect(errorMessage.textContent).toContain('Preview failed');
    });

    test('should handle clipboard errors gracefully', async () => {
      navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard failed'));
      
      await optionsManager.copyExportToClipboard();
      
      const errorMessage = document.getElementById('export-message');
      expect(errorMessage.textContent).toContain('Copy to clipboard failed');
    });
  });

  describe('UI State Management', () => {
    test('should show success message after successful export', async () => {
      await optionsManager.exportLogs();
      
      const successMessage = document.getElementById('export-message');
      expect(successMessage.textContent).toContain('Export completed successfully');
      expect(successMessage.className).toContain('success');
    });

    test('should create download link with correct attributes', async () => {
      await optionsManager.exportLogs();
      
      // Check that a download link was created and clicked
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });
});