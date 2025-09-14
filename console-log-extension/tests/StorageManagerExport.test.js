/**
 * Tests for StorageManager export functionality
 * Tests the export methods added to StorageManager class
 */

// Mock IndexedDB for testing
const mockDB = {
  transaction: jest.fn(),
  close: jest.fn()
};

const mockTransaction = {
  objectStore: jest.fn()
};

const mockStore = {
  index: jest.fn(),
  openCursor: jest.fn(),
  getAll: jest.fn(),
  add: jest.fn(),
  get: jest.fn(),
  count: jest.fn()
};

const mockIndex = {
  openCursor: jest.fn(),
  getAll: jest.fn()
};

global.indexedDB = {
  open: jest.fn(() => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: mockDB
  }))
};

const StorageManager = require('../models/StorageManager');

describe('StorageManager Export Methods', () => {
  let storageManager;
  let sampleLogs;

  beforeEach(() => {
    storageManager = new StorageManager();
    storageManager.db = mockDB;

    // Sample log data
    sampleLogs = [
      {
        id: 'log1',
        timestamp: 1640995200000,
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
        timestamp: 1640995260000,
        level: 'warn',
        message: 'Warning message with "quotes" and, commas',
        args: ['warning'],
        url: 'https://test.com/api',
        domain: 'test.com',
        tabId: 124,
        sessionId: 'session2',
        metadata: {}
      }
    ];

    // Setup mocks
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockStore);
    mockStore.index.mockReturnValue(mockIndex);

    // Mock queryLogs to return sample data
    jest.spyOn(storageManager, 'queryLogs').mockResolvedValue(sampleLogs);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportLogsAsJSON', () => {
    test('should export logs in JSON format with metadata', async () => {
      const result = await storageManager.exportLogsAsJSON();
      const exportData = JSON.parse(result);

      expect(exportData.metadata).toEqual({
        exportDate: expect.any(String),
        totalEntries: 2,
        format: 'JSON',
        filters: {},
        version: '1.0'
      });

      expect(exportData.logs).toHaveLength(2);
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

    test('should include filter criteria in JSON export', async () => {
      const filterCriteria = { levels: ['error'], domains: ['example.com'] };
      const result = await storageManager.exportLogsAsJSON(filterCriteria);
      const exportData = JSON.parse(result);

      expect(exportData.metadata.filters).toEqual(filterCriteria);
      expect(storageManager.queryLogs).toHaveBeenCalledWith(filterCriteria);
    });

    test('should handle empty logs array', async () => {
      storageManager.queryLogs.mockResolvedValue([]);
      const result = await storageManager.exportLogsAsJSON();
      const exportData = JSON.parse(result);

      expect(exportData.metadata.totalEntries).toBe(0);
      expect(exportData.logs).toHaveLength(0);
    });
  });

  describe('exportLogsAsCSV', () => {
    test('should export logs in CSV format with proper headers', async () => {
      const result = await storageManager.exportLogsAsCSV();
      const lines = result.split('\n');

      // Check headers
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

      // Check data rows
      expect(lines).toHaveLength(3); // Header + 2 data rows
      
      const firstDataRow = lines[1].split(',');
      expect(firstDataRow[0]).toBe('log1');
      expect(firstDataRow[1]).toBe('1640995200000');
      expect(firstDataRow[2]).toBe('2022-01-01T00:00:00.000Z');
      expect(firstDataRow[3]).toBe('error');
    });

    test('should properly escape CSV values with special characters', async () => {
      const result = await storageManager.exportLogsAsCSV();
      const lines = result.split('\n');
      
      // Second row should have escaped message with quotes and commas
      const secondDataRow = lines[2];
      expect(secondDataRow).toContain('"Warning message with ""quotes"" and, commas"');
    });

    test('should handle empty logs array', async () => {
      storageManager.queryLogs.mockResolvedValue([]);
      const result = await storageManager.exportLogsAsCSV();
      const lines = result.split('\n');

      expect(lines).toHaveLength(1); // Only headers
    });

    test('should pass filter criteria to queryLogs', async () => {
      const filterCriteria = { levels: ['warn'] };
      await storageManager.exportLogsAsCSV(filterCriteria);

      expect(storageManager.queryLogs).toHaveBeenCalledWith(filterCriteria);
    });
  });

  describe('exportLogsAsText', () => {
    test('should export logs in plain text format with header', async () => {
      const result = await storageManager.exportLogsAsText();
      const lines = result.split('\n');

      // Check header
      expect(lines[0]).toBe('Console Log Export');
      expect(lines[1]).toMatch(/Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(lines[2]).toBe('Total Entries: 2');

      // Check log entries (after header and empty line)
      const logLines = lines.slice(5);
      expect(logLines.length).toBeGreaterThan(0);
      
      // Check that expected log entries are present (order may vary)
      const logContent = logLines.join('\n');
      expect(logContent).toContain('[WARN] [test.com] Warning message with "quotes" and, commas');
    });

    test('should include filter information in header when filters are applied', async () => {
      const filterCriteria = {
        textSearch: 'error',
        levels: ['error', 'warn'],
        domains: ['example.com']
      };

      const result = await storageManager.exportLogsAsText(filterCriteria);
      const lines = result.split('\n');

      expect(lines[3]).toBe('Search: "error"');
      expect(lines[4]).toBe('Levels: error, warn');
      expect(lines[5]).toBe('Domains: example.com');
    });

    test('should not include filter lines when no filters are applied', async () => {
      const result = await storageManager.exportLogsAsText({});
      const lines = result.split('\n');

      // Should only have basic header without filter lines
      expect(lines[3]).toBe('');
      
      // Check that log entries are present (order may vary)
      const logContent = lines.slice(4).join('\n');
      expect(logContent.length).toBeGreaterThan(0);
    });

    test('should handle empty logs array', async () => {
      storageManager.queryLogs.mockResolvedValue([]);
      const result = await storageManager.exportLogsAsText();
      const lines = result.split('\n');

      expect(lines[2]).toBe('Total Entries: 0');
      expect(lines.slice(4)).toEqual(['']); // Only empty line after header
    });

    test('should pass filter criteria to queryLogs', async () => {
      const filterCriteria = { domains: ['test.com'] };
      await storageManager.exportLogsAsText(filterCriteria);

      expect(storageManager.queryLogs).toHaveBeenCalledWith(filterCriteria);
    });
  });

  describe('_escapeCsvValue', () => {
    test('should escape values with commas', () => {
      const result = storageManager._escapeCsvValue('value, with comma');
      expect(result).toBe('"value, with comma"');
    });

    test('should escape values with quotes', () => {
      const result = storageManager._escapeCsvValue('value with "quotes"');
      expect(result).toBe('"value with ""quotes"""');
    });

    test('should escape values with newlines', () => {
      const result = storageManager._escapeCsvValue('value\nwith\nnewlines');
      expect(result).toBe('"value\nwith\nnewlines"');
    });

    test('should not escape simple values', () => {
      const result = storageManager._escapeCsvValue('simple value');
      expect(result).toBe('simple value');
    });

    test('should handle non-string values', () => {
      const result = storageManager._escapeCsvValue(123);
      expect(result).toBe('123');
    });

    test('should handle null and undefined values', () => {
      expect(storageManager._escapeCsvValue(null)).toBe('null');
      expect(storageManager._escapeCsvValue(undefined)).toBe('undefined');
    });
  });

  describe('Error Handling', () => {
    test('should handle queryLogs errors in JSON export', async () => {
      storageManager.queryLogs.mockRejectedValue(new Error('Query failed'));

      await expect(storageManager.exportLogsAsJSON()).rejects.toThrow('Query failed');
    });

    test('should handle queryLogs errors in CSV export', async () => {
      storageManager.queryLogs.mockRejectedValue(new Error('Query failed'));

      await expect(storageManager.exportLogsAsCSV()).rejects.toThrow('Query failed');
    });

    test('should handle queryLogs errors in text export', async () => {
      storageManager.queryLogs.mockRejectedValue(new Error('Query failed'));

      await expect(storageManager.exportLogsAsText()).rejects.toThrow('Query failed');
    });
  });

  describe('Integration with queryLogs', () => {
    test('should use default filter criteria when none provided', async () => {
      await storageManager.exportLogsAsJSON();
      expect(storageManager.queryLogs).toHaveBeenCalledWith({});

      await storageManager.exportLogsAsCSV();
      expect(storageManager.queryLogs).toHaveBeenCalledWith({});

      await storageManager.exportLogsAsText();
      expect(storageManager.queryLogs).toHaveBeenCalledWith({});
    });

    test('should pass through complex filter criteria', async () => {
      const complexFilter = {
        levels: ['error', 'warn'],
        domains: ['example.com', 'test.com'],
        startTime: 1640995200000,
        endTime: 1640995320000,
        limit: 500,
        offset: 10
      };

      await storageManager.exportLogsAsJSON(complexFilter);
      expect(storageManager.queryLogs).toHaveBeenCalledWith(complexFilter);

      await storageManager.exportLogsAsCSV(complexFilter);
      expect(storageManager.queryLogs).toHaveBeenCalledWith(complexFilter);

      await storageManager.exportLogsAsText(complexFilter);
      expect(storageManager.queryLogs).toHaveBeenCalledWith(complexFilter);
    });
  });
});