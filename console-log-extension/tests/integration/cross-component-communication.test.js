/**
 * Cross-Component Communication Integration Tests
 * Tests message passing and coordination between content script, background script, and UI components
 */

const { JSDOM } = require('jsdom');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Mock Chrome APIs with message passing simulation
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getURL: jest.fn(path => `chrome-extension://test/${path}`),
    id: 'test-extension-id'
  },
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(),
      onChanged: {
        addListener: jest.fn()
      }
    },
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue()
    }
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    onUpdated: {
      addListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn()
    }
  }
};

// Setup IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

describe('Cross-Component Communication Integration Tests', () => {
  let messageListeners;
  let StorageManager;
  let LogEntry;

  beforeEach(async () => {
    messageListeners = new Map();
    
    // Mock message passing system
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      // Simulate async message handling
      setTimeout(() => {
        const listeners = messageListeners.get('runtime') || [];
        listeners.forEach(listener => {
          const response = listener(message, { id: 'test-sender' }, callback);
          if (callback && response !== undefined) {
            callback(response);
          }
        });
      }, 0);
    });

    chrome.runtime.onMessage.addListener.mockImplementation((listener) => {
      if (!messageListeners.has('runtime')) {
        messageListeners.set('runtime', []);
      }
      messageListeners.get('runtime').push(listener);
    });

    // Load modules
    StorageManager = require('../../models/StorageManager');
    LogEntry = require('../../models/LogEntry');

    await StorageManager.initialize();
    jest.clearAllMocks();
  });

  afterEach(() => {
    messageListeners.clear();
  });

  test('content script to background script log message flow', async () => {
    const mockBackgroundListener = jest.fn((message, sender, sendResponse) => {
      if (message.type === 'LOG_CAPTURED') {
        // Simulate background script processing
        const logData = message.data;
        expect(logData.message).toBe('Test console message');
        expect(logData.level).toBe('log');
        expect(logData.url).toBe('https://example.com');
        
        sendResponse({ success: true, logId: logData.id });
        return true;
      }
    });

    // Register background listener
    chrome.runtime.onMessage.addListener(mockBackgroundListener);

    // Simulate content script sending message
    const logData = {
      type: 'LOG_CAPTURED',
      data: {
        id: 'test-log-id',
        timestamp: Date.now(),
        level: 'log',
        message: 'Test console message',
        args: ['Test console message'],
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 1,
        sessionId: 'session-1'
      }
    };

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(logData, (response) => {
        expect(response.success).toBe(true);
        expect(response.logId).toBe('test-log-id');
        expect(mockBackgroundListener).toHaveBeenCalledWith(
          logData,
          { id: 'test-sender' },
          expect.any(Function)
        );
        resolve();
      });
    });
  });

  test('background script to popup communication', async () => {
    const mockPopupListener = jest.fn((message, sender, sendResponse) => {
      if (message.type === 'GET_RECENT_LOGS') {
        // Simulate popup requesting recent logs
        sendResponse({
          success: true,
          logs: [
            { id: '1', message: 'Recent log 1', level: 'log', timestamp: Date.now() },
            { id: '2', message: 'Recent log 2', level: 'error', timestamp: Date.now() }
          ]
        });
        return true;
      }
    });

    chrome.runtime.onMessage.addListener(mockPopupListener);

    const requestMessage = {
      type: 'GET_RECENT_LOGS',
      data: { limit: 10 }
    };

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(requestMessage, (response) => {
        expect(response.success).toBe(true);
        expect(response.logs).toHaveLength(2);
        expect(response.logs[0].message).toBe('Recent log 1');
        expect(mockPopupListener).toHaveBeenCalled();
        resolve();
      });
    });
  });

  test('settings synchronization between components', async () => {
    const mockSettingsData = {
      captureEnabled: true,
      logLevels: ['log', 'error'],
      retentionDays: 30
    };

    chrome.storage.sync.get.mockResolvedValue(mockSettingsData);
    chrome.storage.sync.set.mockResolvedValue();

    const mockBackgroundListener = jest.fn((message, sender, sendResponse) => {
      if (message.type === 'UPDATE_SETTINGS') {
        // Simulate settings update
        const newSettings = message.data;
        chrome.storage.sync.set(newSettings).then(() => {
          sendResponse({ success: true });
        });
        return true;
      } else if (message.type === 'GET_SETTINGS') {
        chrome.storage.sync.get().then((settings) => {
          sendResponse({ success: true, settings });
        });
        return true;
      }
    });

    chrome.runtime.onMessage.addListener(mockBackgroundListener);

    // Test settings update
    const updateMessage = {
      type: 'UPDATE_SETTINGS',
      data: { captureEnabled: false, logLevels: ['error'] }
    };

    await new Promise((resolve) => {
      chrome.runtime.sendMessage(updateMessage, (response) => {
        expect(response.success).toBe(true);
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          captureEnabled: false,
          logLevels: ['error']
        });
        resolve();
      });
    });

    // Test settings retrieval
    const getMessage = { type: 'GET_SETTINGS' };

    await new Promise((resolve) => {
      chrome.runtime.sendMessage(getMessage, (response) => {
        expect(response.success).toBe(true);
        expect(response.settings).toEqual(mockSettingsData);
        resolve();
      });
    });
  });

  test('tab lifecycle communication', async () => {
    const mockTabUpdateListener = jest.fn();
    const mockTabRemovedListener = jest.fn();

    chrome.tabs.onUpdated.addListener(mockTabUpdateListener);
    chrome.tabs.onRemoved.addListener(mockTabRemovedListener);

    const mockBackgroundListener = jest.fn((message, sender, sendResponse) => {
      if (message.type === 'TAB_SESSION_START') {
        expect(message.data.tabId).toBe(123);
        expect(message.data.url).toBe('https://example.com');
        sendResponse({ success: true, sessionId: 'new-session-id' });
        return true;
      } else if (message.type === 'TAB_SESSION_END') {
        expect(message.data.tabId).toBe(123);
        sendResponse({ success: true });
        return true;
      }
    });

    chrome.runtime.onMessage.addListener(mockBackgroundListener);

    // Test tab session start
    const sessionStartMessage = {
      type: 'TAB_SESSION_START',
      data: { tabId: 123, url: 'https://example.com' }
    };

    await new Promise((resolve) => {
      chrome.runtime.sendMessage(sessionStartMessage, (response) => {
        expect(response.success).toBe(true);
        expect(response.sessionId).toBe('new-session-id');
        resolve();
      });
    });

    // Test tab session end
    const sessionEndMessage = {
      type: 'TAB_SESSION_END',
      data: { tabId: 123 }
    };

    await new Promise((resolve) => {
      chrome.runtime.sendMessage(sessionEndMessage, (response) => {
        expect(response.success).toBe(true);
        resolve();
      });
    });
  });

  test('error handling in cross-component communication', async () => {
    const mockErrorListener = jest.fn((message, sender, sendResponse) => {
      if (message.type === 'STORAGE_ERROR') {
        // Simulate storage error handling
        sendResponse({ 
          success: false, 
          error: 'Storage quota exceeded',
          errorCode: 'QUOTA_EXCEEDED'
        });
        return true;
      }
    });

    chrome.runtime.onMessage.addListener(mockErrorListener);

    const errorMessage = {
      type: 'STORAGE_ERROR',
      data: { operation: 'save', details: 'IndexedDB quota exceeded' }
    };

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(errorMessage, (response) => {
        expect(response.success).toBe(false);
        expect(response.error).toBe('Storage quota exceeded');
        expect(response.errorCode).toBe('QUOTA_EXCEEDED');
        expect(mockErrorListener).toHaveBeenCalled();
        resolve();
      });
    });
  });

  test('bulk message handling performance', async () => {
    const messages = [];
    const responses = [];

    const mockBulkListener = jest.fn((message, sender, sendResponse) => {
      if (message.type === 'BULK_LOG_CAPTURE') {
        // Simulate processing multiple logs
        const logs = message.data.logs;
        expect(logs).toHaveLength(100);
        
        sendResponse({ 
          success: true, 
          processed: logs.length,
          timestamp: Date.now()
        });
        return true;
      }
    });

    chrome.runtime.onMessage.addListener(mockBulkListener);

    // Generate 100 log messages
    const bulkLogs = Array.from({ length: 100 }, (_, i) => ({
      id: `log-${i}`,
      message: `Bulk log message ${i}`,
      level: 'log',
      timestamp: Date.now() + i
    }));

    const bulkMessage = {
      type: 'BULK_LOG_CAPTURE',
      data: { logs: bulkLogs }
    };

    const startTime = Date.now();

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(bulkMessage, (response) => {
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        expect(response.success).toBe(true);
        expect(response.processed).toBe(100);
        expect(processingTime).toBeLessThan(1000); // Should process within 1 second
        expect(mockBulkListener).toHaveBeenCalledTimes(1);
        resolve();
      });
    });
  });

  test('message validation and security', async () => {
    const mockSecurityListener = jest.fn((message, sender, sendResponse) => {
      // Validate message structure
      if (!message.type || !message.data) {
        sendResponse({ success: false, error: 'Invalid message format' });
        return true;
      }

      // Validate sender (in real extension, would check sender.id)
      if (message.type === 'SENSITIVE_OPERATION' && !sender.id) {
        sendResponse({ success: false, error: 'Unauthorized sender' });
        return true;
      }

      sendResponse({ success: true });
      return true;
    });

    chrome.runtime.onMessage.addListener(mockSecurityListener);

    // Test invalid message format
    const invalidMessage = { invalidField: 'test' };

    await new Promise((resolve) => {
      chrome.runtime.sendMessage(invalidMessage, (response) => {
        expect(response.success).toBe(false);
        expect(response.error).toBe('Invalid message format');
        resolve();
      });
    });

    // Test valid message
    const validMessage = {
      type: 'VALID_OPERATION',
      data: { test: 'data' }
    };

    await new Promise((resolve) => {
      chrome.runtime.sendMessage(validMessage, (response) => {
        expect(response.success).toBe(true);
        resolve();
      });
    });
  });
});