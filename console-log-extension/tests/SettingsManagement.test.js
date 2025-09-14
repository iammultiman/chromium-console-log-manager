/**
 * Tests for settings management functionality in background script
 */

const ExtensionSettings = require('../models/ExtensionSettings.js');
const KeywordFilters = require('../models/KeywordFilters.js');

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: jest.fn(() => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      createObjectStore: jest.fn(() => ({
        createIndex: jest.fn()
      })),
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          add: jest.fn(),
          put: jest.fn(),
          get: jest.fn(),
          delete: jest.fn(),
          clear: jest.fn(),
          openCursor: jest.fn()
        }))
      }))
    }
  }))
};

global.indexedDB = mockIndexedDB;

// Mock chrome APIs
global.chrome = {
  storage: {
    sync: {
      set: jest.fn((data, callback) => callback()),
      get: jest.fn((keys, callback) => callback({}))
    }
  },
  tabs: {
    query: jest.fn((query, callback) => callback([])),
    sendMessage: jest.fn(() => Promise.resolve())
  },
  runtime: {
    lastError: null
  }
};

// Mock the chrome event listeners to prevent errors during import
const mockChromeRuntime = {
  onMessage: {
    addListener: jest.fn()
  }
};

const mockChromeTabs = {
  onRemoved: {
    addListener: jest.fn()
  },
  onUpdated: {
    addListener: jest.fn()
  }
};

// Set up chrome mocks before importing
global.chrome.runtime = { ...global.chrome.runtime, ...mockChromeRuntime };
global.chrome.tabs = { ...global.chrome.tabs, ...mockChromeTabs };

// Import background script functions
const {
  updateSettings,
  updateWebsiteSettings,
  getWebsiteSettings,
  removeWebsiteSettings,
  syncSettings,
  resetSettings,
  validateSettings,
  validateKeywordFilters,
  validateWebsiteSettings,
  getDefaultWebsiteSettings,
  initialize
} = require('../background/background.js');

describe('Settings Management', () => {
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock IndexedDB request success
    const mockRequest = mockIndexedDB.open();
    setTimeout(() => {
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }
    }, 0);
    
    // Initialize background script
    try {
      await initialize();
    } catch (error) {
      // Ignore initialization errors for settings-only tests
      console.warn('Background script initialization failed, continuing with settings tests');
    }
  });

  describe('updateSettings', () => {
    test('should update global settings successfully', async () => {
      const newSettings = {
        captureEnabled: false,
        logLevels: ['error', 'warn'],
        retentionDays: 14,
        maxStorageSize: 50,
        sensitiveDataFiltering: false,
        keywordFilters: {
          include: ['test'],
          exclude: ['debug'],
          caseSensitive: true
        }
      };

      const result = await updateSettings(newSettings);

      expect(result.success).toBe(true);
      expect(result.settings).toMatchObject(newSettings);
      expect(result.timestamp).toBeDefined();
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });

    test('should validate settings before updating', async () => {
      const invalidSettings = {
        captureEnabled: 'invalid',
        logLevels: 'not-array',
        retentionDays: -1
      };

      await expect(updateSettings(invalidSettings)).rejects.toThrow();
    });

    test('should handle keyword filters correctly', async () => {
      const settingsWithFilters = {
        keywordFilters: {
          include: ['error', 'warning'],
          exclude: ['debug', 'trace'],
          caseSensitive: false
        }
      };

      const result = await updateSettings(settingsWithFilters);

      expect(result.success).toBe(true);
      expect(result.settings.keywordFilters).toEqual(settingsWithFilters.keywordFilters);
    });
  });

  describe('updateWebsiteSettings', () => {
    test('should update website-specific settings', async () => {
      const domain = 'example.com';
      const websiteSettings = {
        enabled: false,
        logLevels: ['error'],
        keywordFilters: {
          include: ['critical'],
          exclude: [],
          caseSensitive: true
        }
      };

      const result = await updateWebsiteSettings(domain, websiteSettings);

      expect(result.success).toBe(true);
      expect(result.domain).toBe(domain);
      expect(result.settings).toEqual(websiteSettings);
      expect(result.timestamp).toBeDefined();
    });

    test('should validate domain parameter', async () => {
      await expect(updateWebsiteSettings(null, {})).rejects.toThrow('Valid domain is required');
      await expect(updateWebsiteSettings('', {})).rejects.toThrow('Valid domain is required');
    });

    test('should validate website settings', async () => {
      const domain = 'example.com';
      const invalidSettings = {
        enabled: 'not-boolean',
        logLevels: 'not-array'
      };

      await expect(updateWebsiteSettings(domain, invalidSettings)).rejects.toThrow();
    });
  });

  describe('getWebsiteSettings', () => {
    test('should return existing website settings', async () => {
      const domain = 'example.com';
      const websiteSettings = {
        enabled: false,
        logLevels: ['error']
      };

      // First set the settings
      await updateWebsiteSettings(domain, websiteSettings);

      // Then get them
      const result = await getWebsiteSettings(domain);

      expect(result.domain).toBe(domain);
      expect(result.settings).toMatchObject(websiteSettings);
      expect(result.hasCustomSettings).toBe(true);
    });

    test('should return default settings for unknown domain', async () => {
      const domain = 'unknown.com';
      const result = await getWebsiteSettings(domain);

      expect(result.domain).toBe(domain);
      expect(result.settings).toEqual(getDefaultWebsiteSettings());
      expect(result.hasCustomSettings).toBe(false);
    });

    test('should validate domain parameter', async () => {
      await expect(getWebsiteSettings(null)).rejects.toThrow('Valid domain is required');
      await expect(getWebsiteSettings('')).rejects.toThrow('Valid domain is required');
    });
  });

  describe('removeWebsiteSettings', () => {
    test('should remove existing website settings', async () => {
      const domain = 'example.com';
      const websiteSettings = { enabled: false };

      // First set the settings
      await updateWebsiteSettings(domain, websiteSettings);

      // Then remove them
      const result = await removeWebsiteSettings(domain);

      expect(result.success).toBe(true);
      expect(result.domain).toBe(domain);
      expect(result.hadSettings).toBe(true);
      expect(result.timestamp).toBeDefined();

      // Verify they're actually removed
      const getResult = await getWebsiteSettings(domain);
      expect(getResult.hasCustomSettings).toBe(false);
    });

    test('should handle removing non-existent settings', async () => {
      const domain = 'nonexistent.com';
      const result = await removeWebsiteSettings(domain);

      expect(result.success).toBe(true);
      expect(result.domain).toBe(domain);
      expect(result.hadSettings).toBe(false);
    });

    test('should validate domain parameter', async () => {
      await expect(removeWebsiteSettings(null)).rejects.toThrow('Valid domain is required');
      await expect(removeWebsiteSettings('')).rejects.toThrow('Valid domain is required');
    });
  });

  describe('syncSettings', () => {
    test('should sync settings from storage', async () => {
      // Mock storage to return specific settings
      const storedSettings = {
        captureEnabled: false,
        logLevels: ['error'],
        keywordFilters: {
          include: ['test'],
          exclude: [],
          caseSensitive: false
        }
      };

      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ extensionSettings: storedSettings });
      });

      const result = await syncSettings();

      expect(result.success).toBe(true);
      expect(result.settings).toMatchObject(storedSettings);
      expect(result.timestamp).toBeDefined();
    });

    test('should handle sync errors gracefully', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        chrome.runtime.lastError = { message: 'Storage error' };
        callback({});
      });

      await expect(syncSettings()).rejects.toThrow('Failed to sync settings');

      // Reset error
      chrome.runtime.lastError = null;
    });
  });

  describe('resetSettings', () => {
    test('should reset settings to defaults', async () => {
      // First set some custom settings
      await updateSettings({
        captureEnabled: false,
        logLevels: ['error'],
        retentionDays: 7
      });

      // Then reset
      const result = await resetSettings();

      expect(result.success).toBe(true);
      expect(result.settings.captureEnabled).toBe(true);
      expect(result.settings.logLevels).toEqual(['log', 'error', 'warn', 'info']);
      expect(result.settings.retentionDays).toBe(30);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('validateSettings', () => {
    test('should validate valid settings', () => {
      const validSettings = {
        captureEnabled: true,
        logLevels: ['log', 'error'],
        retentionDays: 30,
        maxStorageSize: 100,
        sensitiveDataFiltering: true,
        keywordFilters: {
          include: ['test'],
          exclude: ['debug'],
          caseSensitive: false
        },
        websiteSettings: {
          'example.com': {
            enabled: false,
            logLevels: ['error']
          }
        }
      };

      expect(() => validateSettings(validSettings)).not.toThrow();
    });

    test('should reject invalid settings', () => {
      expect(() => validateSettings(null)).toThrow('Settings must be an object');
      expect(() => validateSettings({ captureEnabled: 'invalid' })).toThrow('captureEnabled must be a boolean');
      expect(() => validateSettings({ logLevels: 'invalid' })).toThrow('logLevels must be an array');
      expect(() => validateSettings({ logLevels: ['invalid'] })).toThrow('Invalid log levels');
      expect(() => validateSettings({ retentionDays: -1 })).toThrow('retentionDays must be a number between 1 and 365');
      expect(() => validateSettings({ maxStorageSize: 0 })).toThrow('maxStorageSize must be a number between 1 and 10000 MB');
    });
  });

  describe('validateKeywordFilters', () => {
    test('should validate valid keyword filters', () => {
      const validFilters = {
        include: ['test', 'error'],
        exclude: ['debug'],
        caseSensitive: true
      };

      expect(() => validateKeywordFilters(validFilters)).not.toThrow();
    });

    test('should reject invalid keyword filters', () => {
      expect(() => validateKeywordFilters(null)).toThrow('keywordFilters must be an object');
      expect(() => validateKeywordFilters({ include: 'invalid' })).toThrow('keywordFilters.include must be an array');
      expect(() => validateKeywordFilters({ exclude: 'invalid' })).toThrow('keywordFilters.exclude must be an array');
      expect(() => validateKeywordFilters({ caseSensitive: 'invalid' })).toThrow('keywordFilters.caseSensitive must be a boolean');
    });
  });

  describe('validateWebsiteSettings', () => {
    test('should validate valid website settings', () => {
      const validSettings = {
        enabled: true,
        logLevels: ['error', 'warn'],
        keywordFilters: {
          include: ['test'],
          exclude: [],
          caseSensitive: false
        }
      };

      expect(() => validateWebsiteSettings(validSettings, 'example.com')).not.toThrow();
    });

    test('should reject invalid website settings', () => {
      expect(() => validateWebsiteSettings(null, 'example.com')).toThrow('Website settings for example.com must be an object');
      expect(() => validateWebsiteSettings({ enabled: 'invalid' }, 'example.com')).toThrow('Website settings enabled for example.com must be a boolean');
      expect(() => validateWebsiteSettings({ logLevels: 'invalid' }, 'example.com')).toThrow('Website settings logLevels for example.com must be an array');
      expect(() => validateWebsiteSettings({ logLevels: ['invalid'] }, 'example.com')).toThrow('Invalid log levels for example.com');
    });
  });

  describe('getDefaultWebsiteSettings', () => {
    test('should return valid default settings', () => {
      const defaults = getDefaultWebsiteSettings();

      expect(defaults).toEqual({
        enabled: true,
        logLevels: ['log', 'error', 'warn', 'info'],
        keywordFilters: {
          include: [],
          exclude: [],
          caseSensitive: false
        }
      });
    });
  });
});