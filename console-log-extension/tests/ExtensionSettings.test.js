/**
 * Unit tests for ExtensionSettings class
 */

const ExtensionSettings = require('../models/ExtensionSettings.js');
const KeywordFilters = require('../models/KeywordFilters.js');

// Mock localStorage for testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('ExtensionSettings', () => {
  let settings;

  beforeEach(() => {
    settings = new ExtensionSettings();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(settings.captureEnabled).toBe(true);
      expect(settings.logLevels).toEqual(['log', 'error', 'warn', 'info']);
      expect(settings.retentionDays).toBe(30);
      expect(settings.maxStorageSize).toBe(100);
      expect(settings.keywordFilters).toBeNull();
      expect(settings.sensitiveDataFiltering).toBe(true);
      expect(settings.websiteSettings).toBeInstanceOf(Map);
    });
  });

  describe('setKeywordFilters', () => {
    test('should set keyword filters instance', () => {
      const keywordFilters = new KeywordFilters();
      settings.setKeywordFilters(keywordFilters);
      expect(settings.keywordFilters).toBe(keywordFilters);
    });

    test('should return this for chaining', () => {
      const result = settings.setKeywordFilters(new KeywordFilters());
      expect(result).toBe(settings);
    });
  });

  describe('setCaptureEnabled', () => {
    test('should set capture enabled state', () => {
      settings.setCaptureEnabled(false);
      expect(settings.captureEnabled).toBe(false);
      
      settings.setCaptureEnabled(true);
      expect(settings.captureEnabled).toBe(true);
    });

    test('should convert to boolean', () => {
      settings.setCaptureEnabled('false');
      expect(settings.captureEnabled).toBe(true);
      
      settings.setCaptureEnabled(0);
      expect(settings.captureEnabled).toBe(false);
    });

    test('should return this for chaining', () => {
      const result = settings.setCaptureEnabled(false);
      expect(result).toBe(settings);
    });
  });

  describe('setLogLevels', () => {
    test('should set log levels array', () => {
      settings.setLogLevels(['error', 'warn']);
      expect(settings.logLevels).toEqual(['error', 'warn']);
    });

    test('should handle non-array input', () => {
      settings.setLogLevels('error');
      expect(settings.logLevels).toEqual(['log', 'error', 'warn', 'info']);
    });

    test('should return this for chaining', () => {
      const result = settings.setLogLevels(['error']);
      expect(result).toBe(settings);
    });
  });

  describe('setRetentionDays', () => {
    test('should set retention days', () => {
      settings.setRetentionDays(60);
      expect(settings.retentionDays).toBe(60);
    });

    test('should enforce minimum value', () => {
      settings.setRetentionDays(0);
      expect(settings.retentionDays).toBe(1);
      
      settings.setRetentionDays(-5);
      expect(settings.retentionDays).toBe(1);
    });

    test('should handle invalid input', () => {
      settings.setRetentionDays('invalid');
      expect(settings.retentionDays).toBe(30);
    });

    test('should return this for chaining', () => {
      const result = settings.setRetentionDays(60);
      expect(result).toBe(settings);
    });
  });

  describe('setMaxStorageSize', () => {
    test('should set max storage size', () => {
      settings.setMaxStorageSize(200);
      expect(settings.maxStorageSize).toBe(200);
    });

    test('should enforce minimum value', () => {
      settings.setMaxStorageSize(0);
      expect(settings.maxStorageSize).toBe(1);
    });

    test('should return this for chaining', () => {
      const result = settings.setMaxStorageSize(200);
      expect(result).toBe(settings);
    });
  });

  describe('setSensitiveDataFiltering', () => {
    test('should set sensitive data filtering state', () => {
      settings.setSensitiveDataFiltering(false);
      expect(settings.sensitiveDataFiltering).toBe(false);
    });

    test('should return this for chaining', () => {
      const result = settings.setSensitiveDataFiltering(false);
      expect(result).toBe(settings);
    });
  });

  describe('website settings management', () => {
    test('should set website settings', () => {
      const websiteSettings = { enabled: false, customFilters: {} };
      settings.setWebsiteSettings('example.com', websiteSettings);
      
      expect(settings.getWebsiteSettings('example.com')).toBe(websiteSettings);
    });

    test('should get website settings', () => {
      const websiteSettings = { enabled: true };
      settings.setWebsiteSettings('test.com', websiteSettings);
      
      expect(settings.getWebsiteSettings('test.com')).toBe(websiteSettings);
      expect(settings.getWebsiteSettings('nonexistent.com')).toBeNull();
    });

    test('should remove website settings', () => {
      settings.setWebsiteSettings('example.com', { enabled: false });
      settings.removeWebsiteSettings('example.com');
      
      expect(settings.getWebsiteSettings('example.com')).toBeNull();
    });

    test('should handle invalid inputs', () => {
      settings.setWebsiteSettings('', { enabled: false });
      settings.setWebsiteSettings('example.com', null);
      
      expect(settings.websiteSettings.size).toBe(0);
    });
  });

  describe('isCaptureEnabledForDomain', () => {
    test('should return false when global capture is disabled', () => {
      settings.setCaptureEnabled(false);
      expect(settings.isCaptureEnabledForDomain('example.com')).toBe(false);
    });

    test('should return true by default when no website settings exist', () => {
      expect(settings.isCaptureEnabledForDomain('example.com')).toBe(true);
    });

    test('should respect website-specific settings', () => {
      settings.setWebsiteSettings('example.com', { enabled: false });
      expect(settings.isCaptureEnabledForDomain('example.com')).toBe(false);
      
      settings.setWebsiteSettings('test.com', { enabled: true });
      expect(settings.isCaptureEnabledForDomain('test.com')).toBe(true);
    });

    test('should handle website settings without enabled property', () => {
      settings.setWebsiteSettings('example.com', { customFilters: {} });
      expect(settings.isCaptureEnabledForDomain('example.com')).toBe(true);
    });
  });

  describe('save and load', () => {
    test('should save to localStorage when chrome.storage is not available', async () => {
      const keywordFilters = new KeywordFilters();
      keywordFilters.setIncludeKeywords(['error']);
      settings.setKeywordFilters(keywordFilters);
      settings.setWebsiteSettings('example.com', { enabled: false });
      
      await settings.save();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'extensionSettings',
        expect.stringContaining('"captureEnabled":true')
      );
    });

    test('should load from localStorage when chrome.storage is not available', async () => {
      const mockData = {
        captureEnabled: false,
        logLevels: ['error'],
        retentionDays: 60,
        maxStorageSize: 200,
        sensitiveDataFiltering: false,
        websiteSettings: {
          'example.com': { enabled: false }
        }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));
      
      await settings.load();
      
      expect(settings.captureEnabled).toBe(false);
      expect(settings.logLevels).toEqual(['error']);
      expect(settings.retentionDays).toBe(60);
      expect(settings.maxStorageSize).toBe(200);
      expect(settings.sensitiveDataFiltering).toBe(false);
      expect(settings.getWebsiteSettings('example.com')).toEqual({ enabled: false });
    });

    test('should handle missing data during load', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      await settings.load();
      
      // Should maintain default values
      expect(settings.captureEnabled).toBe(true);
      expect(settings.logLevels).toEqual(['log', 'error', 'warn', 'info']);
    });

    test('should handle save errors', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      await expect(settings.save()).rejects.toThrow('Failed to save settings');
    });

    test('should handle load errors', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      await expect(settings.load()).rejects.toThrow('Failed to load settings');
    });
  });

  describe('reset', () => {
    test('should reset all settings to defaults', () => {
      settings.setCaptureEnabled(false)
              .setLogLevels(['error'])
              .setRetentionDays(60)
              .setMaxStorageSize(200)
              .setSensitiveDataFiltering(false);
      
      settings.setWebsiteSettings('example.com', { enabled: false });
      
      settings.reset();
      
      expect(settings.captureEnabled).toBe(true);
      expect(settings.logLevels).toEqual(['log', 'error', 'warn', 'info']);
      expect(settings.retentionDays).toBe(30);
      expect(settings.maxStorageSize).toBe(100);
      expect(settings.sensitiveDataFiltering).toBe(true);
      expect(settings.websiteSettings.size).toBe(0);
    });

    test('should return this for chaining', () => {
      const result = settings.reset();
      expect(result).toBe(settings);
    });
  });

  describe('toJSON and fromJSON', () => {
    test('should serialize and deserialize correctly', () => {
      const keywordFilters = new KeywordFilters();
      keywordFilters.setIncludeKeywords(['error']);
      
      settings.setCaptureEnabled(false)
              .setLogLevels(['error', 'warn'])
              .setRetentionDays(60)
              .setKeywordFilters(keywordFilters);
      
      settings.setWebsiteSettings('example.com', { enabled: false });
      
      const json = settings.toJSON();
      const restored = ExtensionSettings.fromJSON(json);
      
      expect(restored.captureEnabled).toBe(settings.captureEnabled);
      expect(restored.logLevels).toEqual(settings.logLevels);
      expect(restored.retentionDays).toBe(settings.retentionDays);
      expect(restored.getWebsiteSettings('example.com')).toEqual({ enabled: false });
    });

    test('should handle null/undefined data', () => {
      const restored = ExtensionSettings.fromJSON(null);
      expect(restored.captureEnabled).toBe(true);
      expect(restored.logLevels).toEqual(['log', 'error', 'warn', 'info']);
    });

    test('should handle partial data', () => {
      const partialData = { captureEnabled: false };
      const restored = ExtensionSettings.fromJSON(partialData);
      
      expect(restored.captureEnabled).toBe(false);
      expect(restored.logLevels).toEqual(['log', 'error', 'warn', 'info']);
    });

    test('should handle invalid retention and storage values', () => {
      const invalidData = { 
        retentionDays: -5, 
        maxStorageSize: 0 
      };
      const restored = ExtensionSettings.fromJSON(invalidData);
      
      expect(restored.retentionDays).toBe(1);
      expect(restored.maxStorageSize).toBe(1);
    });
  });
});