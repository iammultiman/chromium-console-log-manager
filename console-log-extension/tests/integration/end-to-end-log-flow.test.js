/**
 * End-to-End Log Flow Integration Tests
 * Tests the complete flow from console message capture to storage and retrieval
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
    },
    getURL: jest.fn(path => `chrome-extension://test/${path}`)
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  }
};

// Setup IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

describe('End-to-End Log Flow Integration Tests', () => {
  let dom;
  let window;
  let document;
  let StorageManager;
  let LogEntry;
  let contentScript;
  let backgroundScript;

  beforeEach(async () => {
    // Setup DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://example.com',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    // Mock console methods
    window.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };

    // Load required modules
    StorageManager = require('../../models/StorageManager');
    LogEntry = require('../../models/LogEntry');

    // Reset Chrome API mocks
    jest.clearAllMocks();
    
    // Setup storage manager
    await StorageManager.initialize();
  });

  afterEach(() => {
    dom.window.close();
  });

  test('complete log flow: capture -> process -> store -> retrieve', async () => {
    // Step 1: Simulate content script capturing console message
    const originalMessage = 'Test log message';
    const logLevel = 'log';
    const timestamp = Date.now();
    
    // Create log entry as content script would
    const logEntry = new LogEntry(logLevel, originalMessage, [originalMessage], 'https://example.com', 1);
    
    // Step 2: Simulate message passing to background script
    const messageData = {
      type: 'LOG_CAPTURED',
      data: {
        id: logEntry.id,
        timestamp: logEntry.timestamp,
        level: logEntry.level,
        message: logEntry.message,
        args: logEntry.args,
        url: logEntry.url,
        domain: logEntry.domain,
        tabId: 1,
        sessionId: logEntry.sessionId
      }
    };

    // Step 3: Simulate background script processing
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (callback) callback({ success: true });
    });

    // Step 4: Store the log entry
    await StorageManager.saveLogs([logEntry]);

    // Step 5: Verify storage
    const storedLogs = await StorageManager.queryLogs({});
    expect(storedLogs.logs).toHaveLength(1);
    expect(storedLogs.logs[0].message).toBe(originalMessage);
    expect(storedLogs.logs[0].level).toBe(logLevel);
    expect(storedLogs.logs[0].domain).toBe('example.com');

    // Step 6: Test retrieval with filters
    const filteredLogs = await StorageManager.queryLogs({
      textSearch: 'Test',
      levels: ['log']
    });
    expect(filteredLogs.logs).toHaveLength(1);
    expect(filteredLogs.logs[0].id).toBe(logEntry.id);
  });

  test('multiple log levels flow with filtering', async () => {
    const logEntries = [
      new LogEntry('log', 'Info message', ['Info message'], 'https://example.com', 1),
      new LogEntry('error', 'Error message', ['Error message'], 'https://example.com', 1),
      new LogEntry('warn', 'Warning message', ['Warning message'], 'https://example.com', 1)
    ];

    // Store all entries
    await StorageManager.saveLogs(logEntries);

    // Test level filtering
    const errorLogs = await StorageManager.queryLogs({ levels: ['error'] });
    expect(errorLogs.logs).toHaveLength(1);
    expect(errorLogs.logs[0].level).toBe('error');

    const multiLevelLogs = await StorageManager.queryLogs({ levels: ['log', 'warn'] });
    expect(multiLevelLogs.logs).toHaveLength(2);
  });

  test('session-based organization flow', async () => {
    const sessionId1 = 'session-1';
    const sessionId2 = 'session-2';

    const session1Logs = [
      new LogEntry('log', 'Session 1 Log 1', ['Session 1 Log 1'], 'https://example.com', 1),
      new LogEntry('log', 'Session 1 Log 2', ['Session 1 Log 2'], 'https://example.com', 1)
    ];

    const session2Logs = [
      new LogEntry('log', 'Session 2 Log 1', ['Session 2 Log 1'], 'https://example.com', 2)
    ];

    // Set session IDs
    session1Logs.forEach(log => log.sessionId = sessionId1);
    session2Logs.forEach(log => log.sessionId = sessionId2);

    // Store logs
    await StorageManager.saveLogs([...session1Logs, ...session2Logs]);

    // Test session filtering
    const session1Results = await StorageManager.queryLogs({ sessionIds: [sessionId1] });
    expect(session1Results.logs).toHaveLength(2);
    expect(session1Results.logs.every(log => log.sessionId === sessionId1)).toBe(true);

    const session2Results = await StorageManager.queryLogs({ sessionIds: [sessionId2] });
    expect(session2Results.logs).toHaveLength(1);
    expect(session2Results.logs[0].sessionId).toBe(sessionId2);
  });

  test('domain-based organization flow', async () => {
    const logs = [
      new LogEntry('log', 'Example log', ['Example log'], 'https://example.com/page1', 1),
      new LogEntry('log', 'Test log', ['Test log'], 'https://test.com/page1', 2),
      new LogEntry('log', 'Another example log', ['Another example log'], 'https://example.com/page2', 3)
    ];

    await StorageManager.saveLogs(logs);

    // Test domain filtering
    const exampleLogs = await StorageManager.queryLogs({ domains: ['example.com'] });
    expect(exampleLogs.logs).toHaveLength(2);
    expect(exampleLogs.logs.every(log => log.domain === 'example.com')).toBe(true);

    const testLogs = await StorageManager.queryLogs({ domains: ['test.com'] });
    expect(testLogs.logs).toHaveLength(1);
    expect(testLogs.logs[0].domain).toBe('test.com');
  });

  test('text search flow across stored logs', async () => {
    const logs = [
      new LogEntry('log', 'User authentication failed', ['User authentication failed'], 'https://example.com', 1),
      new LogEntry('error', 'Database connection error', ['Database connection error'], 'https://example.com', 1),
      new LogEntry('warn', 'Authentication token expired', ['Authentication token expired'], 'https://example.com', 1)
    ];

    await StorageManager.saveLogs(logs);

    // Test text search
    const authLogs = await StorageManager.queryLogs({ textSearch: 'authentication' });
    expect(authLogs.logs).toHaveLength(2);
    expect(authLogs.logs.every(log => 
      log.message.toLowerCase().includes('authentication')
    )).toBe(true);

    const errorLogs = await StorageManager.queryLogs({ textSearch: 'error' });
    expect(errorLogs.logs).toHaveLength(1);
    expect(errorLogs.logs[0].message).toContain('Database connection error');
  });

  test('export flow with filtered data', async () => {
    const ExportManager = require('../../models/ExportManager');
    
    const logs = [
      new LogEntry('log', 'Export test log 1', ['Export test log 1'], 'https://example.com', 1),
      new LogEntry('error', 'Export test error', ['Export test error'], 'https://example.com', 1),
      new LogEntry('warn', 'Export test warning', ['Export test warning'], 'https://test.com', 2)
    ];

    await StorageManager.saveLogs(logs);

    // Test JSON export
    const jsonExport = await ExportManager.exportLogs('json', { levels: ['error'] });
    const exportData = JSON.parse(jsonExport);
    expect(exportData.logs).toHaveLength(1);
    expect(exportData.logs[0].level).toBe('error');

    // Test CSV export
    const csvExport = await ExportManager.exportLogs('csv', { domains: ['example.com'] });
    const csvLines = csvExport.split('\n');
    expect(csvLines.length).toBeGreaterThan(2); // Header + 2 data rows
    expect(csvLines[0]).toContain('timestamp,level,message,domain');
  });
});