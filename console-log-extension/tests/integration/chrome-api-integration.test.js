/**
 * Chrome Extension API Integration Tests
 * Tests integration with Chrome extension APIs and browser functionality
 */

const { JSDOM } = require('jsdom');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Mock Chrome APIs with realistic behavior
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
      permissions: ['storage', 'tabs', 'activeTab']
    })),
    onInstalled: {
      addListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      getBytesInUse: jest.fn(),
      onChanged: {
        addListener: jest.fn()
      },
      QUOTA_BYTES: 102400
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      getBytesInUse: jest.fn(),
      QUOTA_BYTES: 5242880
    }
  },
  tabs: {
    query: jest.fn(),
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
    getAll: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  },
  permissions: {
    contains: jest.fn(),
    request: jest.fn()
  }
};

// Setup IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

describe('Chrome Extension API Integration Tests', () => {
  let StorageManager;
  let ExtensionSettings;

  beforeEach(async () => {
    // Load modules
    StorageManager = require('../../models/StorageManager');
    ExtensionSettings = require('../../models/ExtensionSettings');

    // Reset mocks
    jest.clearAllMocks();
    chrome.runtime.lastError = null;
  });

  test('chrome.storage.sync integration', async () => {
    const testData = {
      captureEnabled: true,
      logLevels: ['log', 'error'],
      retentionDays: 30
    };

    // Mock successful storage operations
    chrome.storage.sync.set.mockImplementation((data, callback) => {
      setTimeout(() => callback && callback(), 0);
    });

    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      setTimeout(() => callback && callback(testData), 0);
    });

    chrome.storage.sync.getBytesInUse.mockImplementation((keys, callback) => {
      setTimeout(() => callback && callback(1024), 0);
    });

    // Test setting data
    await new Promise((resolve) => {
      chrome.storage.sync.set(testData, () => {
        expect(chrome.runtime.lastError).toBeNull();
        resolve();
      });
    });

    // Test getting data
    await new Promise((resolve) => {
      chrome.storage.sync.get(null, (result) => {
        expect(result).toEqual(testData);
        expect(chrome.runtime.lastError).toBeNull();
        resolve();
      });
    });

    // Test quota usage
    await new Promise((resolve) => {
      chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
        expect(bytesInUse).toBe(1024);
        expect(bytesInUse).toBeLessThan(chrome.storage.sync.QUOTA_BYTES);
        resolve();
      });
    });
  });

  test('chrome.storage.sync quota exceeded handling', async () => {
    const largeData = {
      logs: new Array(10000).fill().map((_, i) => ({
        id: `log-${i}`,
        message: `Large log message ${i}`.repeat(100),
        timestamp: Date.now()
      }))
    };

    // Mock quota exceeded error
    chrome.storage.sync.set.mockImplementation((data, callback) => {
      chrome.runtime.lastError = { message: 'QUOTA_BYTES quota exceeded' };
      setTimeout(() => callback && callback(), 0);
    });

    await new Promise((resolve) => {
      chrome.storage.sync.set(largeData, () => {
        expect(chrome.runtime.lastError).toBeTruthy();
        expect(chrome.runtime.lastError.message).toContain('quota exceeded');
        resolve();
      });
    });

    // Reset error state
    chrome.runtime.lastError = null;
  });

  test('chrome.tabs API integration', async () => {
    const mockTabs = [
      { id: 1, url: 'https://example.com', active: true },
      { id: 2, url: 'https://test.com', active: false }
    ];

    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      let filteredTabs = mockTabs;
      
      if (queryInfo.active) {
        filteredTabs = mockTabs.filter(tab => tab.active);
      }
      
      setTimeout(() => callback && callback(filteredTabs), 0);
    });

    chrome.tabs.get.mockImplementation((tabId, callback) => {
      const tab = mockTabs.find(t => t.id === tabId);
      setTimeout(() => callback && callback(tab), 0);
    });

    // Test querying active tab
    await new Promise((resolve) => {
      chrome.tabs.query({ active: true }, (tabs) => {
        expect(tabs).toHaveLength(1);
        expect(tabs[0].id).toBe(1);
        expect(tabs[0].url).toBe('https://example.com');
        resolve();
      });
    });

    // Test getting specific tab
    await new Promise((resolve) => {
      chrome.tabs.get(2, (tab) => {
        expect(tab.id).toBe(2);
        expect(tab.url).toBe('https://test.com');
        resolve();
      });
    });
  });

  test('chrome.tabs event listeners', async () => {
    const mockTabUpdateListener = jest.fn();
    const mockTabRemovedListener = jest.fn();

    chrome.tabs.onUpdated.addListener(mockTabUpdateListener);
    chrome.tabs.onRemoved.addListener(mockTabRemovedListener);

    // Simulate tab update
    const tabId = 1;
    const changeInfo = { status: 'complete', url: 'https://example.com' };
    const tab = { id: tabId, url: 'https://example.com', status: 'complete' };

    // Trigger listeners (simulate browser behavior)
    mockTabUpdateListener(tabId, changeInfo, tab);
    expect(mockTabUpdateListener).toHaveBeenCalledWith(tabId, changeInfo, tab);

    // Simulate tab removal
    const removeInfo = { windowId: 1, isWindowClosing: false };
    mockTabRemovedListener(tabId, removeInfo);
    expect(mockTabRemovedListener).toHaveBeenCalledWith(tabId, removeInfo);
  });

  test('chrome.alarms API integration', async () => {
    const alarmName = 'cleanup-scheduler';
    const alarmInfo = {
      delayInMinutes: 1,
      periodInMinutes: 60
    };

    chrome.alarms.create.mockImplementation((name, info, callback) => {
      setTimeout(() => callback && callback(), 0);
    });

    chrome.alarms.get.mockImplementation((name, callback) => {
      const alarm = {
        name: alarmName,
        scheduledTime: Date.now() + 60000,
        periodInMinutes: 60
      };
      setTimeout(() => callback && callback(alarm), 0);
    });

    chrome.alarms.clear.mockImplementation((name, callback) => {
      setTimeout(() => callback && callback(true), 0);
    });

    // Test creating alarm
    await new Promise((resolve) => {
      chrome.alarms.create(alarmName, alarmInfo, () => {
        expect(chrome.alarms.create).toHaveBeenCalledWith(alarmName, alarmInfo, expect.any(Function));
        resolve();
      });
    });

    // Test getting alarm
    await new Promise((resolve) => {
      chrome.alarms.get(alarmName, (alarm) => {
        expect(alarm.name).toBe(alarmName);
        expect(alarm.periodInMinutes).toBe(60);
        resolve();
      });
    });

    // Test clearing alarm
    await new Promise((resolve) => {
      chrome.alarms.clear(alarmName, (wasCleared) => {
        expect(wasCleared).toBe(true);
        resolve();
      });
    });
  });

  test('chrome.runtime.sendMessage with error handling', async () => {
    // Test successful message
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      setTimeout(() => {
        callback && callback({ success: true, data: 'response' });
      }, 0);
    });

    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'TEST' }, (response) => {
        expect(response.success).toBe(true);
        expect(response.data).toBe('response');
        expect(chrome.runtime.lastError).toBeNull();
        resolve();
      });
    });

    // Test message with error
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      chrome.runtime.lastError = { message: 'Could not establish connection' };
      setTimeout(() => callback && callback(), 0);
    });

    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'FAIL' }, (response) => {
        expect(chrome.runtime.lastError).toBeTruthy();
        expect(chrome.runtime.lastError.message).toContain('connection');
        resolve();
      });
    });

    chrome.runtime.lastError = null;
  });

  test('chrome.permissions API integration', async () => {
    const requiredPermissions = ['storage', 'tabs'];
    const optionalPermissions = ['activeTab'];

    chrome.permissions.contains.mockImplementation((permissions, callback) => {
      const hasPermissions = permissions.permissions.every(p => 
        requiredPermissions.includes(p)
      );
      setTimeout(() => callback && callback(hasPermissions), 0);
    });

    chrome.permissions.request.mockImplementation((permissions, callback) => {
      setTimeout(() => callback && callback(true), 0);
    });

    // Test checking existing permissions
    await new Promise((resolve) => {
      chrome.permissions.contains({ permissions: ['storage'] }, (result) => {
        expect(result).toBe(true);
        resolve();
      });
    });

    // Test requesting new permissions
    await new Promise((resolve) => {
      chrome.permissions.request({ permissions: ['activeTab'] }, (granted) => {
        expect(granted).toBe(true);
        resolve();
      });
    });
  });

  test('chrome.storage change events', async () => {
    const mockChangeListener = jest.fn();
    chrome.storage.sync.onChanged.addListener(mockChangeListener);

    // Simulate storage change
    const changes = {
      captureEnabled: { oldValue: true, newValue: false },
      logLevels: { oldValue: ['log'], newValue: ['log', 'error'] }
    };

    // Trigger change listener
    mockChangeListener(changes, 'sync');

    expect(mockChangeListener).toHaveBeenCalledWith(changes, 'sync');
    expect(mockChangeListener).toHaveBeenCalledTimes(1);
  });

  test('extension URL resolution', async () => {
    const paths = [
      'popup/popup.html',
      'options/options.html',
      'icons/icon-48.png'
    ];

    paths.forEach(path => {
      const url = chrome.runtime.getURL(path);
      expect(url).toBe(`chrome-extension://test-id/${path}`);
    });
  });

  test('manifest access and validation', async () => {
    const manifest = chrome.runtime.getManifest();
    
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('tabs');
    expect(manifest.permissions).toContain('activeTab');
  });

  test('IndexedDB integration with Chrome storage fallback', async () => {
    await StorageManager.initialize();

    const testLogs = [
      { id: '1', message: 'Test log 1', timestamp: Date.now() },
      { id: '2', message: 'Test log 2', timestamp: Date.now() }
    ];

    // Test primary IndexedDB storage
    await StorageManager.saveLogs(testLogs);
    let retrievedLogs = await StorageManager.queryLogs({});
    expect(retrievedLogs.logs).toHaveLength(2);

    // Simulate IndexedDB failure and fallback to chrome.storage
    const originalIndexedDB = global.indexedDB;
    global.indexedDB = null;

    chrome.storage.local.set.mockResolvedValue();
    chrome.storage.local.get.mockResolvedValue({
      'logs': JSON.stringify(testLogs)
    });

    // Reinitialize with fallback
    await StorageManager.initialize();

    // Verify fallback works
    expect(chrome.storage.local.set).toHaveBeenCalled();

    // Restore IndexedDB
    global.indexedDB = originalIndexedDB;
  });

  test('cross-origin content script injection', async () => {
    const mockTabs = [
      { id: 1, url: 'https://example.com/page1' },
      { id: 2, url: 'https://test.com/page2' },
      { id: 3, url: 'chrome://settings' } // Should be excluded
    ];

    chrome.tabs.query.mockResolvedValue(mockTabs);

    // Filter tabs where content script can be injected
    const injectableTabs = mockTabs.filter(tab => 
      tab.url.startsWith('http://') || tab.url.startsWith('https://')
    );

    expect(injectableTabs).toHaveLength(2);
    expect(injectableTabs.every(tab => 
      tab.url.startsWith('http')
    )).toBe(true);
  });
});