/**
 * Tests for settings validation functionality
 */

const ExtensionSettings = require('../models/ExtensionSettings.js');
const KeywordFilters = require('../models/KeywordFilters.js');

describe('Settings Validation', () => {
  let settings;

  beforeEach(() => {
    settings = new ExtensionSettings();
  });

  test('should validate capture enabled setting', () => {
    expect(settings.setCaptureEnabled(true).captureEnabled).toBe(true);
    expect(settings.setCaptureEnabled(false).captureEnabled).toBe(false);
    expect(settings.setCaptureEnabled('true').captureEnabled).toBe(true);
    expect(settings.setCaptureEnabled('').captureEnabled).toBe(false);
  });

  test('should validate log levels setting', () => {
    const validLevels = ['log', 'error'];
    expect(settings.setLogLevels(validLevels).logLevels).toEqual(validLevels);
    expect(settings.setLogLevels([]).logLevels).toEqual([]);
    expect(settings.setLogLevels(null).logLevels).toEqual(['log', 'error', 'warn', 'info']);
  });

  test('should validate retention days setting', () => {
    expect(settings.setRetentionDays(15).retentionDays).toBe(15);
    expect(settings.setRetentionDays('30').retentionDays).toBe(30);
    expect(settings.setRetentionDays(0).retentionDays).toBe(1);
    expect(settings.setRetentionDays(-5).retentionDays).toBe(1);
    expect(settings.setRetentionDays('invalid').retentionDays).toBe(30);
  });

  test('should validate max storage size setting', () => {
    expect(settings.setMaxStorageSize(50).maxStorageSize).toBe(50);
    expect(settings.setMaxStorageSize('100').maxStorageSize).toBe(100);
    expect(settings.setMaxStorageSize(0).maxStorageSize).toBe(1);
    expect(settings.setMaxStorageSize(-10).maxStorageSize).toBe(1);
    expect(settings.setMaxStorageSize('invalid').maxStorageSize).toBe(100);
  });

  test('should validate sensitive data filtering setting', () => {
    expect(settings.setSensitiveDataFiltering(true).sensitiveDataFiltering).toBe(true);
    expect(settings.setSensitiveDataFiltering(false).sensitiveDataFiltering).toBe(false);
    expect(settings.setSensitiveDataFiltering('true').sensitiveDataFiltering).toBe(true);
    expect(settings.setSensitiveDataFiltering('').sensitiveDataFiltering).toBe(false);
  });

  test('should validate website settings operations', () => {
    const domain = 'example.com';
    const websiteSettings = {
      enabled: false,
      logLevels: ['error'],
      keywordFilters: {
        include: ['test'],
        exclude: [],
        caseSensitive: true
      }
    };

    // Set website settings
    settings.setWebsiteSettings(domain, websiteSettings);
    expect(settings.getWebsiteSettings(domain)).toEqual(websiteSettings);

    // Remove website settings
    settings.removeWebsiteSettings(domain);
    expect(settings.getWebsiteSettings(domain)).toBeNull();
  });

  test('should validate capture enabled for domain', () => {
    const domain = 'example.com';
    
    // Default behavior - should be enabled
    expect(settings.isCaptureEnabledForDomain(domain)).toBe(true);

    // Disable globally
    settings.setCaptureEnabled(false);
    expect(settings.isCaptureEnabledForDomain(domain)).toBe(false);

    // Enable globally, disable for specific domain
    settings.setCaptureEnabled(true);
    settings.setWebsiteSettings(domain, { enabled: false });
    expect(settings.isCaptureEnabledForDomain(domain)).toBe(false);

    // Enable for specific domain
    settings.setWebsiteSettings(domain, { enabled: true });
    expect(settings.isCaptureEnabledForDomain(domain)).toBe(true);
  });

  test('should reset to default values', () => {
    // Modify settings
    settings.setCaptureEnabled(false)
      .setLogLevels(['error'])
      .setRetentionDays(7)
      .setMaxStorageSize(25)
      .setSensitiveDataFiltering(false)
      .setWebsiteSettings('example.com', { enabled: false });

    // Reset
    settings.reset();

    // Verify defaults
    expect(settings.captureEnabled).toBe(true);
    expect(settings.logLevels).toEqual(['log', 'error', 'warn', 'info']);
    expect(settings.retentionDays).toBe(30);
    expect(settings.maxStorageSize).toBe(100);
    expect(settings.sensitiveDataFiltering).toBe(true);
    expect(settings.websiteSettings.size).toBe(0);
  });
});