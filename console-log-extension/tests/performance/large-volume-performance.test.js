/**
 * Large Volume Performance Tests
 * Tests extension performance with large numbers of log entries
 */

const { JSDOM } = require('jsdom');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue()
    },
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue()
    }
  }
};

// Setup IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

describe('Large Volume Performance Tests', () => {
  let StorageManager;
  let LogEntry;
  let FilterCriteria;

  beforeEach(async () => {
    StorageManager = require('../../models/StorageManager');
    LogEntry = require('../../models/LogEntry');
    FilterCriteria = require('../../models/FilterCriteria');

    await StorageManager.initialize();
    jest.clearAllMocks();
  });

  test('bulk log insertion performance', async () => {
    const logCount = 10000;
    const batchSize = 1000;
    
    console.log(`Testing bulk insertion of ${logCount} logs in batches of ${batchSize}`);
    
    const startTime = performance.now();
    
    for (let batch = 0; batch < logCount / batchSize; batch++) {
      const logs = [];
      
      for (let i = 0; i < batchSize; i++) {
        const logIndex = batch * batchSize + i;
        const log = new LogEntry(
          'log',
          `Performance test log ${logIndex}`,
          [`Performance test log ${logIndex}`],
          `https://example${logIndex % 10}.com`,
          logIndex % 5 + 1
        );
        logs.push(log);
      }
      
      await StorageManager.saveLogs(logs);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const logsPerSecond = logCount / (totalTime / 1000);
    
    console.log(`Inserted ${logCount} logs in ${totalTime.toFixed(2)}ms`);
    console.log(`Performance: ${logsPerSecond.toFixed(2)} logs/second`);
    
    // Performance assertions
    expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
    expect(logsPerSecond).toBeGreaterThan(100); // Should handle at least 100 logs/second
    
    // Verify all logs were stored
    const allLogs = await StorageManager.queryLogs({});
    expect(allLogs.logs.length).toBe(logCount);
  });

  test('large dataset query performance', async () => {
    const logCount = 5000;
    
    // Insert test data
    const logs = Array.from({ length: logCount }, (_, i) => {
      const domains = ['example.com', 'test.com', 'demo.com', 'sample.com'];
      const levels = ['log', 'error', 'warn', 'info'];
      
      return new LogEntry(
        levels[i % levels.length],
        `Query test log ${i} with keyword ${i % 100}`,
        [`Query test log ${i} with keyword ${i % 100}`],
        `https://${domains[i % domains.length]}/page${i}`,
        (i % 10) + 1
      );
    });
    
    await StorageManager.saveLogs(logs);
    
    // Test various query scenarios
    const queryTests = [
      {
        name: 'All logs query',
        filter: {},
        expectedMin: logCount
      },
      {
        name: 'Level filter query',
        filter: { levels: ['error'] },
        expectedMin: logCount / 4 * 0.8 // Approximately 1/4 of logs
      },
      {
        name: 'Domain filter query',
        filter: { domains: ['example.com'] },
        expectedMin: logCount / 4 * 0.8 // Approximately 1/4 of logs
      },
      {
        name: 'Text search query',
        filter: { textSearch: 'keyword 50' },
        expectedMin: 1
      },
      {
        name: 'Combined filter query',
        filter: { 
          levels: ['log', 'error'], 
          domains: ['example.com', 'test.com'],
          textSearch: 'test'
        },
        expectedMin: 1
      }
    ];
    
    for (const test of queryTests) {
      const startTime = performance.now();
      const results = await StorageManager.queryLogs(test.filter);
      const endTime = performance.now();
      const queryTime = endTime - startTime;
      
      console.log(`${test.name}: ${queryTime.toFixed(2)}ms, ${results.logs.length} results`);
      
      // Performance assertions
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
      expect(results.logs.length).toBeGreaterThanOrEqual(test.expectedMin);
    }
  });

  test('pagination performance with large datasets', async () => {
    const logCount = 3000;
    const pageSize = 50;
    
    // Insert test data
    const logs = Array.from({ length: logCount }, (_, i) => 
      new LogEntry(
        'log',
        `Pagination test log ${i}`,
        [`Pagination test log ${i}`],
        'https://example.com',
        1
      )
    );
    
    await StorageManager.saveLogs(logs);
    
    // Test pagination performance
    const totalPages = Math.ceil(logCount / pageSize);
    const pageTimes = [];
    
    for (let page = 0; page < Math.min(totalPages, 10); page++) { // Test first 10 pages
      const startTime = performance.now();
      
      const results = await StorageManager.queryLogs({
        offset: page * pageSize,
        limit: pageSize
      });
      
      const endTime = performance.now();
      const pageTime = endTime - startTime;
      pageTimes.push(pageTime);
      
      expect(results.logs.length).toBeLessThanOrEqual(pageSize);
      expect(pageTime).toBeLessThan(500); // Each page should load within 500ms
    }
    
    const avgPageTime = pageTimes.reduce((sum, time) => sum + time, 0) / pageTimes.length;
    console.log(`Average page load time: ${avgPageTime.toFixed(2)}ms`);
    
    expect(avgPageTime).toBeLessThan(200); // Average should be under 200ms
  });

  test('memory usage with large datasets', async () => {
    const logCount = 2000;
    
    // Measure initial memory (approximate)
    const initialMemory = process.memoryUsage();
    
    // Insert large dataset
    const logs = Array.from({ length: logCount }, (_, i) => {
      const largeMessage = `Memory test log ${i} `.repeat(100); // ~2KB per log
      return new LogEntry(
        'log',
        largeMessage,
        [largeMessage],
        'https://example.com',
        1
      );
    });
    
    await StorageManager.saveLogs(logs);
    
    // Query all data
    const results = await StorageManager.queryLogs({});
    
    // Measure memory after operations
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryPerLog = memoryIncrease / logCount;
    
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory per log: ${(memoryPerLog / 1024).toFixed(2)}KB`);
    
    // Memory assertions
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Should use less than 100MB
    expect(memoryPerLog).toBeLessThan(10 * 1024); // Should use less than 10KB per log
    expect(results.logs.length).toBe(logCount);
  });

  test('concurrent operations performance', async () => {
    const concurrentOperations = 10;
    const logsPerOperation = 500;
    
    console.log(`Testing ${concurrentOperations} concurrent operations with ${logsPerOperation} logs each`);
    
    const startTime = performance.now();
    
    // Create concurrent save operations
    const savePromises = Array.from({ length: concurrentOperations }, (_, opIndex) => {
      const logs = Array.from({ length: logsPerOperation }, (_, logIndex) => {
        const globalIndex = opIndex * logsPerOperation + logIndex;
        return new LogEntry(
          'log',
          `Concurrent test log ${globalIndex}`,
          [`Concurrent test log ${globalIndex}`],
          `https://example${opIndex}.com`,
          opIndex + 1
        );
      });
      
      return StorageManager.saveLogs(logs);
    });
    
    // Wait for all operations to complete
    await Promise.all(savePromises);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const totalLogs = concurrentOperations * logsPerOperation;
    const logsPerSecond = totalLogs / (totalTime / 1000);
    
    console.log(`Concurrent operations completed in ${totalTime.toFixed(2)}ms`);
    console.log(`Performance: ${logsPerSecond.toFixed(2)} logs/second`);
    
    // Performance assertions
    expect(totalTime).toBeLessThan(20000); // Should complete within 20 seconds
    expect(logsPerSecond).toBeGreaterThan(50); // Should handle at least 50 logs/second
    
    // Verify data integrity
    const allLogs = await StorageManager.queryLogs({});
    expect(allLogs.logs.length).toBe(totalLogs);
  });

  test('search performance with large text content', async () => {
    const logCount = 1000;
    const searchTerms = ['error', 'warning', 'success', 'failure', 'timeout'];
    
    // Create logs with varying text content sizes
    const logs = Array.from({ length: logCount }, (_, i) => {
      const baseMessage = `Search performance test log ${i}`;
      const searchTerm = searchTerms[i % searchTerms.length];
      const padding = ' '.repeat(Math.random() * 1000); // Variable padding
      const message = `${baseMessage} ${searchTerm} ${padding}`;
      
      return new LogEntry(
        'log',
        message,
        [message],
        'https://example.com',
        1
      );
    });
    
    await StorageManager.saveLogs(logs);
    
    // Test search performance for each term
    for (const term of searchTerms) {
      const startTime = performance.now();
      const results = await StorageManager.queryLogs({ textSearch: term });
      const endTime = performance.now();
      const searchTime = endTime - startTime;
      
      console.log(`Search for "${term}": ${searchTime.toFixed(2)}ms, ${results.logs.length} results`);
      
      expect(searchTime).toBeLessThan(1000); // Should complete within 1 second
      expect(results.logs.length).toBeGreaterThan(0);
      expect(results.logs.every(log => 
        log.message.toLowerCase().includes(term.toLowerCase())
      )).toBe(true);
    }
  });

  test('cleanup performance with large datasets', async () => {
    const logCount = 5000;
    const retentionDays = 7;
    
    // Create logs with different ages
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    const logs = Array.from({ length: logCount }, (_, i) => {
      const log = new LogEntry(
        'log',
        `Cleanup test log ${i}`,
        [`Cleanup test log ${i}`],
        'https://example.com',
        1
      );
      
      // Set timestamps to create old and new logs
      const daysOld = Math.floor(i / (logCount / 20)); // 0-19 days old
      log.timestamp = now - (daysOld * dayMs);
      
      return log;
    });
    
    await StorageManager.saveLogs(logs);
    
    // Perform cleanup
    const CleanupScheduler = require('../../models/CleanupScheduler');
    const scheduler = new CleanupScheduler();
    
    const startTime = performance.now();
    await scheduler.performCleanup({ retentionDays });
    const endTime = performance.now();
    const cleanupTime = endTime - startTime;
    
    console.log(`Cleanup completed in ${cleanupTime.toFixed(2)}ms`);
    
    // Verify cleanup performance and results
    expect(cleanupTime).toBeLessThan(5000); // Should complete within 5 seconds
    
    const remainingLogs = await StorageManager.queryLogs({});
    const cutoffTime = now - (retentionDays * dayMs);
    
    expect(remainingLogs.logs.every(log => log.timestamp >= cutoffTime)).toBe(true);
    console.log(`Cleaned up ${logCount - remainingLogs.logs.length} old logs`);
  });

  test('export performance with large datasets', async () => {
    const ExportManager = require('../../models/ExportManager');
    const logCount = 2000;
    
    // Create test logs
    const logs = Array.from({ length: logCount }, (_, i) => 
      new LogEntry(
        ['log', 'error', 'warn', 'info'][i % 4],
        `Export performance test log ${i} with some additional content`,
        [`Export performance test log ${i} with some additional content`],
        `https://example${i % 5}.com`,
        (i % 3) + 1
      )
    );
    
    await StorageManager.saveLogs(logs);
    
    // Test export performance for different formats
    const formats = ['json', 'csv', 'txt'];
    
    for (const format of formats) {
      const startTime = performance.now();
      const exportData = await ExportManager.exportLogs(format, {});
      const endTime = performance.now();
      const exportTime = endTime - startTime;
      
      console.log(`${format.toUpperCase()} export: ${exportTime.toFixed(2)}ms, ${exportData.length} bytes`);
      
      expect(exportTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(exportData.length).toBeGreaterThan(0);
      
      // Verify export contains expected number of entries
      if (format === 'json') {
        const parsed = JSON.parse(exportData);
        expect(parsed.logs.length).toBe(logCount);
      } else if (format === 'csv') {
        const lines = exportData.split('\n').filter(line => line.trim());
        expect(lines.length).toBe(logCount + 1); // +1 for header
      }
    }
  });
});