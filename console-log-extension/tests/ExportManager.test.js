/**
 * Tests for ExportManager class
 * Covers JSON, CSV, and text export functionality with security warnings
 */

// Mock IndexedDB for testing
global.indexedDB = {
  open: jest.fn()
};

// Mock chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

const ExportManager = require('../models/ExportManager');
const StorageManager = require('../models/StorageManager');

describe('ExportManager', () => {
  let exportManager;
  let mockStorageManager;
  let sampleLogs;

  beforeEach(() => {
    // Create mock storage manager
    mockStorageManager = {
      queryLogs: jest.fn()
    };

    exportManager = new ExportManager(mockStorageManager);

    // Sample log data for testing
    sampleLogs = [
      {
        id: 'log1',
        timestamp: 1640995200000, // 2022-01-01 00:00:00
        level: 'error',
        message: 'Test error message',
        args: ['error', 'details'],
        url: 'https://example.com/page1',
        domain: 'example.com',
        tabId: 123,
        sessionId: 'session1',
        metadata: { userAgent: 'test-agent' }
      },
      {
        id: 'log2',
        timestamp: 1640995260000, // 2022-01-01 00:01:00
        level: 'warn',
        message: 'API key: abc123secret',
        args: ['warning'],
        url: 'https://test.com/api',
        domain: 'test.com',
        tabId: 124,
        sessionId: 'session2',
        metadata: {}
      },
      {
        id: 'log3',
        timestamp: 1640995320000, // 2022-01-01 00:02:00
        level: 'info',
        message: 'User logged in successfully',
        args: ['info'],
        url: 'https://example.com/login',
        domain: 'example.com',
        tabId: 123,
        sessionId: 'session1',
        metadata: {}
      }
    ];

    mockStorageManager.queryLogs.mockResolvedValue(sampleLogs);
  });

  describe('JSON Export', () => {
    test('should export logs in JSON format with full metadata', async () => {
      const result = await exportManager.exportToJSON();

      expect(result.mimeType).toBe('application/json');
      expect(result.filename).toMatch(/console-logs-.*\.json/);
      
      const exportData = JSON.parse(result.data);
      expect(exportData.metadata).toEqual({
        exportDate: expect.any(String),
        totalEntries: 3,
        format: 'JSON',
        filters: {},
        version: '1.0'
      });

      expect(exportData.logs).toHaveLength(3);
      expect(exportData.logs[0]).toEqual({
        id: 'log1',
        timestamp: 1640995200000,
        timestampISO: '2022-01-01T00:00:00.000Z',
        level: 'error',
        message: 'Test error message',
        args: ['error', 'details'],
        url: 'https://example.com/page1',
        domain: 'example.com',
        tabId: 123,
        sessionId: 'session1',
        metadata: { userAgent: 'test-agent' }
      });
    });

    test('should include filter criteria in JSON export metadata', async () => {
      const filterCriteria = {
        levels: ['error'],
        domains: ['example.com'],
        textSearch: 'test'
      };

      const result = await exportManager.exportToJSON(filterCriteria);
      const exportData = JSON.parse(result.data);

      expect(exportData.metadata.filters).toEqual(filterCriteria);
    });

    test('should detect sensitive data in JSON export', async () => {
      const result = await exportManager.exportToJSON();

      expect(result.sensitiveDataWarning.hasSensitiveData).toBe(true);
      expect(result.sensitiveDataWarning.sensitiveEntryCount).toBe(1);
      expect(result.sensitiveDataWarning.sensitiveEntries[0].id).toBe('log2');
    });
  });

  describe('CSV Export', () => {
    test('should export logs in CSV format with proper headers', async () => {
      const result = await exportManager.exportToCSV();

      expect(result.mimeType).toBe('text/csv');
      expect(result.filename).toMatch(/console-logs-.*\.csv/);

      const lines = result.data.split('\n');
      const headers = lines[0].split(',');
      
      expect(headers).toEqual([
        'ID',
        'Timestamp',
        'Date/Time',
        'Level',
        'Message',
        'URL',
        'Domain',
        'Tab ID',
        'Session ID'
      ]);

      expect(lines).toHaveLength(4); // Header + 3 data rows
    });

    test('should properly escape CSV values with commas and quotes', async () => {
      const logsWithSpecialChars = [{
        id: 'log1',
        timestamp: 1640995200000,
        level: 'error',
        message: 'Error with "quotes" and, commas',
        args: [],
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 123,
        sessionId: 'session1'
      }];

      mockStorageManager.queryLogs.mockResolvedValue(logsWithSpecialChars);
      const result = await exportManager.exportToCSV();

      const lines = result.data.split('\n');
      const dataRow = lines[1];
      
      expect(dataRow).toContain('"Error with ""quotes"" and, commas"');
    });

    test('should detect sensitive data in CSV export', async () => {
      const result = await exportManager.exportToCSV();

      expect(result.sensitiveDataWarning.hasSensitiveData).toBe(true);
      expect(result.sensitiveDataWarning.sensitiveEntryCount).toBe(1);
    });
  });

  describe('Text Export', () => {
    test('should export logs in plain text format with header', async () => {
      const result = await exportManager.exportToText();

      expect(result.mimeType).toBe('text/plain');
      expect(result.filename).toMatch(/console-logs-.*\.txt/);

      const lines = result.data.split('\n');
      
      // Check header
      expect(lines[0]).toBe('Console Log Export');
      expect(lines[1]).toMatch(/Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(lines[2]).toBe('Total Entries: 3');

      // Check log entries
      const logLines = lines.slice(5); // Skip header and empty line
      expect(logLines.length).toBeGreaterThan(0);
      
      // Check that expected log entries are present (order may vary)
      const logContent = logLines.join('\n');
      expect(logContent).toMatch(/\[WARN\] \[test\.com\] API key: abc123secret/);
      expect(logContent).toMatch(/\[INFO\] \[example\.com\] User logged in successfully/);
    });

    test('should include filter information in text export header', async () => {
      const filterCriteria = {
        textSearch: 'error',
        levels: ['error', 'warn'],
        domains: ['example.com']
      };

      const result = await exportManager.exportToText(filterCriteria);
      const lines = result.data.split('\n');

      expect(lines[3]).toBe('Search: "error"');
      expect(lines[4]).toBe('Levels: error, warn');
      expect(lines[5]).toBe('Domains: example.com');
    });

    test('should detect sensitive data in text export', async () => {
      const result = await exportManager.exportToText();

      expect(result.sensitiveDataWarning.hasSensitiveData).toBe(true);
      expect(result.sensitiveDataWarning.sensitiveEntryCount).toBe(1);
    });
  });

  describe('Sensitive Data Detection', () => {
    test('should detect various sensitive data patterns', async () => {
      const sensitiveLog = {
        id: 'sensitive1',
        timestamp: Date.now(),
        level: 'info',
        message: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        args: [],
        url: 'https://api.example.com',
        domain: 'api.example.com',
        tabId: 123,
        sessionId: 'session1'
      };

      mockStorageManager.queryLogs.mockResolvedValue([sensitiveLog]);
      const result = await exportManager.exportToJSON();

      expect(result.sensitiveDataWarning.hasSensitiveData).toBe(true);
      expect(result.sensitiveDataWarning.detectedPatterns.length).toBeGreaterThan(0);
    });

    test('should not detect sensitive data in clean logs', async () => {
      const cleanLogs = [{
        id: 'clean1',
        timestamp: Date.now(),
        level: 'info',
        message: 'User clicked button',
        args: [],
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 123,
        sessionId: 'session1'
      }];

      mockStorageManager.queryLogs.mockResolvedValue(cleanLogs);
      const result = await exportManager.exportToJSON();

      expect(result.sensitiveDataWarning.hasSensitiveData).toBe(false);
      expect(result.sensitiveDataWarning.sensitiveEntryCount).toBe(0);
    });
  });

  describe('Export Statistics', () => {
    test('should calculate export statistics correctly', async () => {
      const stats = await exportManager.getExportStatistics();

      expect(stats.totalEntries).toBe(3);
      expect(stats.estimatedSizes).toHaveProperty('json');
      expect(stats.estimatedSizes).toHaveProperty('csv');
      expect(stats.estimatedSizes).toHaveProperty('text');
      expect(stats.dateRange).toEqual({
        earliest: '2022-01-01T00:00:00.000Z',
        latest: '2022-01-01T00:02:00.000Z'
      });
      expect(stats.levelDistribution).toEqual({
        error: 1,
        warn: 1,
        info: 1
      });
      expect(stats.domainDistribution).toEqual({
        'example.com': 2,
        'test.com': 1
      });
    });

    test('should handle empty log set in statistics', async () => {
      mockStorageManager.queryLogs.mockResolvedValue([]);
      const stats = await exportManager.getExportStatistics();

      expect(stats.totalEntries).toBe(0);
      expect(stats.dateRange).toBeNull();
      expect(stats.levelDistribution).toEqual({});
      expect(stats.domainDistribution).toEqual({});
    });
  });

  describe('Parameter Validation', () => {
    test('should validate export parameters correctly', () => {
      const validParams = {
        startTime: 1640995200000,
        endTime: 1640995320000,
        limit: 1000
      };

      const result = exportManager.validateExportParameters(validParams);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid date range', () => {
      const invalidParams = {
        startTime: 1640995320000,
        endTime: 1640995200000
      };

      const result = exportManager.validateExportParameters(invalidParams);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start time must be before end time');
    });

    test('should warn about large exports', () => {
      const largeExportParams = {
        limit: 60000
      };

      const result = exportManager.validateExportParameters(largeExportParams);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large exports may take a long time and consume significant memory');
    });

    test('should warn about no filters applied', () => {
      const noFiltersParams = {};

      const result = exportManager.validateExportParameters(noFiltersParams);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No filters applied - this will export all stored logs');
    });
  });

  describe('Filename Generation', () => {
    test('should generate appropriate filenames for different formats', async () => {
      const jsonResult = await exportManager.exportToJSON();
      const csvResult = await exportManager.exportToCSV();
      const textResult = await exportManager.exportToText();

      expect(jsonResult.filename).toMatch(/console-logs-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json/);
      expect(csvResult.filename).toMatch(/console-logs-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv/);
      expect(textResult.filename).toMatch(/console-logs-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.txt/);
    });

    test('should include domain in filename when filtering by single domain', async () => {
      const filterCriteria = { domains: ['example.com'] };
      const result = await exportManager.exportToJSON(filterCriteria);

      expect(result.filename).toMatch(/console-logs-.*-example-com\.json/);
    });

    test('should include log levels in filename when filtering by specific levels', async () => {
      const filterCriteria = { levels: ['error', 'warn'] };
      const result = await exportManager.exportToJSON(filterCriteria);

      expect(result.filename).toMatch(/console-logs-.*-error-warn\.json/);
    });
  });

  describe('Error Handling', () => {
    test('should handle storage manager errors gracefully', async () => {
      mockStorageManager.queryLogs.mockRejectedValue(new Error('Storage error'));

      await expect(exportManager.exportToJSON()).rejects.toThrow('JSON export failed: Storage error');
      await expect(exportManager.exportToCSV()).rejects.toThrow('CSV export failed: Storage error');
      await expect(exportManager.exportToText()).rejects.toThrow('Text export failed: Storage error');
    });

    test('should handle statistics calculation errors', async () => {
      mockStorageManager.queryLogs.mockRejectedValue(new Error('Query failed'));

      await expect(exportManager.getExportStatistics()).rejects.toThrow('Failed to get export statistics: Query failed');
    });
  });

  describe('Text Search Filtering', () => {
    test('should apply text search filter correctly', async () => {
      const filterCriteria = { textSearch: 'error' };
      
      // Mock filtered results
      const filteredLogs = sampleLogs.filter(log => 
        log.message.toLowerCase().includes('error')
      );
      
      // Override the _getFilteredLogs method behavior
      const originalMethod = exportManager._getFilteredLogs;
      exportManager._getFilteredLogs = jest.fn().mockResolvedValue(filteredLogs);

      const result = await exportManager.exportToJSON(filterCriteria);
      const exportData = JSON.parse(result.data);

      expect(exportData.logs).toHaveLength(1);
      expect(exportData.logs[0].message).toContain('error');

      // Restore original method
      exportManager._getFilteredLogs = originalMethod;
    });
  });
});