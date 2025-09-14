/**
 * Simple tests for sensitive data detection functionality
 */

// Mock chrome APIs to prevent errors during import
global.chrome = {
  storage: { sync: { set: jest.fn(), get: jest.fn() } },
  tabs: { 
    query: jest.fn(), 
    sendMessage: jest.fn(),
    onRemoved: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() }
  },
  runtime: { 
    lastError: null,
    onMessage: { addListener: jest.fn() }
  }
};

global.indexedDB = {
  open: jest.fn(() => ({
    onsuccess: null,
    onerror: null,
    result: { createObjectStore: jest.fn(), transaction: jest.fn() }
  }))
};

const { containsSensitiveData } = require('../background/background.js');

describe('Sensitive Data Detection', () => {
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