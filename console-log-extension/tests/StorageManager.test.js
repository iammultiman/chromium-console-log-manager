/**
 * Unit tests for StorageManager class
 * Tests IndexedDB operations, CRUD functionality, and error handling
 */

// Mock IndexedDB for testing environment
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Set up fake IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

const StorageManager = require('../models/StorageManager');

describe('StorageManager', () => {
  let storageManager;
  
  beforeEach(async () => {
    storageManager = new StorageManager();
    // Use a unique database name for each test
    storageManager.dbName = `TestDB_${Date.now()}_${Math.random()}`;
  });
  
  afterEach(async () => {
    if (storageManager) {
      storageManager.close();
    }
  });

  describe('Database Initialization', () => {
    test('should initialize database with correct schema', async () => {
      const db = await storageManager.initializeDatabase();
      
      expect(db).toBeDefined();
      expect(db.objectStoreNames.contains('logs')).toBe(true);
      expect(storageManager.db).toBe(db);
    });

    test('should create proper indexes', async () => {
      await storageManager.initializeDatabase();
      
      const transaction = storageManager.db.transaction(['logs'], 'readonly');
      const store = transaction.objectStore('logs');
      
      expect(store.indexNames.contains('timestamp')).toBe(true);
      expect(store.indexNames.contains('domain')).toBe(true);
      expect(store.indexNames.contains('level')).toBe(true);
      expect(store.indexNames.contains('sessionId')).toBe(true);
      expect(store.indexNames.contains('domainTimestamp')).toBe(true);
      expect(store.indexNames.contains('levelTimestamp')).toBe(true);
    });

    test('should handle database initialization errors', async () => {
      // Mock indexedDB.open to simulate error
      const originalOpen = global.indexedDB.open;
      global.indexedDB.open = jest.fn().mockImplementation(() => {
        const request = { onerror: null, onsuccess: null };
        setTimeout(() => {
          if (request.onerror) {
            request.error = new Error('Database error');
            request.onerror();
          }
        }, 0);
        return request;
      });

      await expect(storageManager.initializeDatabase()).rejects.toThrow('Failed to open database');
      
      // Restore original function
      global.indexedDB.open = originalOpen;
    });
  });

  describe('CRUD Operations', () => {
    const sampleLogEntry = {
      id: 'test-log-1',
      timestamp: Date.now(),
      level: 'info',
      message: 'Test log message',
      args: ['test', 'args'],
      url: 'https://example.com',
      domain: 'example.com',
      tabId: 123,
      sessionId: 'session-1'
    };

    beforeEach(async () => {
      await storageManager.initializeDatabase();
    });

    test('should save a single log entry', async () => {
      const savedId = await storageManager.saveLog(sampleLogEntry);
      
      expect(savedId).toBe(sampleLogEntry.id);
      
      const retrieved = await storageManager.getLog(sampleLogEntry.id);
      expect(retrieved).toEqual(sampleLogEntry);
    });

    test('should save multiple log entries in batch', async () => {
      const logEntries = [
        { ...sampleLogEntry, id: 'batch-1' },
        { ...sampleLogEntry, id: 'batch-2', level: 'error' },
        { ...sampleLogEntry, id: 'batch-3', domain: 'test.com' }
      ];
      
      const savedIds = await storageManager.saveLogs(logEntries);
      
      expect(savedIds).toHaveLength(3);
      expect(savedIds).toContain('batch-1');
      expect(savedIds).toContain('batch-2');
      expect(savedIds).toContain('batch-3');
    });

    test('should handle empty batch save', async () => {
      const savedIds = await storageManager.saveLogs([]);
      expect(savedIds).toEqual([]);
    });

    test('should retrieve log entry by ID', async () => {
      await storageManager.saveLog(sampleLogEntry);
      
      const retrieved = await storageManager.getLog(sampleLogEntry.id);
      expect(retrieved).toEqual(sampleLogEntry);
    });

    test('should return null for non-existent log entry', async () => {
      const retrieved = await storageManager.getLog('non-existent-id');
      expect(retrieved).toBeNull();
    });

    test('should update existing log entry', async () => {
      await storageManager.saveLog(sampleLogEntry);
      
      const updatedEntry = { ...sampleLogEntry, message: 'Updated message' };
      const updatedId = await storageManager.updateLog(updatedEntry);
      
      expect(updatedId).toBe(sampleLogEntry.id);
      
      const retrieved = await storageManager.getLog(sampleLogEntry.id);
      expect(retrieved.message).toBe('Updated message');
    });

    test('should delete log entry by ID', async () => {
      await storageManager.saveLog(sampleLogEntry);
      
      const deleted = await storageManager.deleteLog(sampleLogEntry.id);
      expect(deleted).toBe(true);
      
      const retrieved = await storageManager.getLog(sampleLogEntry.id);
      expect(retrieved).toBeNull();
    });

    test('should delete multiple log entries', async () => {
      const logEntries = [
        { ...sampleLogEntry, id: 'delete-1' },
        { ...sampleLogEntry, id: 'delete-2' },
        { ...sampleLogEntry, id: 'delete-3' }
      ];
      
      await storageManager.saveLogs(logEntries);
      
      const deletedCount = await storageManager.deleteLogs(['delete-1', 'delete-3']);
      expect(deletedCount).toBe(2);
      
      const remaining = await storageManager.getLog('delete-2');
      expect(remaining).toBeDefined();
    });
  }); 
 describe('Query Operations', () => {
    const testLogs = [
      {
        id: 'log-1',
        timestamp: 1000,
        level: 'info',
        message: 'Info message',
        domain: 'example.com',
        sessionId: 'session-1'
      },
      {
        id: 'log-2',
        timestamp: 2000,
        level: 'error',
        message: 'Error message',
        domain: 'example.com',
        sessionId: 'session-1'
      },
      {
        id: 'log-3',
        timestamp: 3000,
        level: 'info',
        message: 'Another info',
        domain: 'test.com',
        sessionId: 'session-2'
      }
    ];

    beforeEach(async () => {
      await storageManager.initializeDatabase();
      await storageManager.saveLogs(testLogs);
    });

    test('should query logs with level filter', async () => {
      const results = await storageManager.queryLogs({
        levels: ['info'],
        startTime: 0,
        endTime: 4000
      });
      
      expect(results).toHaveLength(2);
      expect(results.every(log => log.level === 'info')).toBe(true);
    });

    test('should query logs with domain filter', async () => {
      const results = await storageManager.queryLogs({
        domains: ['example.com'],
        startTime: 0,
        endTime: 4000
      });
      
      expect(results).toHaveLength(2);
      expect(results.every(log => log.domain === 'example.com')).toBe(true);
    });

    test('should query logs with time range', async () => {
      const results = await storageManager.queryLogs({
        startTime: 1500,
        endTime: 2500
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('log-2');
    });

    test('should apply limit and offset', async () => {
      const results = await storageManager.queryLogs({
        limit: 1,
        offset: 1,
        startTime: 0,
        endTime: 4000
      });
      
      expect(results).toHaveLength(1);
    });

    test('should get logs by domain', async () => {
      const results = await storageManager.getLogsByDomain('example.com');
      
      expect(results).toHaveLength(2);
      expect(results.every(log => log.domain === 'example.com')).toBe(true);
    });

    test('should get logs by domain with time range', async () => {
      const results = await storageManager.getLogsByDomain('example.com', 1500, 2500);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('log-2');
    });

    test('should get logs by session ID', async () => {
      const results = await storageManager.getLogsBySession('session-1');
      
      expect(results).toHaveLength(2);
      expect(results.every(log => log.sessionId === 'session-1')).toBe(true);
    });

    test('should delete logs by domain', async () => {
      const deletedCount = await storageManager.deleteLogsByDomain('example.com');
      
      expect(deletedCount).toBe(2);
      
      const remaining = await storageManager.queryLogs({ startTime: 0, endTime: 4000 });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].domain).toBe('test.com');
    });
  });

  describe('Utility Operations', () => {
    beforeEach(async () => {
      await storageManager.initializeDatabase();
    });

    test('should get total log count', async () => {
      const testLogs = [
        { id: 'count-1', timestamp: 1000, level: 'info', domain: 'test.com' },
        { id: 'count-2', timestamp: 2000, level: 'error', domain: 'test.com' },
        { id: 'count-3', timestamp: 3000, level: 'warn', domain: 'test.com' }
      ];
      
      await storageManager.saveLogs(testLogs);
      
      const count = await storageManager.getLogCount();
      expect(count).toBe(3);
    });

    test('should clear all logs', async () => {
      const testLogs = [
        { id: 'clear-1', timestamp: 1000, level: 'info', domain: 'test.com' },
        { id: 'clear-2', timestamp: 2000, level: 'error', domain: 'test.com' }
      ];
      
      await storageManager.saveLogs(testLogs);
      
      const cleared = await storageManager.clearAllLogs();
      expect(cleared).toBe(true);
      
      const count = await storageManager.getLogCount();
      expect(count).toBe(0);
    });

    test('should ensure database is initialized before operations', async () => {
      // Create new instance without initializing
      const newManager = new StorageManager();
      newManager.dbName = `EnsureTestDB_${Date.now()}`;
      
      // This should automatically initialize the database
      const testLog = { id: 'ensure-test', timestamp: 1000, level: 'info', domain: 'test.com' };
      await newManager.saveLog(testLog);
      
      const retrieved = await newManager.getLog('ensure-test');
      expect(retrieved).toEqual(testLog);
      
      newManager.close();
    });

    test('should close database connection', () => {
      storageManager.close();
      expect(storageManager.db).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await storageManager.initializeDatabase();
    });

    test('should handle save errors gracefully', async () => {
      // Mock transaction to simulate error
      const originalTransaction = storageManager.db.transaction;
      storageManager.db.transaction = jest.fn().mockImplementation(() => {
        const mockRequest = {
          onsuccess: null,
          onerror: null,
          error: new Error('Save failed')
        };
        
        const mockStore = {
          add: jest.fn().mockImplementation(() => {
            // Trigger error asynchronously
            setTimeout(() => {
              if (mockRequest.onerror) {
                mockRequest.onerror();
              }
            }, 0);
            return mockRequest;
          })
        };
        
        return { objectStore: () => mockStore };
      });

      const testLog = { id: 'error-test', timestamp: 1000, level: 'info', domain: 'test.com' };
      
      await expect(storageManager.saveLog(testLog)).rejects.toThrow('Failed to save log entry');
      
      // Restore original function
      storageManager.db.transaction = originalTransaction;
    });

    test('should handle query errors gracefully', async () => {
      // Mock transaction to simulate error
      const originalTransaction = storageManager.db.transaction;
      storageManager.db.transaction = jest.fn().mockImplementation(() => {
        const mockRequest = {
          onsuccess: null,
          onerror: null,
          error: new Error('Query failed')
        };
        
        const mockIndex = {
          openCursor: jest.fn().mockImplementation(() => {
            // Trigger error asynchronously
            setTimeout(() => {
              if (mockRequest.onerror) {
                mockRequest.onerror();
              }
            }, 0);
            return mockRequest;
          })
        };
        
        const mockStore = {
          index: () => mockIndex
        };
        
        return { objectStore: () => mockStore };
      });

      await expect(storageManager.queryLogs()).rejects.toThrow('Failed to query logs');
      
      // Restore original function
      storageManager.db.transaction = originalTransaction;
    });
  });
});