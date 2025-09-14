/**
 * Unit tests for storage cleanup and retention policies
 * Tests cleanup functionality, retention policies, and scheduler operations
 */

// Mock IndexedDB for testing environment
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Set up fake IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

// Mock navigator.storage for quota tests
global.navigator = {
  storage: {
    estimate: jest.fn().mockResolvedValue({
      quota: 1024 * 1024 * 1024, // 1GB
      usage: 512 * 1024 * 1024   // 512MB
    })
  }
};

const StorageManager = require('../models/StorageManager');
const CleanupScheduler = require('../models/CleanupScheduler');

describe('Storage Cleanup and Retention', () => {
  let storageManager;
  
  beforeEach(async () => {
    storageManager = new StorageManager();
    storageManager.dbName = `CleanupTestDB_${Date.now()}_${Math.random()}`;
    await storageManager.initializeDatabase();
  });
  
  afterEach(async () => {
    if (storageManager) {
      storageManager.close();
    }
  });

  describe('Storage Usage Calculation', () => {
    test('should calculate storage usage correctly', async () => {
      const testLogs = [
        {
          id: 'usage-1',
          timestamp: 1000,
          level: 'info',
          message: 'Test message 1',
          url: 'https://example.com',
          domain: 'example.com'
        },
        {
          id: 'usage-2',
          timestamp: 2000,
          level: 'error',
          message: 'Test message 2',
          url: 'https://example.com',
          domain: 'example.com'
        },
        {
          id: 'usage-3',
          timestamp: 3000,
          level: 'warn',
          message: 'Test message 3',
          url: 'https://test.com',
          domain: 'test.com'
        }
      ];
      
      await storageManager.saveLogs(testLogs);
      
      const usage = await storageManager.calculateStorageUsage();
      
      expect(usage.entryCount).toBe(3);
      expect(usage.totalSizeBytes).toBeGreaterThan(0);
      expect(usage.totalSizeMB).toBeGreaterThanOrEqual(0);
      expect(usage.averageEntrySize).toBeGreaterThan(0);
      expect(Object.keys(usage.domainSizes)).toContain('example.com');
      expect(Object.keys(usage.domainSizes)).toContain('test.com');
      expect(usage.domainSizes['example.com'].count).toBe(2);
      expect(usage.domainSizes['test.com'].count).toBe(1);
    });

    test('should handle empty database for usage calculation', async () => {
      const usage = await storageManager.calculateStorageUsage();
      
      expect(usage.entryCount).toBe(0);
      expect(usage.totalSizeBytes).toBe(0);
      expect(usage.totalSizeMB).toBe(0);
      expect(usage.averageEntrySize).toBe(0);
      expect(Object.keys(usage.domainSizes)).toHaveLength(0);
    });
  });

  describe('Age-based Cleanup', () => {
    test('should clean up logs older than specified age', async () => {
      const now = Date.now();
      const testLogs = [
        {
          id: 'old-1',
          timestamp: now - (2 * 24 * 60 * 60 * 1000), // 2 days old
          level: 'info',
          message: 'Old log 1',
          domain: 'example.com'
        },
        {
          id: 'old-2',
          timestamp: now - (3 * 24 * 60 * 60 * 1000), // 3 days old
          level: 'error',
          message: 'Old log 2',
          domain: 'example.com'
        },
        {
          id: 'recent-1',
          timestamp: now - (12 * 60 * 60 * 1000), // 12 hours old
          level: 'info',
          message: 'Recent log',
          domain: 'example.com'
        }
      ];
      
      await storageManager.saveLogs(testLogs);
      
      // Clean up logs older than 1 day
      const maxAge = 24 * 60 * 60 * 1000; // 1 day
      const deletedCount = await storageManager.cleanupByAge(maxAge);
      
      expect(deletedCount).toBe(2);
      
      const remaining = await storageManager.queryLogs({ startTime: 0, endTime: Date.now() });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('recent-1');
    });

    test('should not delete logs if none are old enough', async () => {
      const now = Date.now();
      const testLogs = [
        {
          id: 'recent-1',
          timestamp: now - (12 * 60 * 60 * 1000), // 12 hours old
          level: 'info',
          message: 'Recent log 1',
          domain: 'example.com'
        },
        {
          id: 'recent-2',
          timestamp: now - (6 * 60 * 60 * 1000), // 6 hours old
          level: 'error',
          message: 'Recent log 2',
          domain: 'example.com'
        }
      ];
      
      await storageManager.saveLogs(testLogs);
      
      // Try to clean up logs older than 2 days
      const maxAge = 2 * 24 * 60 * 60 * 1000; // 2 days
      const deletedCount = await storageManager.cleanupByAge(maxAge);
      
      expect(deletedCount).toBe(0);
      
      const remaining = await storageManager.queryLogs({ startTime: 0, endTime: Date.now() });
      expect(remaining).toHaveLength(2);
    });
  });

  describe('Size-based Cleanup', () => {
    test('should clean up oldest logs when size limit exceeded', async () => {
      const testLogs = [];
      for (let i = 0; i < 10; i++) {
        testLogs.push({
          id: `size-test-${i}`,
          timestamp: 1000 + i,
          level: 'info',
          message: `Test message ${i}`.repeat(100), // Make messages larger
          domain: 'example.com'
        });
      }
      
      await storageManager.saveLogs(testLogs);
      
      const initialUsage = await storageManager.calculateStorageUsage();
      const targetSize = Math.floor(initialUsage.totalSizeBytes * 0.5); // Keep only 50%
      
      const deletedCount = await storageManager.cleanupBySize(targetSize);
      
      expect(deletedCount).toBeGreaterThan(0);
      
      const finalUsage = await storageManager.calculateStorageUsage();
      expect(finalUsage.totalSizeBytes).toBeLessThanOrEqual(targetSize);
    });

    test('should not delete logs if size is within limit', async () => {
      const testLogs = [
        {
          id: 'small-1',
          timestamp: 1000,
          level: 'info',
          message: 'Small message',
          domain: 'example.com'
        }
      ];
      
      await storageManager.saveLogs(testLogs);
      
      const usage = await storageManager.calculateStorageUsage();
      const largeLimit = usage.totalSizeBytes * 2; // Set limit to double current size
      
      const deletedCount = await storageManager.cleanupBySize(largeLimit);
      
      expect(deletedCount).toBe(0);
    });
  });

  describe('Count-based Cleanup', () => {
    test('should clean up oldest logs when count limit exceeded', async () => {
      const testLogs = [];
      for (let i = 0; i < 10; i++) {
        testLogs.push({
          id: `count-test-${i}`,
          timestamp: 1000 + i,
          level: 'info',
          message: `Test message ${i}`,
          domain: 'example.com'
        });
      }
      
      await storageManager.saveLogs(testLogs);
      
      const maxEntries = 5;
      const deletedCount = await storageManager.cleanupByCount(maxEntries);
      
      expect(deletedCount).toBe(5);
      
      const remaining = await storageManager.queryLogs({ startTime: 0, endTime: Date.now() });
      expect(remaining).toHaveLength(5);
      
      // Verify that the newest entries were kept
      const newestIds = remaining.map(log => log.id).sort();
      expect(newestIds).toEqual(['count-test-5', 'count-test-6', 'count-test-7', 'count-test-8', 'count-test-9']);
    });

    test('should not delete logs if count is within limit', async () => {
      const testLogs = [
        {
          id: 'count-small-1',
          timestamp: 1000,
          level: 'info',
          message: 'Test message',
          domain: 'example.com'
        }
      ];
      
      await storageManager.saveLogs(testLogs);
      
      const deletedCount = await storageManager.cleanupByCount(10);
      
      expect(deletedCount).toBe(0);
    });
  });

  describe('Comprehensive Cleanup', () => {
    test('should perform comprehensive cleanup with all policies', async () => {
      const now = Date.now();
      const testLogs = [];
      
      // Create a mix of old and new logs
      for (let i = 0; i < 20; i++) {
        testLogs.push({
          id: `comprehensive-${i}`,
          timestamp: now - (i * 60 * 60 * 1000), // Each log 1 hour older
          level: 'info',
          message: `Test message ${i}`.repeat(50),
          domain: 'example.com'
        });
      }
      
      await storageManager.saveLogs(testLogs);
      
      const retentionPolicy = {
        maxAgeMs: 10 * 60 * 60 * 1000, // 10 hours
        maxSizeBytes: null, // Will be set based on current usage
        maxEntries: 8
      };
      
      const initialUsage = await storageManager.calculateStorageUsage();
      retentionPolicy.maxSizeBytes = Math.floor(initialUsage.totalSizeBytes * 0.6);
      
      const results = await storageManager.performCleanup(retentionPolicy);
      
      expect(results.totalDeleted).toBeGreaterThan(0);
      expect(results.finalUsage.entryCount).toBeLessThanOrEqual(8);
      expect(results.finalUsage.totalSizeBytes).toBeLessThanOrEqual(retentionPolicy.maxSizeBytes);
    });

    test('should handle cleanup with no policies set', async () => {
      const testLogs = [
        {
          id: 'no-policy-1',
          timestamp: Date.now(),
          level: 'info',
          message: 'Test message',
          domain: 'example.com'
        }
      ];
      
      await storageManager.saveLogs(testLogs);
      
      const results = await storageManager.performCleanup({});
      
      expect(results.totalDeleted).toBe(0);
      expect(results.finalUsage.entryCount).toBe(1);
    });
  });

  describe('Storage Quota and Status', () => {
    test('should get storage quota information', async () => {
      const quota = await storageManager.getStorageQuota();
      
      expect(quota).toHaveProperty('quota');
      expect(quota).toHaveProperty('usage');
      expect(quota).toHaveProperty('available');
      expect(quota).toHaveProperty('usagePercentage');
      
      // With our mock, these should have values
      expect(quota.quota).toBe(1024 * 1024 * 1024);
      expect(quota.usage).toBe(512 * 1024 * 1024);
      expect(quota.usagePercentage).toBe(50);
    });

    test('should check storage status and warnings', async () => {
      const status = await storageManager.checkStorageStatus(40); // Low threshold for testing
      
      expect(status).toHaveProperty('extensionUsage');
      expect(status).toHaveProperty('browserQuota');
      expect(status).toHaveProperty('needsCleanup');
      expect(status).toHaveProperty('warningLevel');
      
      // With 50% usage and 40% threshold, should trigger warning
      expect(status.needsCleanup).toBe(true);
      expect(status.warningLevel).toBe('warning');
    });

    test('should provide cleanup recommendations', async () => {
      // Create many logs to trigger recommendations
      const testLogs = [];
      for (let i = 0; i < 100; i++) {
        testLogs.push({
          id: `rec-${i}`,
          timestamp: Date.now() - i,
          level: 'info',
          message: `Test message ${i}`.repeat(100),
          domain: i < 50 ? 'example.com' : 'test.com'
        });
      }
      
      await storageManager.saveLogs(testLogs);
      
      const recommendations = await storageManager.getCleanupRecommendations();
      
      expect(recommendations).toHaveProperty('shouldCleanup');
      expect(recommendations).toHaveProperty('reasons');
      expect(recommendations).toHaveProperty('suggestedActions');
      expect(Array.isArray(recommendations.reasons)).toBe(true);
      expect(Array.isArray(recommendations.suggestedActions)).toBe(true);
    });
  });

  describe('CleanupScheduler', () => {
    let scheduler;
    
    beforeEach(() => {
      scheduler = new CleanupScheduler(storageManager);
    });
    
    afterEach(() => {
      if (scheduler) {
        scheduler.stop();
      }
    });

    test('should create scheduler with storage manager', () => {
      expect(scheduler.storageManager).toBe(storageManager);
      expect(scheduler.isRunning).toBe(false);
    });

    test('should start and stop scheduler', () => {
      const retentionPolicy = CleanupScheduler.createRetentionPolicy('balanced');
      
      scheduler.start(1000, retentionPolicy); // 1 second interval for testing
      
      expect(scheduler.isRunning).toBe(true);
      expect(scheduler.intervalId).not.toBeNull();
      
      scheduler.stop();
      
      expect(scheduler.isRunning).toBe(false);
      expect(scheduler.intervalId).toBeNull();
    });

    test('should update retention policy', () => {
      const newPolicy = { maxAgeMs: 1000, maxSizeBytes: 2000, maxEntries: 100 };
      
      scheduler.updateRetentionPolicy(newPolicy);
      
      expect(scheduler.retentionPolicy).toEqual(newPolicy);
    });

    test('should get scheduler status', () => {
      const retentionPolicy = CleanupScheduler.createRetentionPolicy('aggressive');
      scheduler.start(5000, retentionPolicy);
      
      const status = scheduler.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.retentionPolicy).toEqual(retentionPolicy);
      expect(status.intervalMs).toBe(scheduler.defaultInterval);
      
      scheduler.stop();
    });

    test('should create different retention policy profiles', () => {
      const conservative = CleanupScheduler.createRetentionPolicy('conservative');
      const balanced = CleanupScheduler.createRetentionPolicy('balanced');
      const aggressive = CleanupScheduler.createRetentionPolicy('aggressive');
      
      expect(conservative.maxAgeMs).toBeGreaterThan(balanced.maxAgeMs);
      expect(balanced.maxAgeMs).toBeGreaterThan(aggressive.maxAgeMs);
      
      expect(conservative.maxSizeBytes).toBeGreaterThan(balanced.maxSizeBytes);
      expect(balanced.maxSizeBytes).toBeGreaterThan(aggressive.maxSizeBytes);
      
      expect(conservative.maxEntries).toBeGreaterThan(balanced.maxEntries);
      expect(balanced.maxEntries).toBeGreaterThan(aggressive.maxEntries);
    });

    test('should validate retention policies', () => {
      const validPolicy = {
        maxAgeMs: 7 * 24 * 60 * 60 * 1000,
        maxSizeBytes: 100 * 1024 * 1024,
        maxEntries: 10000
      };
      
      const invalidPolicy = {
        maxAgeMs: -1000,
        maxSizeBytes: 'invalid',
        maxEntries: 0
      };
      
      const validResult = CleanupScheduler.validateRetentionPolicy(validPolicy);
      const invalidResult = CleanupScheduler.validateRetentionPolicy(invalidPolicy);
      
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test('should perform immediate cleanup', async () => {
      const testLogs = [];
      for (let i = 0; i < 10; i++) {
        testLogs.push({
          id: `immediate-${i}`,
          timestamp: Date.now() - (i * 1000),
          level: 'info',
          message: `Test message ${i}`,
          domain: 'example.com'
        });
      }
      
      await storageManager.saveLogs(testLogs);
      
      scheduler.updateRetentionPolicy({ maxEntries: 5 });
      
      const results = await scheduler.performImmediateCleanup();
      
      expect(results.totalDeleted).toBe(5);
      expect(results.finalUsage.entryCount).toBe(5);
    });
  });

  describe('Error Handling', () => {
    test('should handle cleanup errors gracefully', async () => {
      // Mock database error
      const originalTransaction = storageManager.db.transaction;
      storageManager.db.transaction = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(storageManager.cleanupByAge(1000)).rejects.toThrow();
      
      // Restore original function
      storageManager.db.transaction = originalTransaction;
    });

    test('should handle storage quota estimation errors', async () => {
      // Mock navigator.storage.estimate to throw error
      const originalEstimate = global.navigator.storage.estimate;
      global.navigator.storage.estimate = jest.fn().mockRejectedValue(new Error('Quota error'));

      const quota = await storageManager.getStorageQuota();
      
      expect(quota.quota).toBeNull();
      expect(quota.usage).toBeNull();
      
      // Restore original function
      global.navigator.storage.estimate = originalEstimate;
    });
  });
});