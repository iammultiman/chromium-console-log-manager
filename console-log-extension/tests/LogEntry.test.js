/**
 * Unit tests for LogEntry class
 */

// Import LogEntry class
const LogEntry = require('../models/LogEntry.js');

describe('LogEntry', () => {
  describe('constructor', () => {
    test('should create LogEntry with basic properties', () => {
      const entry = new LogEntry('log', 'Test message', [], 'https://example.com', 123);
      
      expect(entry.level).toBe('log');
      expect(entry.message).toBe('Test message');
      expect(entry.url).toBe('https://example.com');
      expect(entry.tabId).toBe(123);
      expect(entry.domain).toBe('example.com');
      expect(entry.id).toMatch(/^log_\d+_[a-z0-9]+$/);
      expect(entry.timestamp).toBeCloseTo(Date.now(), -2);
      expect(entry.sessionId).toMatch(/^example\.com_123_\d+$/);
    });

    test('should handle empty message', () => {
      const entry = new LogEntry('error', '', [], 'https://test.com', 456);
      expect(entry.message).toBe('');
    });

    test('should handle null message', () => {
      const entry = new LogEntry('warn', null, [], 'https://test.com', 456);
      expect(entry.message).toBe('null');
    });
  });

  describe('formatMessage', () => {
    let entry;
    
    beforeEach(() => {
      entry = new LogEntry('log', '', [], 'https://example.com', 123);
    });

    test('should format simple message without args', () => {
      const result = entry.formatMessage('Hello world', []);
      expect(result).toBe('Hello world');
    });

    test('should format message with string arguments', () => {
      const result = entry.formatMessage('Hello', ['world', 'test']);
      expect(result).toBe('Hello world test');
    });

    test('should format message with object arguments', () => {
      const obj = { name: 'test', value: 123 };
      const result = entry.formatMessage('Data:', [obj]);
      expect(result).toContain('Data:');
      expect(result).toContain('"name": "test"');
      expect(result).toContain('"value": 123');
    });

    test('should handle circular object references', () => {
      const obj = { name: 'test' };
      obj.self = obj; // Create circular reference
      const result = entry.formatMessage('Circular:', [obj]);
      expect(result).toBe('Circular: [Object]');
    });

    test('should format mixed argument types', () => {
      const result = entry.formatMessage('Mixed:', ['string', 123, true]);
      expect(result).toBe('Mixed: string 123 true');
    });

    test('should handle undefined and null args', () => {
      const result = entry.formatMessage('Test', [undefined, null]);
      expect(result).toBe('Test undefined null');
    });
  });

  describe('extractDomain', () => {
    let entry;
    
    beforeEach(() => {
      entry = new LogEntry('log', '', [], 'https://example.com', 123);
    });

    test('should extract domain from HTTPS URL', () => {
      const result = entry.extractDomain('https://www.example.com/path');
      expect(result).toBe('www.example.com');
    });

    test('should extract domain from HTTP URL', () => {
      const result = entry.extractDomain('http://test.org/page');
      expect(result).toBe('test.org');
    });

    test('should extract domain with port', () => {
      const result = entry.extractDomain('http://localhost:3000/app');
      expect(result).toBe('localhost');
    });

    test('should handle invalid URLs', () => {
      const result = entry.extractDomain('not-a-url');
      expect(result).toBe('unknown');
    });

    test('should handle empty URL', () => {
      const result = entry.extractDomain('');
      expect(result).toBe('unknown');
    });
  });

  describe('generateSessionId', () => {
    let entry;
    
    beforeEach(() => {
      entry = new LogEntry('log', '', [], 'https://example.com', 123);
    });

    test('should generate consistent session ID for same tab and domain', () => {
      const id1 = entry.generateSessionId(123, 'https://example.com/page1');
      const id2 = entry.generateSessionId(123, 'https://example.com/page2');
      expect(id1).toBe(id2);
    });

    test('should generate different session IDs for different tabs', () => {
      const id1 = entry.generateSessionId(123, 'https://example.com');
      const id2 = entry.generateSessionId(456, 'https://example.com');
      expect(id1).not.toBe(id2);
    });

    test('should generate different session IDs for different domains', () => {
      const id1 = entry.generateSessionId(123, 'https://example.com');
      const id2 = entry.generateSessionId(123, 'https://test.com');
      expect(id1).not.toBe(id2);
    });

    test('should include domain, tab ID, and time component', () => {
      const sessionId = entry.generateSessionId(123, 'https://example.com');
      expect(sessionId).toMatch(/^example\.com_123_\d+$/);
    });
  });

  describe('generateUniqueId', () => {
    let entry;
    
    beforeEach(() => {
      entry = new LogEntry('log', '', [], 'https://example.com', 123);
    });

    test('should generate unique IDs', () => {
      const id1 = entry.generateUniqueId();
      const id2 = entry.generateUniqueId();
      expect(id1).not.toBe(id2);
    });

    test('should follow expected format', () => {
      const id = entry.generateUniqueId();
      expect(id).toMatch(/^log_\d+_[a-z0-9]+$/);
    });
  });

  describe('toJSON', () => {
    test('should convert LogEntry to JSON object', () => {
      const entry = new LogEntry('error', 'Test error', ['arg1'], 'https://example.com', 123);
      const json = entry.toJSON();
      
      expect(json).toEqual({
        id: entry.id,
        timestamp: entry.timestamp,
        level: 'error',
        message: 'Test error arg1',
        args: ['arg1'],
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 123,
        sessionId: entry.sessionId
      });
    });
  });

  describe('fromJSON', () => {
    test('should create LogEntry from JSON data', () => {
      const data = {
        id: 'test_id',
        timestamp: 1234567890,
        level: 'warn',
        message: 'Test warning',
        args: ['arg1', 'arg2'],
        url: 'https://test.com',
        domain: 'test.com',
        tabId: 456,
        sessionId: 'test.com_456_123'
      };
      
      const entry = LogEntry.fromJSON(data);
      
      expect(entry).toBeInstanceOf(LogEntry);
      expect(entry.id).toBe('test_id');
      expect(entry.level).toBe('warn');
      expect(entry.message).toBe('Test warning');
      expect(entry.domain).toBe('test.com');
    });
  });
});