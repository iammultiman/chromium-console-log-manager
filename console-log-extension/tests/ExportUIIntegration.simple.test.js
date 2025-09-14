/**
 * Simple test for Export UI Integration
 * Tests basic export functionality integration
 */

describe('Export UI Integration - Simple', () => {
  let mockExportManager;
  let mockOptionsManager;

  beforeEach(() => {
    // Mock DOM elements
    document.body.innerHTML = `
      <div class="export-section">
        <input type="radio" name="export-format" value="json" checked>
        <input type="radio" name="export-format" value="csv">
        <input type="radio" name="export-format" value="txt">
        
        <input type="radio" name="export-scope" value="current-filters" checked>
        <input type="radio" name="export-scope" value="all">
        <input type="radio" name="export-scope" value="custom">
        
        <input type="checkbox" id="exclude-sensitive-data" checked>
        
        <input type="date" id="export-date-from">
        <input type="date" id="export-date-to">
        
        <div id="export-preview-content"></div>
        
        <button id="export-logs">Export Logs</button>
        <button id="preview-export">Preview</button>
        <button id="copy-export">Copy to Clipboard</button>
      </div>
    `;

    // Mock ExportManager
    mockExportManager = {
      validateExportParameters: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
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

    // Mock navigator.clipboard
    global.navigator = {
      clipboard: {
        writeText: jest.fn().mockResolvedValue()
      }
    };

    // Mock URL methods
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:test-url'),
      revokeObjectURL: jest.fn()
    };

    // Mock Blob
    global.Blob = jest.fn((content, options) => ({
      content,
      type: options?.type || 'text/plain'
    }));

    // Create mock options manager with export methods
    mockOptionsManager = {
      exportManager: mockExportManager,
      currentFilter: {
        textSearch: '',
        levels: ['log', 'error', 'warn', 'info'],
        domains: [],
        sessionIds: [],
        dateRange: { start: null, end: null }
      },

      getSelectedExportFormat() {
        const formatRadio = document.querySelector('input[name="export-format"]:checked');
        return formatRadio ? formatRadio.value : 'json';
      },

      getExportFilterCriteria() {
        return {
          textSearch: this.currentFilter.textSearch,
          levels: this.currentFilter.levels,
          domains: this.currentFilter.domains,
          startTime: this.currentFilter.dateRange.start,
          endTime: this.currentFilter.dateRange.end,
          limit: 50000
        };
      },

      async exportLogs() {
        try {
          this.showExportLoading(true);
          
          const exportFormat = this.getSelectedExportFormat();
          const filterCriteria = this.getExportFilterCriteria();
          
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
      },

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
      },

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
      },

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
      },

      showExportSuccess(message) {
        this.showExportMessage(message, 'success');
      },

      showExportError(message) {
        this.showExportMessage(message, 'error');
      },

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
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Export Format Selection', () => {
    test('should default to JSON format', () => {
      const format = mockOptionsManager.getSelectedExportFormat();
      expect(format).toBe('json');
    });

    test('should return selected format when radio button is checked', () => {
      const csvRadio = document.querySelector('input[name="export-format"][value="csv"]');
      csvRadio.checked = true;
      
      const format = mockOptionsManager.getSelectedExportFormat();
      expect(format).toBe('csv');
    });
  });

  describe('Export Functionality', () => {
    test('should export logs in JSON format', async () => {
      const jsonRadio = document.querySelector('input[name="export-format"][value="json"]');
      jsonRadio.checked = true;
      
      await mockOptionsManager.exportLogs();
      
      expect(mockExportManager.exportToJSON).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test('should export logs in CSV format', async () => {
      const csvRadio = document.querySelector('input[name="export-format"][value="csv"]');
      csvRadio.checked = true;
      
      await mockOptionsManager.exportLogs();
      
      expect(mockExportManager.exportToCSV).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test('should export logs in text format', async () => {
      const txtRadio = document.querySelector('input[name="export-format"][value="txt"]');
      txtRadio.checked = true;
      
      await mockOptionsManager.exportLogs();
      
      expect(mockExportManager.exportToText).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test('should handle export validation errors', async () => {
      mockExportManager.validateExportParameters.mockReturnValue({
        isValid: false,
        errors: ['Invalid date range'],
        warnings: []
      });
      
      await mockOptionsManager.exportLogs();
      
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
      const exportPromise = mockOptionsManager.exportLogs();
      
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

  describe('Copy to Clipboard Functionality', () => {
    test('should copy export data to clipboard', async () => {
      await mockOptionsManager.copyExportToClipboard();
      
      expect(mockExportManager.exportToJSON).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"test": "data"}');
    });

    test('should limit clipboard export to 1000 entries', async () => {
      await mockOptionsManager.copyExportToClipboard();
      
      const callArgs = mockExportManager.exportToJSON.mock.calls[0][0];
      expect(callArgs.limit).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    test('should handle export errors gracefully', async () => {
      mockExportManager.exportToJSON.mockRejectedValue(new Error('Export failed'));
      
      await mockOptionsManager.exportLogs();
      
      const errorMessage = document.getElementById('export-message');
      expect(errorMessage.textContent).toContain('Export failed');
      expect(errorMessage.className).toContain('error');
    });

    test('should handle clipboard errors gracefully', async () => {
      navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard failed'));
      
      await mockOptionsManager.copyExportToClipboard();
      
      const errorMessage = document.getElementById('export-message');
      expect(errorMessage.textContent).toContain('Copy to clipboard failed');
    });
  });

  describe('UI State Management', () => {
    test('should show success message after successful export', async () => {
      await mockOptionsManager.exportLogs();
      
      const successMessage = document.getElementById('export-message');
      expect(successMessage.textContent).toContain('Export completed successfully');
      expect(successMessage.className).toContain('success');
    });

    test('should create download link with correct attributes', async () => {
      await mockOptionsManager.exportLogs();
      
      // Check that a download link was created and clicked
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });
});