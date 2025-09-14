/**
 * Tests for sensitive data detection and filtering functionality
 */

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
    sendMessage: jest.fn(() => Promise.resolve()),
    onRemoved: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    }
  },
  runtime: {
    lastError: null,
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Mock IndexedDB
global.indexedDB = {
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

// Import background script functions
const {
  containsSensitiveData,
  shouldCaptureLog
} = require('../background/background.js');

const ExtensionSettings = require('../models/ExtensionSettings.js');
const LogEntry = require('../models/LogEntry.js');

describe('Sensitive Data Detection', () => {
  describe('containsSensitiveData function', () => {
    test('should detect email addresses', () => {
      expect(containsSensitiveData('User email: user@example.com')).toBe(true);
      expect(containsSensitiveData('Contact: john.doe+test@company.co.uk')).toBe(true);
      expect(containsSensitiveData('No email here')).toBe(false);
    });

    test('should detect credit card numbers', () => {
      expect(containsSensitiveData('Card: 4532 1234 5678 9012')).toBe(true);
      expect(containsSensitiveData('Card: 4532-1234-5678-9012')).toBe(true);
      expect(containsSensitiveData('Card: 4532123456789012')).toBe(true);
      expect(containsSensitiveData('Not a card: 123 456')).toBe(false);
    });

    test('should detect credential patterns', () => {
      expect(containsSensitiveData('password: secret123')).toBe(true);
      expect(containsSensitiveData('token=abc123def456')).toBe(true);
      expect(containsSensitiveData('API key: sk_test_123456')).toBe(true);
      expect(containsSensitiveData('auth: bearer_token_here')).toBe(true);
      expect(containsSensitiveData('No credentials here')).toBe(false);
    });

    test('should detect long tokens/keys', () => {
      expect(containsSensitiveData('Token: abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
      expect(containsSensitiveData('Short: abc123')).toBe(false);
    });

    test('should detect SSN patterns', () => {
      expect(containsSensitiveData('SSN: 123-45-6789')).toBe(true);
      expect(containsSensitiveData('Not SSN: 12-345-67')).toBe(false);
    });

    test('should detect Stripe secret keys', () => {
      expect(containsSensitiveData('sk_test_1234567890abcdef1234')).toBe(true);
      expect(containsSensitiveData('sk_live_abcdef1234567890abcd')).toBe(true);
      expect(containsSensitiveData('pk_test_1234567890abcdef1234')).toBe(false);
    });

    test('should detect AWS access keys', () => {
      expect(containsSensitiveData('AKIAIOSFODNN7EXAMPLE')).toBe(true);
      expect(containsSensitiveData('AKIA1234567890ABCDEF')).toBe(true);
      expect(containsSensitiveData('NOTAKIAKEY123456789')).toBe(false);
    });

    test('should handle empty or null input', () => {
      expect(containsSensitiveData('')).toBe(false);
      expect(containsSensitiveData(null)).toBe(false);
      expect(containsSensitiveData(undefined)).toBe(false);
    });
  });

  describe('Sensitive data filtering integration', () => {
    let settings;
    let logEntry;

    beforeEach(async () => {
      settings = new ExtensionSettings();
      settings.sensitiveDataFiltering = true;
      
      // Mock the global extensionSettings by requiring the background script
      const backgroundModule = require('../background/background.js');
      
      // Set up the extensionSettings global variable
      if (typeof global.extensionSettings === 'undefined') {
        global.extensionSettings = settings;
      } else {
        Object.assign(global.extensionSettings, settings);
      }
      
      logEntry = new LogEntry('log', 'Test message', [], 'https://example.com', 123);
    });

    test('should filter logs with sensitive data when enabled', async () => {
      logEntry.message = 'User password: secret123';
      const shouldCapture = await shouldCaptureLog(logEntry);
      expect(shouldCapture).toBe(false);
    });

    test('should allow logs with sensitive data when filtering disabled', async () => {
      settings.sensitiveDataFiltering = false;
      logEntry.message = 'User password: secret123';
      const shouldCapture = await shouldCaptureLog(logEntry);
      expect(shouldCapture).toBe(true);
    });

    test('should allow logs without sensitive data', async () => {
      logEntry.message = 'Regular log message without sensitive data';
      const shouldCapture = await shouldCaptureLog(logEntry);
      expect(shouldCapture).toBe(true);
    });

    test('should filter logs with email addresses', async () => {
      logEntry.message = 'Sending email to user@example.com';
      const shouldCapture = await shouldCaptureLog(logEntry);
      expect(shouldCapture).toBe(false);
    });

    test('should filter logs with credit card numbers', async () => {
      logEntry.message = 'Processing payment for card 4532-1234-5678-9012';
      const shouldCapture = await shouldCaptureLog(logEntry);
      expect(shouldCapture).toBe(false);
    });

    test('should filter logs with API tokens', async () => {
      logEntry.message = 'Using token: sk_test_abcdefghijklmnopqrstuvwx';
      const shouldCapture = await shouldCaptureLog(logEntry);
      expect(shouldCapture).toBe(false);
    });

    test('should work with other filters combined', async () => {
      // Disable capture globally
      settings.captureEnabled = false;
      logEntry.message = 'User password: secret123';
      
      const shouldCapture = await shouldCaptureLog(logEntry);
      expect(shouldCapture).toBe(false); // Should be false due to global disable, not sensitive data
    });

    test('should respect log level filtering with sensitive data', async () => {
      settings.logLevels = ['error']; // Only capture errors
      logEntry.level = 'log'; // This is a log level
      logEntry.message = 'Regular message';
      
      const shouldCapture = await shouldCaptureLog(logEntry);
      expect(shouldCapture).toBe(false); // Should be false due to log level, not sensitive data
    });
  });

  describe('Sensitive data patterns edge cases', () => {
    test('should handle case insensitive credential patterns', () => {
      expect(containsSensitiveData('PASSWORD: secret123')).toBe(true);
      expect(containsSensitiveData('Token: abc123def456')).toBe(true);
      expect(containsSensitiveData('SECRET=mypassword')).toBe(true);
    });

    test('should handle different separators in credential patterns', () => {
      expect(containsSensitiveData('password:secret123')).toBe(true);
      expect(containsSensitiveData('password = secret123')).toBe(true);
      expect(containsSensitiveData('password: secret123')).toBe(true);
    });

    test('should not trigger on partial matches', () => {
      expect(containsSensitiveData('This is not a password field')).toBe(false);
      expect(containsSensitiveData('The token was invalid')).toBe(false);
      expect(containsSensitiveData('Email format validation')).toBe(false);
    });

    test('should handle multiple sensitive patterns in one message', () => {
      const message = 'User: user@example.com, Password: secret123, Card: 4532-1234-5678-9012';
      expect(containsSensitiveData(message)).toBe(true);
    });

    test('should handle messages with mixed content', () => {
      expect(containsSensitiveData('Debug info: user logged in with email user@test.com')).toBe(true);
      expect(containsSensitiveData('Error: Invalid token format for sk_test_123456789012345678901234')).toBe(true);
    });
  });
});