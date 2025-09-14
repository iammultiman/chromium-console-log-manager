/**
 * Tests for settings configuration interface
 */

const { JSDOM } = require('jsdom');

// Mock chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        callback({ extensionSettings: null });
      }),
      set: jest.fn((data, callback) => {
        callback();
      })
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    lastError: null
  }
};

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

describe('Settings Configuration Interface', () => {
  let dom;
  let document;
  let window;
  let ExtensionSettings;
  let KeywordFilters;
  let OptionsPageManager;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <input id="capture-enabled" type="checkbox">
          <input id="max-logs-per-session" type="number" value="1000">
          <input name="log-levels" type="checkbox" value="error">
          <input name="log-levels" type="checkbox" value="warn">
          <input name="log-levels" type="checkbox" value="info">
          <input name="log-levels" type="checkbox" value="log">
          <input id="retention-days" type="number" value="30">
          <input id="max-storage" type="number" value="100">
          <textarea id="include-keywords"></textarea>
          <textarea id="exclude-keywords"></textarea>
          <input id="case-sensitive" type="checkbox">
          <input id="sensitive-data-filtering" type="checkbox">
          <input id="website-domain" type="text">
          <div id="website-settings-list"></div>
          <button id="save-settings">Save Settings</button>
          <button id="reset-settings">Reset Settings</button>
          <button id="add-website-setting">Add Website</button>
        </body>
      </html>
    `);

    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
    global.confirm = jest.fn(() => true);

    // Load the classes
    ExtensionSettings = require('../models/ExtensionSettings.js');
    KeywordFilters = require('../models/KeywordFilters.js');

    // Mock OptionsPageManager class (simplified for testing)
    class MockOptionsPageManager {
      constructor() {
        this.extensionSettings = new ExtensionSettings();
      }

      escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      isValidDomain(domain) {
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return domainRegex.test(domain) && domain.length <= 253;
      }

      populateSettingsForm() {
        document.getElementById('capture-enabled').checked = this.extensionSettings.captureEnabled;
        document.getElementById('max-logs-per-session').value = this.extensionSettings.maxLogsPerSession || 1000;
        
        const logLevelCheckboxes = document.querySelectorAll('input[name="log-levels"]');
        logLevelCheckboxes.forEach(checkbox => {
          checkbox.checked = this.extensionSettings.logLevels.includes(checkbox.value);
        });
        
        document.getElementById('retention-days').value = this.extensionSettings.retentionDays;
        document.getElementById('max-storage').value = this.extensionSettings.maxStorageSize;
        
        const keywordFilters = this.extensionSettings.keywordFilters;
        if (keywordFilters) {
          document.getElementById('include-keywords').value = keywordFilters.include.join(', ');
          document.getElementById('exclude-keywords').value = keywordFilters.exclude.join(', ');
          document.getElementById('case-sensitive').checked = keywordFilters.caseSensitive;
        }
        
        document.getElementById('sensitive-data-filtering').checked = this.extensionSettings.sensitiveDataFiltering;
      }

      collectSettingsFormData() {
        const captureEnabled = document.getElementById('capture-enabled').checked;
        const maxLogsPerSession = parseInt(document.getElementById('max-logs-per-session').value) || 1000;
        
        const logLevels = Array.from(document.querySelectorAll('input[name="log-levels"]:checked'))
          .map(checkbox => checkbox.value);
        
        const retentionDays = parseInt(document.getElementById('retention-days').value) || 30;
        const maxStorageSize = parseInt(document.getElementById('max-storage').value) || 100;
        
        const includeKeywords = document.getElementById('include-keywords').value
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
        
        const excludeKeywords = document.getElementById('exclude-keywords').value
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
        
        const caseSensitive = document.getElementById('case-sensitive').checked;
        const sensitiveDataFiltering = document.getElementById('sensitive-data-filtering').checked;
        
        return {
          captureEnabled,
          maxLogsPerSession,
          logLevels,
          retentionDays,
          maxStorageSize,
          includeKeywords,
          excludeKeywords,
          caseSensitive,
          sensitiveDataFiltering
        };
      }

      validateSettings(formData) {
        if (formData.retentionDays < 1 || formData.retentionDays > 365) {
          return { valid: false, message: 'Retention days must be between 1 and 365.' };
        }
        
        if (formData.maxStorageSize < 10 || formData.maxStorageSize > 1000) {
          return { valid: false, message: 'Maximum storage size must be between 10 and 1000 MB.' };
        }
        
        if (formData.maxLogsPerSession < 100 || formData.maxLogsPerSession > 10000) {
          return { valid: false, message: 'Maximum logs per session must be between 100 and 10,000.' };
        }
        
        if (formData.logLevels.length === 0) {
          return { valid: false, message: 'At least one log level must be selected.' };
        }
        
        return { valid: true };
      }

      updateSettingsFromForm(formData) {
        this.extensionSettings
          .setCaptureEnabled(formData.captureEnabled)
          .setLogLevels(formData.logLevels)
          .setRetentionDays(formData.retentionDays)
          .setMaxStorageSize(formData.maxStorageSize)
          .setSensitiveDataFiltering(formData.sensitiveDataFiltering);
        
        this.extensionSettings.maxLogsPerSession = formData.maxLogsPerSession;
        
        if (this.extensionSettings.keywordFilters) {
          this.extensionSettings.keywordFilters
            .setIncludeKeywords(formData.includeKeywords)
            .setExcludeKeywords(formData.excludeKeywords)
            .setCaseSensitive(formData.caseSensitive);
        }
      }

      renderWebsiteSetting(domain, settings) {
        const enabledClass = settings.enabled ? 'enabled' : 'disabled';
        const enabledText = settings.enabled ? 'Enabled' : 'Disabled';
        
        return `
          <div class="website-setting-item ${enabledClass}">
            <div class="website-setting-info">
              <span class="website-setting-domain">${this.escapeHtml(domain)}</span>
              <span class="website-setting-status">${enabledText}</span>
            </div>
            <div class="website-setting-controls">
              <button class="btn-secondary toggle-website-setting" data-domain="${domain}">
                ${settings.enabled ? 'Disable' : 'Enable'}
              </button>
              <button class="btn-danger remove-website-setting" data-domain="${domain}">
                Remove
              </button>
            </div>
          </div>
        `;
      }

      populateWebsiteSettingsList() {
        const listContainer = document.getElementById('website-settings-list');
        
        if (this.extensionSettings.websiteSettings.size === 0) {
          listContainer.innerHTML = '<p class="no-website-settings">No website-specific settings configured.</p>';
          return;
        }
        
        const settingsHTML = Array.from(this.extensionSettings.websiteSettings.entries())
          .map(([domain, settings]) => this.renderWebsiteSetting(domain, settings))
          .join('');
        
        listContainer.innerHTML = settingsHTML;
      }
    }

    OptionsPageManager = MockOptionsPageManager;
  });

  afterEach(() => {
    dom.window.close();
    jest.clearAllMocks();
  });

  describe('ExtensionSettings Model', () => {
    test('should create settings with default values', () => {
      const settings = new ExtensionSettings();
      
      expect(settings.captureEnabled).toBe(true);
      expect(settings.logLevels).toEqual(['log', 'error', 'warn', 'info']);
      expect(settings.retentionDays).toBe(30);
      expect(settings.maxStorageSize).toBe(100);
      expect(settings.sensitiveDataFiltering).toBe(true);
      expect(settings.websiteSettings).toBeInstanceOf(Map);
    });

    test('should set capture enabled state', () => {
      const settings = new ExtensionSettings();
      settings.setCaptureEnabled(false);
      
      expect(settings.captureEnabled).toBe(false);
    });

    test('should set log levels', () => {
      const settings = new ExtensionSettings();
      settings.setLogLevels(['error', 'warn']);
      
      expect(settings.logLevels).toEqual(['error', 'warn']);
    });

    test('should validate retention days', () => {
      const settings = new ExtensionSettings();
      
      settings.setRetentionDays(0); // Should be clamped to 1
      expect(settings.retentionDays).toBe(1);
      
      settings.setRetentionDays(500); // Should be accepted
      expect(settings.retentionDays).toBe(500);
      
      settings.setRetentionDays('invalid'); // Should default to 30
      expect(settings.retentionDays).toBe(30);
    });

    test('should validate max storage size', () => {
      const settings = new ExtensionSettings();
      
      settings.setMaxStorageSize(0); // Should be clamped to 1
      expect(settings.maxStorageSize).toBe(1);
      
      settings.setMaxStorageSize(500); // Should be accepted
      expect(settings.maxStorageSize).toBe(500);
      
      settings.setMaxStorageSize('invalid'); // Should default to 100
      expect(settings.maxStorageSize).toBe(100);
    });

    test('should manage website-specific settings', () => {
      const settings = new ExtensionSettings();
      const websiteSettings = { enabled: false, customLogLevels: ['error'] };
      
      settings.setWebsiteSettings('example.com', websiteSettings);
      
      expect(settings.getWebsiteSettings('example.com')).toEqual(websiteSettings);
      expect(settings.getWebsiteSettings('nonexistent.com')).toBeNull();
      
      settings.removeWebsiteSettings('example.com');
      expect(settings.getWebsiteSettings('example.com')).toBeNull();
    });

    test('should check if capture is enabled for domain', () => {
      const settings = new ExtensionSettings();
      
      // Global capture disabled
      settings.setCaptureEnabled(false);
      expect(settings.isCaptureEnabledForDomain('example.com')).toBe(false);
      
      // Global capture enabled, no domain-specific setting
      settings.setCaptureEnabled(true);
      expect(settings.isCaptureEnabledForDomain('example.com')).toBe(true);
      
      // Domain-specific setting overrides global
      settings.setWebsiteSettings('example.com', { enabled: false });
      expect(settings.isCaptureEnabledForDomain('example.com')).toBe(false);
    });

    test('should convert to and from JSON', () => {
      const settings = new ExtensionSettings();
      settings.setCaptureEnabled(false);
      settings.setLogLevels(['error']);
      settings.setRetentionDays(60);
      settings.setWebsiteSettings('example.com', { enabled: false });
      
      const json = settings.toJSON();
      const newSettings = ExtensionSettings.fromJSON(json);
      
      expect(newSettings.captureEnabled).toBe(false);
      expect(newSettings.logLevels).toEqual(['error']);
      expect(newSettings.retentionDays).toBe(60);
      expect(newSettings.getWebsiteSettings('example.com')).toEqual({ enabled: false });
    });
  });

  describe('Settings Form Management', () => {
    let optionsManager;

    beforeEach(() => {
      optionsManager = new OptionsPageManager();
      optionsManager.extensionSettings.setKeywordFilters(new KeywordFilters());
    });

    test('should populate form with current settings', () => {
      // Set up test settings
      optionsManager.extensionSettings
        .setCaptureEnabled(false)
        .setLogLevels(['error', 'warn'])
        .setRetentionDays(60)
        .setMaxStorageSize(200)
        .setSensitiveDataFiltering(false);
      
      optionsManager.extensionSettings.keywordFilters
        .setIncludeKeywords(['test', 'debug'])
        .setExcludeKeywords(['noise'])
        .setCaseSensitive(true);
      
      optionsManager.populateSettingsForm();
      
      expect(document.getElementById('capture-enabled').checked).toBe(false);
      expect(document.getElementById('retention-days').value).toBe('60');
      expect(document.getElementById('max-storage').value).toBe('200');
      expect(document.getElementById('include-keywords').value).toBe('test, debug');
      expect(document.getElementById('exclude-keywords').value).toBe('noise');
      expect(document.getElementById('case-sensitive').checked).toBe(true);
      expect(document.getElementById('sensitive-data-filtering').checked).toBe(false);
    });

    test('should collect form data correctly', () => {
      // Set up form values
      document.getElementById('capture-enabled').checked = true;
      document.getElementById('max-logs-per-session').value = '2000';
      document.getElementById('retention-days').value = '45';
      document.getElementById('max-storage').value = '150';
      document.getElementById('include-keywords').value = 'error, debug, test';
      document.getElementById('exclude-keywords').value = 'spam, noise';
      document.getElementById('case-sensitive').checked = true;
      document.getElementById('sensitive-data-filtering').checked = false;
      
      // Check log level checkboxes
      document.querySelector('input[name="log-levels"][value="error"]').checked = true;
      document.querySelector('input[name="log-levels"][value="warn"]').checked = true;
      
      const formData = optionsManager.collectSettingsFormData();
      
      expect(formData.captureEnabled).toBe(true);
      expect(formData.maxLogsPerSession).toBe(2000);
      expect(formData.logLevels).toEqual(['error', 'warn']);
      expect(formData.retentionDays).toBe(45);
      expect(formData.maxStorageSize).toBe(150);
      expect(formData.includeKeywords).toEqual(['error', 'debug', 'test']);
      expect(formData.excludeKeywords).toEqual(['spam', 'noise']);
      expect(formData.caseSensitive).toBe(true);
      expect(formData.sensitiveDataFiltering).toBe(false);
    });

    test('should validate settings correctly', () => {
      // Valid settings
      const validData = {
        retentionDays: 30,
        maxStorageSize: 100,
        maxLogsPerSession: 1000,
        logLevels: ['error', 'warn']
      };
      
      expect(optionsManager.validateSettings(validData)).toEqual({ valid: true });
      
      // Invalid retention days
      const invalidRetention = { ...validData, retentionDays: 0 };
      expect(optionsManager.validateSettings(invalidRetention).valid).toBe(false);
      
      // Invalid storage size
      const invalidStorage = { ...validData, maxStorageSize: 5 };
      expect(optionsManager.validateSettings(invalidStorage).valid).toBe(false);
      
      // Invalid logs per session
      const invalidLogs = { ...validData, maxLogsPerSession: 50 };
      expect(optionsManager.validateSettings(invalidLogs).valid).toBe(false);
      
      // No log levels selected
      const noLevels = { ...validData, logLevels: [] };
      expect(optionsManager.validateSettings(noLevels).valid).toBe(false);
    });

    test('should update settings from form data', () => {
      const formData = {
        captureEnabled: false,
        maxLogsPerSession: 2000,
        logLevels: ['error'],
        retentionDays: 60,
        maxStorageSize: 200,
        includeKeywords: ['test'],
        excludeKeywords: ['noise'],
        caseSensitive: true,
        sensitiveDataFiltering: false
      };
      
      optionsManager.updateSettingsFromForm(formData);
      
      expect(optionsManager.extensionSettings.captureEnabled).toBe(false);
      expect(optionsManager.extensionSettings.logLevels).toEqual(['error']);
      expect(optionsManager.extensionSettings.retentionDays).toBe(60);
      expect(optionsManager.extensionSettings.maxStorageSize).toBe(200);
      expect(optionsManager.extensionSettings.maxLogsPerSession).toBe(2000);
      expect(optionsManager.extensionSettings.sensitiveDataFiltering).toBe(false);
      
      const keywordFilters = optionsManager.extensionSettings.keywordFilters;
      expect(keywordFilters.include).toEqual(['test']);
      expect(keywordFilters.exclude).toEqual(['noise']);
      expect(keywordFilters.caseSensitive).toBe(true);
    });
  });

  describe('Website Settings Management', () => {
    let optionsManager;

    beforeEach(() => {
      optionsManager = new OptionsPageManager();
    });

    test('should validate domain names correctly', () => {
      expect(optionsManager.isValidDomain('example.com')).toBe(true);
      expect(optionsManager.isValidDomain('sub.example.com')).toBe(true);
      expect(optionsManager.isValidDomain('test-site.co.uk')).toBe(true);
      expect(optionsManager.isValidDomain('localhost')).toBe(true);
      
      expect(optionsManager.isValidDomain('')).toBe(false);
      expect(optionsManager.isValidDomain('invalid..domain')).toBe(false);
      expect(optionsManager.isValidDomain('.example.com')).toBe(false);
      expect(optionsManager.isValidDomain('example.com.')).toBe(false);
    });

    test('should render website setting correctly', () => {
      const domain = 'example.com';
      const settings = { enabled: true };
      
      const html = optionsManager.renderWebsiteSetting(domain, settings);
      
      expect(html).toContain('example.com');
      expect(html).toContain('Enabled');
      expect(html).toContain('enabled');
      expect(html).toContain('Disable');
    });

    test('should render disabled website setting correctly', () => {
      const domain = 'example.com';
      const settings = { enabled: false };
      
      const html = optionsManager.renderWebsiteSetting(domain, settings);
      
      expect(html).toContain('example.com');
      expect(html).toContain('Disabled');
      expect(html).toContain('disabled');
      expect(html).toContain('Enable');
    });

    test('should populate website settings list when empty', () => {
      optionsManager.populateWebsiteSettingsList();
      
      const listContainer = document.getElementById('website-settings-list');
      expect(listContainer.innerHTML).toContain('No website-specific settings configured');
    });

    test('should populate website settings list with entries', () => {
      optionsManager.extensionSettings.setWebsiteSettings('example.com', { enabled: true });
      optionsManager.extensionSettings.setWebsiteSettings('test.com', { enabled: false });
      
      optionsManager.populateWebsiteSettingsList();
      
      const listContainer = document.getElementById('website-settings-list');
      expect(listContainer.innerHTML).toContain('example.com');
      expect(listContainer.innerHTML).toContain('test.com');
    });
  });

  describe('Settings Persistence', () => {
    let settings;

    beforeEach(() => {
      settings = new ExtensionSettings();
    });

    test('should save settings to chrome storage', async () => {
      settings.setCaptureEnabled(false);
      
      await settings.save();
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { extensionSettings: expect.objectContaining({ captureEnabled: false }) },
        expect.any(Function)
      );
    });

    test('should load settings from chrome storage', async () => {
      const mockData = {
        captureEnabled: false,
        logLevels: ['error'],
        retentionDays: 60
      };
      
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ extensionSettings: mockData });
      });
      
      await settings.load();
      
      expect(settings.captureEnabled).toBe(false);
      expect(settings.logLevels).toEqual(['error']);
      expect(settings.retentionDays).toBe(60);
    });

    test('should handle storage errors gracefully', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      
      await expect(settings.save()).rejects.toThrow('Failed to save settings: Storage error');
      
      chrome.runtime.lastError = null; // Reset for other tests
    });
  });
});