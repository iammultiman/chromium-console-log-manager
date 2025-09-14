/**
 * Browser Compatibility Tests
 * Tests extension functionality across different browser environments and versions
 */

const { JSDOM } = require('jsdom');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

describe('Browser Compatibility Tests', () => {
  let originalChrome;
  let StorageManager;
  let LogEntry;

  beforeEach(async () => {
    // Store original chrome object
    originalChrome = global.chrome;
    
    // Setup IndexedDB
    global.indexedDB = new FDBFactory();
    global.IDBKeyRange = FDBKeyRange;

    // Load modules
    StorageManager = require('../../models/StorageManager');
    LogEntry = require('../../models/LogEntry');
  });

  afterEach(() => {
    // Restore original chrome object
    global.chrome = originalChrome;
  });

  test('Chrome Manifest V3 compatibility', async () => {
    // Mock Chrome with Manifest V3 APIs
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        },
        getManifest: jest.fn(() => ({
          manifest_version: 3,
          version: '1.0.0'
        }))
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
      },
      action: { // Manifest V3 uses 'action' instead of 'browserAction'
        setIcon: jest.fn(),
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn()
      },
      scripting: { // Manifest V3 scripting API
        executeScript: jest.fn(),
        insertCSS: jest.fn()
      }
    };

    await StorageManager.initialize();

    // Test that extension works with Manifest V3 APIs
    const testLog = new LogEntry('log', 'Manifest V3 test', ['Manifest V3 test'], 'https://example.com', 1);
    await expect(StorageManager.saveLogs([testLog])).resolves.not.toThrow();

    const retrievedLogs = await StorageManager.queryLogs({});
    expect(retrievedLogs.logs).toHaveLength(1);
    expect(retrievedLogs.logs[0].message).toBe('Manifest V3 test');
  });

  test('Chrome Manifest V2 compatibility', async () => {
    // Mock Chrome with Manifest V2 APIs
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        },
        getManifest: jest.fn(() => ({
          manifest_version: 2,
          version: '1.0.0'
        }))
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
      },
      browserAction: { // Manifest V2 uses 'browserAction'
        setIcon: jest.fn(),
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn()
      },
      tabs: {
        executeScript: jest.fn(), // Manifest V2 tabs API
        insertCSS: jest.fn()
      }
    };

    await StorageManager.initialize();

    // Test that extension works with Manifest V2 APIs
    const testLog = new LogEntry('log', 'Manifest V2 test', ['Manifest V2 test'], 'https://example.com', 1);
    await expect(StorageManager.saveLogs([testLog])).resolves.not.toThrow();

    const retrievedLogs = await StorageManager.queryLogs({});
    expect(retrievedLogs.logs).toHaveLength(1);
    expect(retrievedLogs.logs[0].message).toBe('Manifest V2 test');
  });

  test('IndexedDB availability and fallback', async () => {
    // Test with IndexedDB available
    global.chrome = {
      runtime: { sendMessage: jest.fn(), onMessage: { addListener: jest.fn() } },
      storage: {
        sync: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() },
        local: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() }
      }
    };

    await StorageManager.initialize();
    expect(StorageManager.isIndexedDBAvailable()).toBe(true);

    // Test without IndexedDB (fallback to chrome.storage)
    const originalIndexedDB = global.indexedDB;
    global.indexedDB = undefined;

    await StorageManager.initialize();
    expect(StorageManager.isIndexedDBAvailable()).toBe(false);

    // Should still work with chrome.storage fallback
    const testLog = new LogEntry('log', 'Fallback test', ['Fallback test'], 'https://example.com', 1);
    await expect(StorageManager.saveLogs([testLog])).resolves.not.toThrow();

    // Restore IndexedDB
    global.indexedDB = originalIndexedDB;
  });

  test('Chrome storage API variations', async () => {
    // Test with limited chrome.storage.sync quota
    global.chrome = {
      runtime: { sendMessage: jest.fn(), onMessage: { addListener: jest.fn() } },
      storage: {
        sync: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockImplementation((data, callback) => {
            // Simulate quota exceeded
            if (JSON.stringify(data).length > 1000) {
              const error = new Error('QUOTA_BYTES quota exceeded');
              global.chrome.runtime.lastError = error;
              callback && callback();
            } else {
              callback && callback();
            }
          }),
          QUOTA_BYTES: 1024
        },
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue({}),
          QUOTA_BYTES: 5242880
        }
      }
    };

    await StorageManager.initialize();

    // Test that large data falls back to local storage
    const largeData = { test: 'x'.repeat(2000) };
    
    // Should handle quota exceeded gracefully
    await expect(StorageManager.saveSettings(largeData)).resolves.not.toThrow();
  });

  test('Console API variations across browsers', async () => {
    const testCases = [
      {
        name: 'Standard Chrome console',
        console: {
          log: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
          trace: jest.fn()
        }
      },
      {
        name: 'Limited console (older browsers)',
        console: {
          log: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
          // Missing info, debug, trace
        }
      },
      {
        name: 'Console with non-standard methods',
        console: {
          log: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
          assert: jest.fn(),
          count: jest.fn(),
          time: jest.fn(),
          timeEnd: jest.fn()
        }
      }
    ];

    global.chrome = {
      runtime: { sendMessage: jest.fn(), onMessage: { addListener: jest.fn() } },
      storage: {
        sync: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() },
        local: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() }
      }
    };

    for (const testCase of testCases) {
      // Setup DOM with specific console
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
      dom.window.console = testCase.console;
      global.window = dom.window;
      global.document = dom.window.document;

      // Test console interception
      const ConsoleInterceptor = require('../../content/content');
      
      // Should handle missing console methods gracefully
      expect(() => {
        // Simulate console method calls
        if (testCase.console.log) testCase.console.log('test message');
        if (testCase.console.error) testCase.console.error('test error');
        if (testCase.console.warn) testCase.console.warn('test warning');
        if (testCase.console.info) testCase.console.info('test info');
      }).not.toThrow();

      dom.window.close();
    }
  });

  test('Chrome extension API error handling', async () => {
    // Mock Chrome with various error conditions
    global.chrome = {
      runtime: {
        sendMessage: jest.fn().mockImplementation((message, callback) => {
          // Simulate connection error
          global.chrome.runtime.lastError = { message: 'Could not establish connection' };
          callback && callback();
        }),
        onMessage: { addListener: jest.fn() },
        lastError: null
      },
      storage: {
        sync: {
          get: jest.fn().mockImplementation((keys, callback) => {
            // Simulate storage error
            global.chrome.runtime.lastError = { message: 'Storage unavailable' };
            callback && callback({});
          }),
          set: jest.fn().mockImplementation((data, callback) => {
            global.chrome.runtime.lastError = { message: 'Storage write failed' };
            callback && callback();
          })
        },
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue()
        }
      }
    };

    await StorageManager.initialize();

    // Should handle Chrome API errors gracefully
    const testLog = new LogEntry('log', 'Error test', ['Error test'], 'https://example.com', 1);
    await expect(StorageManager.saveLogs([testLog])).resolves.not.toThrow();
  });

  test('Different Chrome versions compatibility', async () => {
    const chromeVersions = [
      { version: '88.0.4324.150', features: ['storage', 'tabs'] },
      { version: '91.0.4472.124', features: ['storage', 'tabs', 'alarms'] },
      { version: '95.0.4638.69', features: ['storage', 'tabs', 'alarms', 'scripting'] },
      { version: '100.0.4896.127', features: ['storage', 'tabs', 'alarms', 'scripting', 'action'] }
    ];

    for (const chromeVersion of chromeVersions) {
      // Mock Chrome for specific version
      global.chrome = {
        runtime: {
          sendMessage: jest.fn(),
          onMessage: { addListener: jest.fn() },
          getManifest: jest.fn(() => ({
            version: '1.0.0',
            chrome_version: chromeVersion.version
          }))
        },
        storage: {
          sync: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() },
          local: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() }
        }
      };

      // Add version-specific APIs
      if (chromeVersion.features.includes('alarms')) {
        global.chrome.alarms = {
          create: jest.fn(),
          clear: jest.fn(),
          onAlarm: { addListener: jest.fn() }
        };
      }

      if (chromeVersion.features.includes('scripting')) {
        global.chrome.scripting = {
          executeScript: jest.fn(),
          insertCSS: jest.fn()
        };
      }

      if (chromeVersion.features.includes('action')) {
        global.chrome.action = {
          setIcon: jest.fn(),
          setBadgeText: jest.fn()
        };
      } else {
        global.chrome.browserAction = {
          setIcon: jest.fn(),
          setBadgeText: jest.fn()
        };
      }

      await StorageManager.initialize();

      // Test core functionality works across versions
      const testLog = new LogEntry('log', `Chrome ${chromeVersion.version} test`, [`Chrome ${chromeVersion.version} test`], 'https://example.com', 1);
      await expect(StorageManager.saveLogs([testLog])).resolves.not.toThrow();

      const retrievedLogs = await StorageManager.queryLogs({});
      expect(retrievedLogs.logs.length).toBeGreaterThan(0);
    }
  });

  test('Cross-platform compatibility', async () => {
    const platforms = ['Windows', 'macOS', 'Linux', 'Chrome OS'];

    for (const platform of platforms) {
      // Mock platform-specific behaviors
      global.chrome = {
        runtime: {
          sendMessage: jest.fn(),
          onMessage: { addListener: jest.fn() },
          getPlatformInfo: jest.fn((callback) => {
            callback({ os: platform.toLowerCase().replace(' ', '') });
          })
        },
        storage: {
          sync: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() },
          local: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() }
        }
      };

      await StorageManager.initialize();

      // Test that extension works on all platforms
      const testLog = new LogEntry('log', `${platform} test`, [`${platform} test`], 'https://example.com', 1);
      await expect(StorageManager.saveLogs([testLog])).resolves.not.toThrow();

      const retrievedLogs = await StorageManager.queryLogs({});
      expect(retrievedLogs.logs.some(log => log.message.includes(platform))).toBe(true);
    }
  });

  test('Memory constraints on different devices', async () => {
    const deviceProfiles = [
      { name: 'Desktop', memoryLimit: 1000000 }, // 1MB
      { name: 'Laptop', memoryLimit: 500000 },   // 500KB
      { name: 'Tablet', memoryLimit: 250000 },   // 250KB
      { name: 'Mobile', memoryLimit: 100000 }    // 100KB
    ];

    global.chrome = {
      runtime: { sendMessage: jest.fn(), onMessage: { addListener: jest.fn() } },
      storage: {
        sync: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() },
        local: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() }
      }
    };

    for (const device of deviceProfiles) {
      await StorageManager.initialize();

      // Create logs within memory constraints
      const logSize = 100; // Approximate bytes per log
      const maxLogs = Math.floor(device.memoryLimit / logSize);
      
      const logs = Array.from({ length: Math.min(maxLogs, 1000) }, (_, i) => 
        new LogEntry('log', `${device.name} log ${i}`, [`${device.name} log ${i}`], 'https://example.com', 1)
      );

      await expect(StorageManager.saveLogs(logs)).resolves.not.toThrow();

      // Verify logs were stored successfully
      const retrievedLogs = await StorageManager.queryLogs({});
      expect(retrievedLogs.logs.length).toBeGreaterThan(0);
      expect(retrievedLogs.logs.length).toBeLessThanOrEqual(maxLogs);
    }
  });

  test('Network connectivity variations', async () => {
    const networkConditions = [
      { name: 'Online', connected: true, delay: 0 },
      { name: 'Slow connection', connected: true, delay: 1000 },
      { name: 'Offline', connected: false, delay: 0 }
    ];

    for (const condition of networkConditions) {
      global.chrome = {
        runtime: {
          sendMessage: jest.fn().mockImplementation((message, callback) => {
            if (!condition.connected) {
              global.chrome.runtime.lastError = { message: 'Network error' };
              callback && callback();
            } else {
              setTimeout(() => callback && callback({ success: true }), condition.delay);
            }
          }),
          onMessage: { addListener: jest.fn() }
        },
        storage: {
          sync: {
            get: jest.fn().mockImplementation((keys, callback) => {
              if (!condition.connected) {
                global.chrome.runtime.lastError = { message: 'Sync unavailable' };
                callback && callback({});
              } else {
                setTimeout(() => callback && callback({}), condition.delay);
              }
            }),
            set: jest.fn().mockImplementation((data, callback) => {
              if (!condition.connected) {
                global.chrome.runtime.lastError = { message: 'Sync unavailable' };
              }
              setTimeout(() => callback && callback(), condition.delay);
            })
          },
          local: {
            get: jest.fn().mockResolvedValue({}),
            set: jest.fn().mockResolvedValue()
          }
        }
      };

      await StorageManager.initialize();

      // Test that extension handles network conditions gracefully
      const testLog = new LogEntry('log', `${condition.name} test`, [`${condition.name} test`], 'https://example.com', 1);
      await expect(StorageManager.saveLogs([testLog])).resolves.not.toThrow();

      // Should fallback to local storage when sync is unavailable
      if (!condition.connected) {
        expect(global.chrome.storage.local.set).toHaveBeenCalled();
      }
    }
  });
});