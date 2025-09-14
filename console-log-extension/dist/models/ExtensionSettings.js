/**
 * ExtensionSettings class for managing extension configuration
 * Handles save/load operations with Chrome storage APIs
 */
class ExtensionSettings {
  constructor() {
    this.captureEnabled = true;
    this.logLevels = ['log', 'error', 'warn', 'info'];
    this.retentionDays = 30;
    this.maxStorageSize = 100; // MB
    this.keywordFilters = null; // Will be set to KeywordFilters instance
    this.sensitiveDataFiltering = true;
    this.websiteSettings = new Map();
  }

  /**
   * Sets keyword filters instance
   * @param {KeywordFilters} keywordFilters - KeywordFilters instance
   * @returns {ExtensionSettings} This instance for chaining
   */
  setKeywordFilters(keywordFilters) {
    this.keywordFilters = keywordFilters;
    return this;
  }

  /**
   * Sets capture enabled state
   * @param {boolean} enabled - Whether capture is enabled
   * @returns {ExtensionSettings} This instance for chaining
   */
  setCaptureEnabled(enabled) {
    this.captureEnabled = Boolean(enabled);
    return this;
  }

  /**
   * Sets which log levels to capture
   * @param {Array<string>} levels - Array of log levels
   * @returns {ExtensionSettings} This instance for chaining
   */
  setLogLevels(levels) {
    this.logLevels = Array.isArray(levels) ? levels : ['log', 'error', 'warn', 'info'];
    return this;
  }

  /**
   * Sets retention policy in days
   * @param {number} days - Number of days to retain logs
   * @returns {ExtensionSettings} This instance for chaining
   */
  setRetentionDays(days) {
    const parsedDays = parseInt(days);
    this.retentionDays = Math.max(1, isNaN(parsedDays) ? 30 : parsedDays);
    return this;
  }

  /**
   * Sets maximum storage size in MB
   * @param {number} sizeMB - Maximum storage size in megabytes
   * @returns {ExtensionSettings} This instance for chaining
   */
  setMaxStorageSize(sizeMB) {
    const parsedSize = parseInt(sizeMB);
    this.maxStorageSize = Math.max(1, isNaN(parsedSize) ? 100 : parsedSize);
    return this;
  }

  /**
   * Sets sensitive data filtering enabled state
   * @param {boolean} enabled - Whether sensitive data filtering is enabled
   * @returns {ExtensionSettings} This instance for chaining
   */
  setSensitiveDataFiltering(enabled) {
    this.sensitiveDataFiltering = Boolean(enabled);
    return this;
  }

  /**
   * Sets website-specific settings
   * @param {string} domain - Domain name
   * @param {Object} settings - Website-specific settings
   * @returns {ExtensionSettings} This instance for chaining
   */
  setWebsiteSettings(domain, settings) {
    if (domain && settings) {
      this.websiteSettings.set(domain, settings);
    }
    return this;
  }

  /**
   * Gets website-specific settings
   * @param {string} domain - Domain name
   * @returns {Object|null} Website settings or null if not found
   */
  getWebsiteSettings(domain) {
    return this.websiteSettings.get(domain) || null;
  }

  /**
   * Removes website-specific settings
   * @param {string} domain - Domain name
   * @returns {ExtensionSettings} This instance for chaining
   */
  removeWebsiteSettings(domain) {
    this.websiteSettings.delete(domain);
    return this;
  }

  /**
   * Checks if capture is enabled for a specific domain
   * @param {string} domain - Domain name
   * @returns {boolean} True if capture is enabled
   */
  isCaptureEnabledForDomain(domain) {
    if (!this.captureEnabled) return false;
    
    const websiteSettings = this.getWebsiteSettings(domain);
    if (websiteSettings && typeof websiteSettings.enabled === 'boolean') {
      return websiteSettings.enabled;
    }
    
    return true; // Default to enabled if no specific setting
  }

  /**
   * Saves settings to Chrome storage
   * @returns {Promise<void>} Promise that resolves when save is complete
   */
  async save() {
    try {
      const data = this.toJSON();
      
      // Use chrome.storage.sync if available (extension context)
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        return new Promise((resolve, reject) => {
          chrome.storage.sync.set({ extensionSettings: data }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(`Failed to save settings: ${chrome.runtime.lastError.message}`));
            } else {
              resolve();
            }
          });
        });
      } else {
        // Fallback to localStorage for testing
        localStorage.setItem('extensionSettings', JSON.stringify(data));
        return Promise.resolve();
      }
    } catch (error) {
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  /**
   * Loads settings from Chrome storage
   * @returns {Promise<ExtensionSettings>} Promise that resolves with loaded settings
   */
  async load() {
    try {
      // Use chrome.storage.sync if available (extension context)
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        return new Promise((resolve, reject) => {
          chrome.storage.sync.get(['extensionSettings'], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(`Failed to load settings: ${chrome.runtime.lastError.message}`));
            } else {
              const data = result.extensionSettings;
              if (data) {
                this.fromJSON(data);
              }
              resolve(this);
            }
          });
        });
      } else {
        // Fallback to localStorage for testing
        const data = localStorage.getItem('extensionSettings');
        if (data) {
          this.fromJSON(JSON.parse(data));
        }
        return Promise.resolve(this);
      }
    } catch (error) {
      throw new Error(`Failed to load settings: ${error.message}`);
    }
  }

  /**
   * Resets settings to defaults
   * @returns {ExtensionSettings} This instance for chaining
   */
  reset() {
    this.captureEnabled = true;
    this.logLevels = ['log', 'error', 'warn', 'info'];
    this.retentionDays = 30;
    this.maxStorageSize = 100;
    this.keywordFilters = null;
    this.sensitiveDataFiltering = true;
    this.websiteSettings = new Map();
    return this;
  }

  /**
   * Gets default settings
   * @returns {Object} Default settings object
   */
  getDefaults() {
    return {
      captureEnabled: true,
      logLevels: ['log', 'error', 'warn', 'info'],
      retentionDays: 30,
      maxStorageSize: 100,
      keywordFilters: null,
      sensitiveDataFiltering: true,
      websiteSettings: {}
    };
  }

  /**
   * Converts ExtensionSettings to JSON for storage
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      captureEnabled: this.captureEnabled,
      logLevels: this.logLevels,
      retentionDays: this.retentionDays,
      maxStorageSize: this.maxStorageSize,
      keywordFilters: this.keywordFilters ? this.keywordFilters.toJSON() : null,
      sensitiveDataFiltering: this.sensitiveDataFiltering,
      websiteSettings: Object.fromEntries(this.websiteSettings)
    };
  }

  /**
   * Loads settings from JSON data
   * @param {Object} data - JSON data
   * @returns {ExtensionSettings} This instance for chaining
   */
  fromJSON(data) {
    if (data) {
      this.captureEnabled = Boolean(data.captureEnabled !== false);
      this.logLevels = Array.isArray(data.logLevels) ? data.logLevels : ['log', 'error', 'warn', 'info'];
      
      const parsedRetentionDays = parseInt(data.retentionDays);
      this.retentionDays = Math.max(1, isNaN(parsedRetentionDays) ? 30 : parsedRetentionDays);
      
      const parsedMaxStorageSize = parseInt(data.maxStorageSize);
      this.maxStorageSize = Math.max(1, isNaN(parsedMaxStorageSize) ? 100 : parsedMaxStorageSize);
      
      this.sensitiveDataFiltering = Boolean(data.sensitiveDataFiltering !== false);
      
      // Handle keyword filters
      if (data.keywordFilters && typeof require !== 'undefined') {
        const KeywordFilters = require('./KeywordFilters.js');
        this.keywordFilters = KeywordFilters.fromJSON(data.keywordFilters);
      }
      
      // Handle website settings
      this.websiteSettings = new Map();
      if (data.websiteSettings && typeof data.websiteSettings === 'object') {
        Object.entries(data.websiteSettings).forEach(([domain, settings]) => {
          this.websiteSettings.set(domain, settings);
        });
      }
    }
    return this;
  }

  /**
   * Creates ExtensionSettings from JSON data
   * @param {Object} data - JSON data
   * @returns {ExtensionSettings} ExtensionSettings instance
   */
  static fromJSON(data) {
    const settings = new ExtensionSettings();
    return settings.fromJSON(data);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionSettings;
} else if (typeof window !== 'undefined') {
  window.ExtensionSettings = ExtensionSettings;
} else if (typeof self !== 'undefined') {
  self.ExtensionSettings = ExtensionSettings;
}

