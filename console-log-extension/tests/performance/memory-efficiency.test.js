/**
 * Memory Usage and Efficiency Tests
 * Tests extension memory consumption and efficiency optimizations
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

describe('Memory Usage and Efficiency Tests', () => {
  let StorageManager;
  let LogEntry;

  beforeEach(async () => {
    StorageManager = require('../../models/StorageManager');
    LogEntry = require('../../models/LogEntry');

    await StorageManager.initialize();
    jest.clearAllMocks();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  test('memory usage during log creation', async () => {
    const initialMemory = process.memoryUsage();
    const logCount = 1000;
    
    // Create logs and measure memory growth
    const logs = [];
    for (let i = 0; i < logCount; i++) {
      const log = new LogEntry(
        'log',
        `Memory test log ${i}`,
        [`Memory test log ${i}`],
        'https://example.com',
        1
      );
      logs.push(log);
    }

    const afterCreationMemory = process.memoryUsage();
    const creationMemoryIncrease = afterCreationMemory.heapUsed - initialMemory.heapUsed;
    const memoryPerLog = creationMemoryIncrease / logCount;

    console.log(`Memory per log creation: ${(memoryPerLog / 1024).toFixed(2)}KB`);
    console.log(`Total creation memory: ${(creationMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    // Memory assertions
    expect(memoryPerLog).toBeLessThan(5 * 1024); // Less than 5KB per log
    expect(creationMemoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB total

    // Clean up
    logs.length = 0;
    if (global.gc) global.gc();
  });

  test('memory usage during storage operations', async () => {
    const logCount = 2000;
    const batchSize = 100;

    const initialMemory = process.memoryUsage();

    // Create and store logs in batches
    for (let batch = 0; batch < logCount / batchSize; batch++) {
      const logs = Array.from({ length: batchSize }, (_, i) => {
        const index = batch * batchSize + i;
        return new LogEntry(
          'log',
          `Storage memory test ${index}`,
          [`Storage memory test ${index}`],
          'https://example.com',
          1
        );
      });

      await StorageManager.saveLogs(logs);

      // Measure memory after each batch
      const batchMemory = process.memoryUsage();
      const memoryIncrease = batchMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory should not grow excessively with each batch
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    }

    const finalMemory = process.memoryUsage();
    const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryPerStoredLog = totalMemoryIncrease / logCount;

    console.log(`Memory per stored log: ${(memoryPerStoredLog / 1024).toFixed(2)}KB`);
    console.log(`Total storage memory: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    expect(memoryPerStoredLog).toBeLessThan(10 * 1024); // Less than 10KB per stored log
  });

  test('memory usage during query operations', async () => {
    const logCount = 1500;

    // Pre-populate storage
    const logs = Array.from({ length: logCount }, (_, i) => 
      new LogEntry(
        ['log', 'error', 'warn', 'info'][i % 4],
        `Query memory test ${i}`,
        [`Query memory test ${i}`],
        `https://site${i % 10}.com`,
        (i % 5) + 1
      )
    );

    await StorageManager.saveLogs(logs);

    const initialMemory = process.memoryUsage();

    // Perform various queries
    const queries = [
      { name: 'All logs', filter: {} },
      { name: 'Level filter', filter: { levels: ['error'] } },
      { name: 'Domain filter', filter: { domains: ['site1.com'] } },
      { name: 'Text search', filter: { textSearch: 'test' } },
      { name: 'Combined filter', filter: { levels: ['log', 'error'], textSearch: 'memory' } }
    ];

    for (const query of queries) {
      const queryStartMemory = process.memoryUsage();
      
      const results = await StorageManager.queryLogs(query.filter);
      
      const queryEndMemory = process.memoryUsage();
      const queryMemoryIncrease = queryEndMemory.heapUsed - queryStartMemory.heapUsed;
      const memoryPerResult = results.logs.length > 0 ? queryMemoryIncrease / results.logs.length : 0;

      console.log(`${query.name} query memory: ${(queryMemoryIncrease / 1024).toFixed(2)}KB for ${results.logs.length} results`);
      
      // Query memory should be reasonable
      expect(queryMemoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB per query
      if (results.logs.length > 0) {
        expect(memoryPerResult).toBeLessThan(50 * 1024); // Less than 50KB per result
      }
    }

    const finalMemory = process.memoryUsage();
    const totalQueryMemory = finalMemory.heapUsed - initialMemory.heapUsed;

    console.log(`Total query operations memory: ${(totalQueryMemory / 1024 / 1024).toFixed(2)}MB`);
    expect(totalQueryMemory).toBeLessThan(50 * 1024 * 1024); // Less than 50MB for all queries
  });

  test('memory cleanup after operations', async () => {
    const logCount = 1000;

    // Measure baseline memory
    if (global.gc) global.gc();
    const baselineMemory = process.memoryUsage();

    // Perform memory-intensive operations
    for (let iteration = 0; iteration < 5; iteration++) {
      const logs = Array.from({ length: logCount }, (_, i) => 
        new LogEntry(
          'log',
          `Cleanup test ${iteration}-${i}`,
          [`Cleanup test ${iteration}-${i}`],
          'https://example.com',
          1
        )
      );

      await StorageManager.saveLogs(logs);
      
      const results = await StorageManager.queryLogs({});
      expect(results.logs.length).toBeGreaterThan(0);

      // Clear references
      logs.length = 0;
    }

    // Force garbage collection and measure memory
    if (global.gc) global.gc();
    
    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const afterCleanupMemory = process.memoryUsage();
    const memoryRetained = afterCleanupMemory.heapUsed - baselineMemory.heapUsed;

    console.log(`Memory retained after cleanup: ${(memoryRetained / 1024 / 1024).toFixed(2)}MB`);

    // Should not retain excessive memory after operations
    expect(memoryRetained).toBeLessThan(100 * 1024 * 1024); // Less than 100MB retained
  });

  test('memory efficiency with large log messages', async () => {
    const messageSizes = [100, 1000, 10000, 50000]; // bytes
    
    for (const messageSize of messageSizes) {
      const initialMemory = process.memoryUsage();
      
      // Create log with large message
      const largeMessage = 'x'.repeat(messageSize);
      const log = new LogEntry(
        'log',
        largeMessage,
        [largeMessage],
        'https://example.com',
        1
      );

      await StorageManager.saveLogs([log]);

      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - initialMemory.heapUsed;
      const efficiency = messageSize / memoryIncrease;

      console.log(`Message size: ${messageSize} bytes, Memory increase: ${(memoryIncrease / 1024).toFixed(2)}KB, Efficiency: ${(efficiency * 100).toFixed(1)}%`);

      // Memory increase should be reasonable relative to message size
      expect(memoryIncrease).toBeLessThan(messageSize * 5); // Less than 5x message size
      expect(efficiency).toBeGreaterThan(0.1); // At least 10% efficiency
    }
  });

  test('memory usage with concurrent operations', async () => {
    const concurrentOperations = 5;
    const logsPerOperation = 200;

    const initialMemory = process.memoryUsage();

    // Run concurrent memory-intensive operations
    const operations = Array.from({ length: concurrentOperations }, async (_, opIndex) => {
      const logs = Array.from({ length: logsPerOperation }, (_, logIndex) => 
        new LogEntry(
          'log',
          `Concurrent memory test ${opIndex}-${logIndex}`,
          [`Concurrent memory test ${opIndex}-${logIndex}`],
          `https://site${opIndex}.com`,
          opIndex + 1
        )
      );

      await StorageManager.saveLogs(logs);
      
      // Perform query to simulate real usage
      const results = await StorageManager.queryLogs({ 
        domains: [`site${opIndex}.com`] 
      });
      
      return results.logs.length;
    });

    const results = await Promise.all(operations);
    const totalLogsProcessed = results.reduce((sum, count) => sum + count, 0);

    const finalMemory = process.memoryUsage();
    const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryPerLog = totalMemoryIncrease / totalLogsProcessed;

    console.log(`Concurrent operations memory: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB for ${totalLogsProcessed} logs`);
    console.log(`Memory per log (concurrent): ${(memoryPerLog / 1024).toFixed(2)}KB`);

    // Concurrent operations should not use excessive memory
    expect(totalMemoryIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
    expect(memoryPerLog).toBeLessThan(20 * 1024); // Less than 20KB per log
  });

  test('memory optimization with object pooling', async () => {
    // Test if object reuse reduces memory allocation
    const iterations = 1000;
    const poolSize = 10;

    // Without pooling
    const nopoolStartMemory = process.memoryUsage();
    
    for (let i = 0; i < iterations; i++) {
      const log = new LogEntry(
        'log',
        `No pool test ${i}`,
        [`No pool test ${i}`],
        'https://example.com',
        1
      );
      // Simulate processing
      log.toString();
    }

    const nopoolEndMemory = process.memoryUsage();
    const nopoolMemoryIncrease = nopoolEndMemory.heapUsed - nopoolStartMemory.heapUsed;

    // Force cleanup
    if (global.gc) global.gc();

    // With object reuse simulation
    const poolStartMemory = process.memoryUsage();
    const logPool = Array.from({ length: poolSize }, () => 
      new LogEntry('log', '', [''], '', 1)
    );

    for (let i = 0; i < iterations; i++) {
      const log = logPool[i % poolSize];
      log.message = `Pool test ${i}`;
      log.args = [`Pool test ${i}`];
      // Simulate processing
      log.toString();
    }

    const poolEndMemory = process.memoryUsage();
    const poolMemoryIncrease = poolEndMemory.heapUsed - poolStartMemory.heapUsed;

    console.log(`No pooling memory: ${(nopoolMemoryIncrease / 1024).toFixed(2)}KB`);
    console.log(`With pooling memory: ${(poolMemoryIncrease / 1024).toFixed(2)}KB`);
    console.log(`Memory savings: ${(((nopoolMemoryIncrease - poolMemoryIncrease) / nopoolMemoryIncrease) * 100).toFixed(1)}%`);

    // Pooling should use less memory
    expect(poolMemoryIncrease).toBeLessThan(nopoolMemoryIncrease);
  });

  test('memory usage with different data types', async () => {
    const dataTypes = [
      { name: 'String', data: 'Simple string message' },
      { name: 'Number', data: 12345.67890 },
      { name: 'Boolean', data: true },
      { name: 'Array', data: [1, 2, 3, 'test', true] },
      { name: 'Object', data: { key: 'value', nested: { prop: 123 } } },
      { name: 'Large Object', data: { 
        users: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `User ${i}` }))
      }}
    ];

    for (const dataType of dataTypes) {
      const initialMemory = process.memoryUsage();
      
      const log = new LogEntry(
        'log',
        JSON.stringify(dataType.data),
        [dataType.data],
        'https://example.com',
        1
      );

      await StorageManager.saveLogs([log]);

      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - initialMemory.heapUsed;

      console.log(`${dataType.name} memory usage: ${(memoryIncrease / 1024).toFixed(2)}KB`);

      // Memory usage should be reasonable for each data type
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB per log
    }
  });

  test('memory leak detection', async () => {
    const iterations = 100;
    const memorySnapshots = [];

    // Take memory snapshots during repeated operations
    for (let i = 0; i < iterations; i++) {
      const logs = Array.from({ length: 10 }, (_, j) => 
        new LogEntry(
          'log',
          `Leak test ${i}-${j}`,
          [`Leak test ${i}-${j}`],
          'https://example.com',
          1
        )
      );

      await StorageManager.saveLogs(logs);
      
      if (i % 10 === 0) {
        if (global.gc) global.gc();
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }
    }

    // Analyze memory growth trend
    const memoryGrowthRates = [];
    for (let i = 1; i < memorySnapshots.length; i++) {
      const growthRate = (memorySnapshots[i] - memorySnapshots[i-1]) / memorySnapshots[i-1];
      memoryGrowthRates.push(growthRate);
    }

    const avgGrowthRate = memoryGrowthRates.reduce((sum, rate) => sum + rate, 0) / memoryGrowthRates.length;

    console.log(`Memory snapshots: ${memorySnapshots.map(m => (m / 1024 / 1024).toFixed(1) + 'MB').join(', ')}`);
    console.log(`Average memory growth rate: ${(avgGrowthRate * 100).toFixed(2)}%`);

    // Memory growth should be minimal (indicating no significant leaks)
    expect(avgGrowthRate).toBeLessThan(0.1); // Less than 10% growth per iteration
    
    // Final memory should not be excessively higher than initial
    const memoryIncrease = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB total increase
  });

  test('memory efficiency with pagination', async () => {
    const totalLogs = 2000;
    const pageSize = 50;

    // Create large dataset
    const logs = Array.from({ length: totalLogs }, (_, i) => 
      new LogEntry(
        'log',
        `Pagination memory test ${i}`,
        [`Pagination memory test ${i}`],
        'https://example.com',
        1
      )
    );

    await StorageManager.saveLogs(logs);

    const initialMemory = process.memoryUsage();

    // Query pages and measure memory usage
    const totalPages = Math.ceil(totalLogs / pageSize);
    let maxMemoryIncrease = 0;

    for (let page = 0; page < Math.min(totalPages, 10); page++) {
      const pageStartMemory = process.memoryUsage();
      
      const results = await StorageManager.queryLogs({
        offset: page * pageSize,
        limit: pageSize
      });

      const pageEndMemory = process.memoryUsage();
      const pageMemoryIncrease = pageEndMemory.heapUsed - pageStartMemory.heapUsed;
      
      maxMemoryIncrease = Math.max(maxMemoryIncrease, pageMemoryIncrease);

      expect(results.logs.length).toBeLessThanOrEqual(pageSize);
    }

    const finalMemory = process.memoryUsage();
    const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

    console.log(`Max page memory increase: ${(maxMemoryIncrease / 1024).toFixed(2)}KB`);
    console.log(`Total pagination memory: ${(totalMemoryIncrease / 1024).toFixed(2)}KB`);

    // Pagination should use consistent memory per page
    expect(maxMemoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB per page
    expect(totalMemoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB total
  });
});