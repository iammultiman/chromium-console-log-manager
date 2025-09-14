/**
 * Tests for settings synchronization functionality
 * Focused on chrome.storage.sync integration without requiring full background script
 */

const ExtensionSettings = require('../models/ExtensionSettings.js');
const KeywordFilters = require('../models/KeywordFilters.js');

// Mock chrome.storage.sync
const mockChromeStorage = {
  set: jest.fn(),
  get: jest.fn()
};

global.chrome = {
  storage: {
    sync: mockChromeStorage
  },
  runtime: {
    lastError: null
  }
};

describe('Settings Synchronization', () => {
  let settings;

  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome.runtime.lastError = null;
    settings = new ExtensionSettings();
  });

  describe('chrome.storage.sync integration', () => {
    test('should save settings to chrome.storage.sync', async () => {
      mockChromeStorage.set.mockImplementation((data, callback) => {
        expect(data).toHaveProperty('extensionSettings');
        callback();
      });

      settings.setCaptureEnabled(false)
        .setLogLevels(['error', 'warn'])
        .setRetentionDays(15);

      await settings.save();

      expect(mockChromeStorage.set).toHaveBeenCalledTimes(1);
      const savedData = mockChromeStorage.set.mock.calls[0][0];
      expect(savedData.extensionSettings.captureEnabled).toBe(false);
      expect(savedData.extensionSettings.logLevels).toEqual(['error', 'warn']);
      expect(savedData.extensionSettings.retentionDays).toBe(15);
    });

    test('should load settings from chrome.storage.sync', async () => {
      const storedSettings = {
        captureEnabled: false,
        logLevels: ['error'],
        retentionDays: 7,
        maxStorageSize: 50,
        sensitiveDataFiltering: false,
        keywordFilters: {
          include: ['test'],
          exclude: ['debug'],
          caseSensitive: true
        },
        websiteSettings: {
          'example.com': {
            enabled: false,
            logLevels: ['error']
          }
        }
      };

      mockChromeStorage.get.mockImplementation((keys, callback) => {
        callback({ extensionSettings: storedSettings });
      });

      await settings.load();

      expect(settings.captureEnabled).toBe(false);
      expect(settings.logLevels).toEqual(['error']);
      expect(settings.retentionDays).toBe(7);
      expect(settings.maxStorageSize).toBe(50);
      expect(settings.sensitiveDataFiltering).toBe(false);
      expect(settings.getWebsiteSettings('example.com')).toEqual({
        enabled: false,
        logLevels: ['error']
      });
    });

    test('should handle chrome.storage.sync errors gracefully', async () => {
      mockChromeStorage.set.mockImplementation((data, callback) => {
        global.chrome.runtime.lastError = { message: 'Storage quota exceeded' };
        callback();
      });

      await expect(settings.save()).rejects.toThrow('Failed to save settings: Storage quota exceeded');

      // Reset error
      global.chrome.runtime.lastError = null;
    });

    test('should handle missing data during load', async () => {
      mockChromeStorage.get.mockImplementation((keys, callback) => {
        callback({}); // No stored data
      });

      await settings.load();

      // Should maintain default values
      expect(settings.captureEnabled).toBe(true);
      expect(settings.logLevels).toEqual(['log', 'error', 'warn', 'info']);
      expect(settings.retentionDays).toBe(30);
    });
  });

  describe('Settings synchronization with keyword filters', () => {
    test('should synchronize keyword filters correctly', async () => {
      const keywordFilters = new KeywordFilters();
      keywordFilters.setIncludeKeywords(['error', 'warning'])
        .setExcludeKeywords(['debug', 'trace'])
        .setCaseSensitive(false);

      settings.setKeywordFilters(keywordFilters);

      mockChromeStorage.set.mockImplementation((data, callback) => callback());
      await settings.save();

      const savedData = mockChromeStorage.set.mock.calls[0][0];
      expect(savedData.extensionSettings.keywordFilters).toEqual({
        include: ['error', 'warning'],
        exclude: ['debug', 'trace'],
        caseSensitive: false
      });
    });

    test('should load keyword filters from storage', async () => {
      const storedFilters = {
        include: ['critical', 'fatal'],
        exclude: ['info', 'verbose'],
        caseSensitive: true
      };

      mockChromeStorage.get.mockImplementation((keys, callback) => {
        callback({
          extensionSettings: {
            keywordFilters: storedFilters
          }
        });
      });

      await settings.load();

      expect(settings.keywordFilters).toBeDefined();
      expect(settings.keywordFilters.include).toEqual(['critical', 'fatal']);
      expect(settings.keywordFilters.exclude).toEqual(['info', 'verbose']);
      expect(settings.keywordFilters.caseSensitive).toBe(true);
    });
  });

  describe('Website-specific settings synchronization', () => {
    test('should synchronize website settings correctly', async () => {
      settings.setWebsiteSettings('example.com', {
        enabled: false,
        logLevels: ['error'],
        keywordFilters: {
          include: ['critical'],
          exclude: [],
          caseSensitive: true
        }
      });

      settings.setWebsiteSettings('test.com', {
        enabled: true,
        logLevels: ['log', 'error', 'warn']
      });

      mockChromeStorage.set.mockImplementation((data, callback) => callback());
      await settings.save();

      const savedData = mockChromeStorage.set.mock.calls[0][0];
      expect(savedData.extensionSettings.websiteSettings).toEqual({
        'example.com': {
          enabled: false,
          logLevels: ['error'],
          keywordFilters: {
            include: ['critical'],
            exclude: [],
            caseSensitive: true
          }
        },
        'test.com': {
          enabled: true,
          logLevels: ['log', 'error', 'warn']
        }
      });
    });

    test('should load website settings from storage', async () => {
      const websiteSettings = {
        'example.com': {
          enabled: false,
          logLevels: ['error']
        },
        'test.org': {
          enabled: true,
          logLevels: ['log', 'warn'],
          keywordFilters: {
            include: ['important'],
            exclude: ['debug'],
            caseSensitive: false
          }
        }
      };

      mockChromeStorage.get.mockImplementation((keys, callback) => {
        callback({
          extensionSettings: {
            websiteSettings
          }
        });
      });

      await settings.load();

      expect(settings.getWebsiteSettings('example.com')).toEqual({
        enabled: false,
        logLevels: ['error']
      });

      expect(settings.getWebsiteSettings('test.org')).toEqual({
        enabled: true,
        logLevels: ['log', 'warn'],
        keywordFilters: {
          include: ['important'],
          exclude: ['debug'],
          caseSensitive: false
        }
      });

      expect(settings.getWebsiteSettings('unknown.com')).toBeNull();
    });
  });

  describe('Settings validation during sync', () => {
    test('should validate settings before saving', async () => {
      // Set invalid values that should be corrected
      settings.setRetentionDays(-5); // Should become 1
      settings.setMaxStorageSize(0); // Should become 1

      mockChromeStorage.set.mockImplementation((data, callback) => callback());
      await settings.save();

      const savedData = mockChromeStorage.set.mock.calls[0][0];
      expect(savedData.extensionSettings.retentionDays).toBe(1);
      expect(savedData.extensionSettings.maxStorageSize).toBe(1);
    });

    test('should handle corrupted data during load', async () => {
      mockChromeStorage.get.mockImplementation((keys, callback) => {
        callback({
          extensionSettings: {
            captureEnabled: 'invalid',
            logLevels: 'not-array',
            retentionDays: 'invalid',
            maxStorageSize: 'invalid'
          }
        });
      });

      await settings.load();

      // Should use safe defaults
      expect(settings.captureEnabled).toBe(true);
      expect(settings.logLevels).toEqual(['log', 'error', 'warn', 'info']);
      expect(settings.retentionDays).toBe(30);
      expect(settings.maxStorageSize).toBe(100);
    });
  });

  describe('Fallback to localStorage', () => {
    test('should use localStorage when chrome.storage is not available', async () => {
      // Temporarily remove chrome.storage
      const originalChrome = global.chrome;
      global.chrome = undefined;

      const localStorageMock = {
        setItem: jest.fn(),
        getItem: jest.fn()
      };
      global.localStorage = localStorageMock;

      settings.setCaptureEnabled(false);

      await settings.save();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'extensionSettings',
        expect.stringContaining('"captureEnabled":false')
      );

      // Restore chrome
      global.chrome = originalChrome;
    });

    test('should load from localStorage when chrome.storage is not available', async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined;

      const storedData = JSON.stringify({
        captureEnabled: false,
        logLevels: ['error'],
        retentionDays: 15
      });

      const localStorageMock = {
        getItem: jest.fn(() => storedData)
      };
      global.localStorage = localStorageMock;

      await settings.load();

      expect(settings.captureEnabled).toBe(false);
      expect(settings.logLevels).toEqual(['error']);
      expect(settings.retentionDays).toBe(15);

      // Restore chrome
      global.chrome = originalChrome;
    });
  });
});