/**
 * Jest Setup Configuration
 * Global test setup and configuration for all test suites
 */

// Increase timeout for performance tests
jest.setTimeout(30000);

// Mock Chrome APIs globally
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn()
    },
    getURL: jest.fn(path => `chrome-extension://test-id/${path}`),
    id: 'test-extension-id',
    getManifest: jest.fn(() => ({
      version: '1.0.0',
      name: 'Console Log Extension',
      permissions: ['storage', 'tabs', 'activeTab']
    })),
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
      clear: jest.fn().mockResolvedValue(),
      getBytesInUse: jest.fn().mockResolvedValue(0),
      onChanged: {
        addListener: jest.fn()
      },
      QUOTA_BYTES: 102400
    },
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
      clear: jest.fn().mockResolvedValue(),
      getBytesInUse: jest.fn().mockResolvedValue(0),
      QUOTA_BYTES: 5242880
    }
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    get: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onActivated: {
      addListener: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn().mockResolvedValue([]),
    clear: jest.fn(),
    clearAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  },
  permissions: {
    contains: jest.fn().mockResolvedValue(true),
    request: jest.fn().mockResolvedValue(true)
  }
};

// Setup IndexedDB mock
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

// Mock DOM APIs
const { JSDOM } = require('jsdom');

// Setup global DOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://example.com',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn()
};

// Performance API mock
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => [])
};

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHaveValidLogStructure(received) {
    const requiredFields = ['id', 'timestamp', 'level', 'message', 'url', 'domain'];
    const hasAllFields = requiredFields.every(field => received.hasOwnProperty(field));
    
    if (hasAllFields) {
      return {
        message: () => `expected log to not have valid structure`,
        pass: true,
      };
    } else {
      const missingFields = requiredFields.filter(field => !received.hasOwnProperty(field));
      return {
        message: () => `expected log to have valid structure, missing fields: ${missingFields.join(', ')}`,
        pass: false,
      };
    }
  },

  toBeValidLogLevel(received) {
    const validLevels = ['log', 'error', 'warn', 'info', 'debug', 'trace'];
    const pass = validLevels.includes(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid log level`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid log level (${validLevels.join(', ')})`,
        pass: false,
      };
    }
  }
});

// Global test utilities
global.testUtils = {
  // Create a mock log entry
  createMockLog: (overrides = {}) => {
    return {
      id: 'test-log-id',
      timestamp: Date.now(),
      level: 'log',
      message: 'Test log message',
      args: ['Test log message'],
      url: 'https://example.com',
      domain: 'example.com',
      tabId: 1,
      sessionId: 'test-session',
      ...overrides
    };
  },

  // Create multiple mock logs
  createMockLogs: (count, baseOverrides = {}) => {
    return Array.from({ length: count }, (_, i) => 
      global.testUtils.createMockLog({
        id: `test-log-${i}`,
        message: `Test log message ${i}`,
        args: [`Test log message ${i}`],
        ...baseOverrides
      })
    );
  },

  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Reset all mocks
  resetMocks: () => {
    jest.clearAllMocks();
    chrome.runtime.lastError = null;
  },

  // Memory measurement utilities
  measureMemory: () => {
    if (global.gc) global.gc();
    return process.memoryUsage();
  },

  // Performance measurement utilities
  measurePerformance: async (fn) => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return {
      result,
      duration: end - start
    };
  }
};

// Setup and teardown hooks
beforeEach(() => {
  // Reset mocks before each test
  global.testUtils.resetMocks();
  
  // Reset IndexedDB
  global.indexedDB = new FDBFactory();
});

afterEach(() => {
  // Clean up after each test
  if (global.gc) {
    global.gc();
  }
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Test environment information
console.log('Jest setup complete');
console.log(`Node version: ${process.version}`);
console.log(`Test environment: ${process.env.NODE_ENV || 'test'}`);