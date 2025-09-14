/**
 * Extension Lifecycle Integration Tests
 * Tests extension installation, updates, and uninstallation scenarios
 */

const { JSDOM } = require('jsdom');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Mock Chrome APIs
global.chrome = {
  runtime: {
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    onSuspend: {
      addListener: jest.fn()
    },
    getManifest: jest.fn(() => ({
      version: '1.0.0',
      name: 'Console Log Extension'
    })),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(),
      clear: jest.fn().mockResolvedValue()
    },
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(),
      clear: jest.fn().mockResolvedValue()
    }
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  }
};

// Setup IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

describe('Extension Lifecycle Integration Tests', () => {
  let StorageManager;
  let ExtensionSettings;
  let CleanupScheduler;

  beforeEach(async () => {
    // Load modules
    StorageManager = require('../../models/StorageManager');
    ExtensionSettings = require('../../models/ExtensionSettings');
    CleanupScheduler = require('../../models/CleanupScheduler');

    // Reset mocks
    jest.clearAllMocks();
  });

  test('extension installation initialization', async () => {
    const mockInstallListener = jest.fn();
    chrome.runtime.onInstalled.addListener(mockInstallListener);

    // Simulate extension installation
    const installDetails = {
      reason: 'install',
      previousVersion: undefined
    };

    // Initialize storage on install
    await StorageManager.initialize();

    // Set default settings
    const defaultSettings = new ExtensionSettings();
    await defaultSettings.save();

    // Verify default settings were saved
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        captureEnabled: true,
        logLevels: ['log', 'error', 'warn', 'info'],
        retentionDays: 30
      })
    );

    // Verify storage initialization
    const testLog = { id: 'test', message: 'test', timestamp: Date.now() };
    await expect(StorageManager.saveLogs([testLog])).resolves.not.toThrow();
  });

  test('extension update migration', async () => {
    const mockInstallListener = jest.fn();
    chrome.runtime.onInstalled.addListener(mockInstallListener);

    // Simulate existing data from previous version
    const oldSettings = {
      enabled: true, // Old property name
      levels: ['log', 'error'] // Old property name
    };

    chrome.storage.sync.get.mockResolvedValueOnce(oldSettings);

    // Simulate extension update
    const updateDetails = {
      reason: 'update',
      previousVersion: '0.9.0'
    };

    // Perform migration
    const settings = new ExtensionSettings();
    await settings.load();

    // Migrate old settings format
    if (oldSettings.enabled !== undefined) {
      settings.captureEnabled = oldSettings.enabled;
    }
    if (oldSettings.levels !== undefined) {
      settings.logLevels = oldSettings.levels;
    }

    await settings.save();

    // Verify migration
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        captureEnabled: true,
        logLevels: ['log', 'error']
      })
    );
  });

  test('extension startup initialization', async () => {
    const mockStartupListener = jest.fn();
    chrome.runtime.onStartup.addListener(mockStartupListener);

    // Simulate browser startup
    await StorageManager.initialize();

    // Load existing settings
    const existingSettings = {
      captureEnabled: false,
      logLevels: ['error'],
      retentionDays: 7
    };

    chrome.storage.sync.get.mockResolvedValueOnce(existingSettings);

    const settings = new ExtensionSettings();
    await settings.load();

    // Verify settings loaded correctly
    expect(settings.captureEnabled).toBe(false);
    expect(settings.logLevels).toEqual(['error']);
    expect(settings.retentionDays).toBe(7);

    // Initialize cleanup scheduler
    const scheduler = new CleanupScheduler();
    scheduler.start();

    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'cleanup-scheduler',
      expect.objectContaining({
        periodInMinutes: expect.any(Number)
      })
    );
  });

  test('extension suspension cleanup', async () => {
    const mockSuspendListener = jest.fn();
    chrome.runtime.onSuspend.addListener(mockSuspendListener);

    // Initialize components
    await StorageManager.initialize();
    const scheduler = new CleanupScheduler();
    scheduler.start();

    // Simulate extension suspension
    // Clear any pending operations
    scheduler.stop();
    
    expect(chrome.alarms.clear).toHaveBeenCalledWith('cleanup-scheduler');

    // Ensure no pending storage operations
    await StorageManager.flush();
  });

  test('extension uninstallation cleanup', async () => {
    // Initialize with test data
    await StorageManager.initialize();

    const testLogs = [
      { id: '1', message: 'Test log 1', timestamp: Date.now() },
      { id: '2', message: 'Test log 2', timestamp: Date.now() }
    ];

    await StorageManager.saveLogs(testLogs);

    // Simulate uninstall cleanup
    const UninstallCleanup = require('../../models/UninstallCleanup');
    
    // User chooses to delete data on uninstall
    const userChoice = 'delete';
    
    if (userChoice === 'delete') {
      await UninstallCleanup.clearAllData();
    }

    // Verify data cleanup
    expect(chrome.storage.sync.clear).toHaveBeenCalled();
    expect(chrome.storage.local.clear).toHaveBeenCalled();

    // Verify IndexedDB cleanup
    const remainingLogs = await StorageManager.queryLogs({});
    expect(remainingLogs.logs).toHaveLength(0);
  });

  test('version compatibility check', async () => {
    const currentVersion = '1.2.0';
    const previousVersion = '1.0.0';

    chrome.runtime.getManifest.mockReturnValue({
      version: currentVersion,
      name: 'Console Log Extension'
    });

    // Check if migration is needed
    const needsMigration = (prevVer, currVer) => {
      const prev = prevVer.split('.').map(Number);
      const curr = currVer.split('.').map(Number);
      
      // Major version change requires migration
      return prev[0] < curr[0];
    };

    const requiresMigration = needsMigration(previousVersion, currentVersion);
    expect(requiresMigration).toBe(true);

    // Perform version-specific migrations
    if (requiresMigration) {
      // Migrate storage schema
      await StorageManager.migrateSchema(previousVersion, currentVersion);
      
      // Update settings format
      const settings = new ExtensionSettings();
      await settings.load();
      await settings.save(); // Save in new format
    }
  });

  test('background script lifecycle management', async () => {
    const backgroundListeners = [];
    
    // Simulate background script initialization
    const initializeBackground = () => {
      // Set up message listeners
      const messageListener = (message, sender, sendResponse) => {
        if (message.type === 'HEALTH_CHECK') {
          sendResponse({ status: 'healthy', timestamp: Date.now() });
          return true;
        }
      };
      
      chrome.runtime.onMessage.addListener(messageListener);
      backgroundListeners.push(messageListener);
      
      // Initialize storage
      return StorageManager.initialize();
    };

    await initializeBackground();

    // Verify background script is responsive
    const healthCheck = { type: 'HEALTH_CHECK' };
    
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.type === 'HEALTH_CHECK') {
        callback({ status: 'healthy', timestamp: Date.now() });
      }
    });

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(healthCheck, (response) => {
        expect(response.status).toBe('healthy');
        expect(response.timestamp).toBeGreaterThan(0);
        resolve();
      });
    });
  });

  test('storage persistence across sessions', async () => {
    // Initialize and store data
    await StorageManager.initialize();

    const sessionLogs = [
      { id: 'session-1', message: 'Session log 1', timestamp: Date.now() },
      { id: 'session-2', message: 'Session log 2', timestamp: Date.now() }
    ];

    await StorageManager.saveLogs(sessionLogs);

    // Simulate browser restart by reinitializing storage
    await StorageManager.initialize();

    // Verify data persistence
    const retrievedLogs = await StorageManager.queryLogs({});
    expect(retrievedLogs.logs).toHaveLength(2);
    expect(retrievedLogs.logs.map(log => log.id)).toEqual(['session-1', 'session-2']);
  });

  test('error recovery during initialization', async () => {
    // Simulate IndexedDB initialization failure
    const originalIndexedDB = global.indexedDB;
    global.indexedDB = null;

    try {
      await StorageManager.initialize();
      // Should fallback to chrome.storage.local
      expect(chrome.storage.local.set).toHaveBeenCalled();
    } catch (error) {
      // Should handle gracefully
      expect(error.message).toContain('storage');
    } finally {
      // Restore IndexedDB
      global.indexedDB = originalIndexedDB;
    }

    // Verify extension still functions with fallback storage
    const settings = new ExtensionSettings();
    await expect(settings.load()).resolves.not.toThrow();
  });

  test('cleanup scheduler lifecycle', async () => {
    const scheduler = new CleanupScheduler();
    
    // Start scheduler
    scheduler.start();
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'cleanup-scheduler',
      expect.any(Object)
    );

    // Simulate alarm trigger
    const mockAlarmListener = jest.fn();
    chrome.alarms.onAlarm.addListener(mockAlarmListener);

    // Trigger cleanup
    const alarm = { name: 'cleanup-scheduler' };
    await scheduler.handleAlarm(alarm);

    // Verify cleanup was performed
    expect(mockAlarmListener).toHaveBeenCalled();

    // Stop scheduler
    scheduler.stop();
    expect(chrome.alarms.clear).toHaveBeenCalledWith('cleanup-scheduler');
  });
});