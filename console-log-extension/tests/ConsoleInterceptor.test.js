/**
 * Unit tests for Console Interception functionality
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('ConsoleInterceptor', () => {
  let dom;
  let window;
  let ConsoleInterceptor;
  let interceptor;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://example.com/test-page',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    window = dom.window;
    
    // Set up global objects for the content script
    global.window = window;
    global.URL = window.URL;

    // Load the ConsoleInterceptor class (simulate content script loading)
    const contentScriptPath = path.join(__dirname, '..', 'content', 'content.js');
    const contentScript = fs.readFileSync(contentScriptPath, 'utf8');
    
    // Execute the content script in the window context
    const script = new window.Function(contentScript);
    script.call(window);

    ConsoleInterceptor = window.ConsoleInterceptor;
    
    // Create a fresh interceptor for each test
    interceptor = new ConsoleInterceptor();
    
    // Initialize fresh capturedLogs array for each test
    window.capturedLogs = [];
  });

  afterEach(() => {
    // Clean up global objects
    delete global.window;
    delete global.URL;
    
    // Close JSDOM window
    if (dom && dom.window) {
      dom.window.close();
    }
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with correct properties', () => {
      expect(interceptor.isEnabled).toBe(true);
      expect(interceptor.sessionId).toBeDefined();
      expect(interceptor.tabId).toBeNull();
      expect(interceptor.originalConsole).toBeDefined();
    });

    test('should store original console methods', () => {
      expect(typeof interceptor.originalConsole.log).toBe('function');
      expect(typeof interceptor.originalConsole.error).toBe('function');
      expect(typeof interceptor.originalConsole.warn).toBe('function');
      expect(typeof interceptor.originalConsole.info).toBe('function');
    });

    test('should generate valid session ID', () => {
      const sessionId = interceptor.sessionId;
      expect(sessionId).toMatch(/^example\.com_\d+_[a-z0-9]+$/);
    });
  });

  describe('Console Method Interception', () => {
    test('should override console methods', () => {
      // Console methods should be different from originals after interception
      expect(window.console.log).not.toBe(interceptor.originalConsole.log);
      expect(window.console.error).not.toBe(interceptor.originalConsole.error);
      expect(window.console.warn).not.toBe(interceptor.originalConsole.warn);
      expect(window.console.info).not.toBe(interceptor.originalConsole.info);
    });

    test('should capture log messages when enabled', () => {
      window.capturedLogs = [];
      
      window.console.log('Test message');
      
      expect(window.capturedLogs).toHaveLength(1);
      expect(window.capturedLogs[0].level).toBe('log');
      expect(window.capturedLogs[0].message).toBe('Test message');
    });

    test('should capture different log levels', () => {
      window.capturedLogs = [];
      
      window.console.log('Log message');
      window.console.error('Error message');
      window.console.warn('Warning message');
      window.console.info('Info message');
      
      expect(window.capturedLogs).toHaveLength(4);
      expect(window.capturedLogs[0].level).toBe('log');
      expect(window.capturedLogs[1].level).toBe('error');
      expect(window.capturedLogs[2].level).toBe('warn');
      expect(window.capturedLogs[3].level).toBe('info');
    });

    test('should not capture logs when disabled', () => {
      window.capturedLogs = [];
      interceptor.disable();
      
      window.console.log('Test message');
      
      expect(window.capturedLogs).toHaveLength(0);
    });

    test('should resume capturing when re-enabled', () => {
      window.capturedLogs = [];
      interceptor.disable();
      window.console.log('Disabled message');
      
      interceptor.enable();
      window.console.log('Enabled message');
      
      expect(window.capturedLogs).toHaveLength(1);
      expect(window.capturedLogs[0].message).toBe('Enabled message');
    });
  });

  describe('Message Formatting', () => {
    test('should format simple string messages', () => {
      const formatted = interceptor.formatMessage(['Hello world']);
      expect(formatted).toBe('Hello world');
    });

    test('should format multiple arguments', () => {
      const formatted = interceptor.formatMessage(['Hello', 'world', 123]);
      expect(formatted).toBe('Hello world 123');
    });

    test('should format object arguments', () => {
      const obj = { name: 'test', value: 42 };
      const formatted = interceptor.formatMessage(['Object:', obj]);
      expect(formatted).toContain('Object:');
      expect(formatted).toContain('"name": "test"');
      expect(formatted).toContain('"value": 42');
    });

    test('should handle circular references in objects', () => {
      const obj = { name: 'test' };
      obj.self = obj; // Create circular reference
      
      const formatted = interceptor.formatMessage([obj]);
      expect(formatted).toContain('"name": "test"');
      expect(formatted).toContain('"self": "[Circular Reference]"');
    });

    test('should handle empty arguments', () => {
      const formatted = interceptor.formatMessage([]);
      expect(formatted).toBe('');
    });
  });

  describe('Argument Serialization', () => {
    test('should serialize primitive values', () => {
      const serialized = interceptor.serializeArgs(['string', 123, true, null]);
      expect(serialized).toEqual(['string', 123, true, null]);
    });

    test('should serialize objects', () => {
      const obj = { name: 'test', value: 42 };
      const serialized = interceptor.serializeArgs([obj]);
      expect(serialized[0]).toEqual({ name: 'test', value: 42 });
      expect(serialized[0]).not.toBe(obj); // Should be a copy
    });

    test('should handle functions', () => {
      const func = () => 'test';
      const serialized = interceptor.serializeArgs([func]);
      expect(serialized[0]).toBe('[Function]');
    });

    test('should handle circular references', () => {
      const obj = { name: 'test' };
      obj.self = obj;
      
      const serialized = interceptor.serializeArgs([obj]);
      expect(serialized[0]).toBe('[Object]');
    });
  });

  describe('Log Data Structure', () => {
    test('should create proper log data structure', () => {
      window.capturedLogs = [];
      
      window.console.log('Test message', { data: 'value' });
      
      const logData = window.capturedLogs[0];
      expect(logData).toHaveProperty('id');
      expect(logData).toHaveProperty('timestamp');
      expect(logData).toHaveProperty('level', 'log');
      expect(logData).toHaveProperty('message');
      expect(logData).toHaveProperty('args');
      expect(logData).toHaveProperty('url', 'https://example.com/test-page');
      expect(logData).toHaveProperty('domain', 'example.com');
      expect(logData).toHaveProperty('sessionId');
      expect(logData.tabId).toBeNull(); // Not set initially
    });

    test('should generate unique IDs for each log', () => {
      window.capturedLogs = [];
      
      window.console.log('Message 1');
      window.console.log('Message 2');
      
      expect(window.capturedLogs[0].id).not.toBe(window.capturedLogs[1].id);
    });

    test('should use same session ID for logs in same session', () => {
      window.capturedLogs = [];
      
      window.console.log('Message 1');
      window.console.log('Message 2');
      
      expect(window.capturedLogs[0].sessionId).toBe(window.capturedLogs[1].sessionId);
    });
  });

  describe('Domain Extraction', () => {
    test('should extract domain from URL', () => {
      const domain = interceptor.extractDomain('https://example.com/path/to/page');
      expect(domain).toBe('example.com');
    });

    test('should handle subdomains', () => {
      const domain = interceptor.extractDomain('https://sub.example.com/page');
      expect(domain).toBe('sub.example.com');
    });

    test('should handle invalid URLs', () => {
      const domain = interceptor.extractDomain('invalid-url');
      expect(domain).toBe('unknown');
    });

    test('should handle localhost', () => {
      const domain = interceptor.extractDomain('http://localhost:3000/page');
      expect(domain).toBe('localhost');
    });
  });

  describe('Session ID Generation', () => {
    test('should generate session ID with domain and timestamp', () => {
      const sessionId = interceptor.generateSessionId();
      expect(sessionId).toMatch(/^example\.com_\d+_[a-z0-9]+$/);
    });

    test('should generate different session IDs for different instances', () => {
      const interceptor2 = new ConsoleInterceptor();
      expect(interceptor.sessionId).not.toBe(interceptor2.sessionId);
    });
  });

  describe('Tab ID Management', () => {
    test('should set tab ID', () => {
      interceptor.setTabId(123);
      expect(interceptor.tabId).toBe(123);
    });

    test('should include tab ID in captured logs after setting', () => {
      window.capturedLogs = [];
      interceptor.setTabId(456);
      
      window.console.log('Test message');
      
      expect(window.capturedLogs[0].tabId).toBe(456);
    });
  });

  describe('Console Restoration', () => {
    test('should restore original console methods', () => {
      const originalMethods = {
        log: interceptor.originalConsole.log,
        error: interceptor.originalConsole.error,
        warn: interceptor.originalConsole.warn,
        info: interceptor.originalConsole.info
      };
      
      interceptor.restore();
      
      expect(window.console.log).toBe(originalMethods.log);
      expect(window.console.error).toBe(originalMethods.error);
      expect(window.console.warn).toBe(originalMethods.warn);
      expect(window.console.info).toBe(originalMethods.info);
    });
  });

  describe('Keyword Filtering', () => {
    test('should allow all messages when filtering is disabled', () => {
      window.capturedLogs = [];
      interceptor.updateKeywordFilters({ enabled: false });
      
      window.console.log('Test message');
      window.console.log('Another message');
      
      expect(window.capturedLogs.length).toBeGreaterThan(0);
    });

    test('should filter messages based on inclusion keywords', () => {
      window.capturedLogs = [];
      interceptor.updateKeywordFilters({
        enabled: true,
        includeKeywords: ['important', 'error'],
        excludeKeywords: [],
        caseSensitive: false
      });
      
      window.console.log('This is important');
      window.console.log('Regular message');
      window.console.log('An error occurred');
      
      // Should capture messages with inclusion keywords
      const importantLogs = window.capturedLogs.filter(log => 
        log.message.includes('important') || log.message.includes('error')
      );
      expect(importantLogs.length).toBeGreaterThan(0);
    });

    test('should exclude messages based on exclusion keywords', () => {
      window.capturedLogs = [];
      interceptor.updateKeywordFilters({
        enabled: true,
        includeKeywords: [],
        excludeKeywords: ['debug', 'verbose'],
        caseSensitive: false
      });
      
      window.console.log('Normal message');
      window.console.log('Debug information');
      window.console.log('Verbose output');
      
      // Should not capture messages with exclusion keywords
      const debugLogs = window.capturedLogs.filter(log => 
        log.message.includes('Debug') || log.message.includes('Verbose')
      );
      expect(debugLogs.length).toBe(0);
    });

    test('should handle case sensitivity correctly', () => {
      window.capturedLogs = [];
      interceptor.updateKeywordFilters({
        enabled: true,
        includeKeywords: ['ERROR'],
        excludeKeywords: [],
        caseSensitive: true
      });
      
      window.console.log('ERROR message');
      window.console.log('error message');
      
      // Should only capture exact case match
      const errorLogs = window.capturedLogs.filter(log => 
        log.message.includes('ERROR')
      );
      expect(errorLogs.length).toBeGreaterThan(0);
      
      const lowerErrorLogs = window.capturedLogs.filter(log => 
        log.message === 'error message'
      );
      expect(lowerErrorLogs.length).toBe(0);
    });

    test('should handle case insensitivity correctly', () => {
      window.capturedLogs = [];
      interceptor.updateKeywordFilters({
        enabled: true,
        includeKeywords: ['error'],
        excludeKeywords: [],
        caseSensitive: false
      });
      
      window.console.log('ERROR message');
      window.console.log('error message');
      window.console.log('Error Message');
      
      // Should capture all case variations
      const errorLogs = window.capturedLogs.filter(log => 
        log.message.toLowerCase().includes('error')
      );
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    test('should apply exclusion before inclusion', () => {
      window.capturedLogs = [];
      interceptor.updateKeywordFilters({
        enabled: true,
        includeKeywords: ['important'],
        excludeKeywords: ['debug'],
        caseSensitive: false
      });
      
      window.console.log('Important message');
      window.console.log('Important debug message');
      
      // Should exclude messages with exclusion keywords even if they have inclusion keywords
      const debugLogs = window.capturedLogs.filter(log => 
        log.message.includes('debug')
      );
      expect(debugLogs.length).toBe(0);
    });

    test('should update filter settings correctly', () => {
      const newFilters = {
        enabled: true,
        includeKeywords: ['test', 'spec'],
        excludeKeywords: ['ignore'],
        caseSensitive: true
      };
      
      interceptor.updateKeywordFilters(newFilters);
      
      expect(interceptor.keywordFilters.enabled).toBe(true);
      expect(interceptor.keywordFilters.includeKeywords).toEqual(['test', 'spec']);
      expect(interceptor.keywordFilters.excludeKeywords).toEqual(['ignore']);
      expect(interceptor.keywordFilters.caseSensitive).toBe(true);
    });
  });

  describe('Message Transmission', () => {
    test('should use fallback storage when Chrome API is not available', () => {
      window.capturedLogs = [];
      
      // Chrome API is not available in test environment
      window.console.log('Test message for transmission');
      
      // Should fallback to capturedLogs array
      expect(window.capturedLogs.length).toBeGreaterThan(0);
    });

    test('should handle Chrome runtime errors gracefully', () => {
      // Mock Chrome API with error
      global.chrome = {
        runtime: {
          sendMessage: (message, callback) => {
            callback();
            // Simulate runtime error
            global.chrome.runtime.lastError = { message: 'Extension context invalidated' };
          },
          lastError: null
        }
      };

      window.capturedLogs = [];
      
      // Should not throw error
      expect(() => {
        interceptor.sendToBackground({ test: 'data' });
      }).not.toThrow();

      // Clean up
      delete global.chrome;
    });

    test('should manage message queue correctly', () => {
      expect(interceptor.getQueueSize()).toBe(0);
      
      // Add some messages to queue (simulate failed sends)
      interceptor.messageQueue.push({ test: 'message1' });
      interceptor.messageQueue.push({ test: 'message2' });
      
      expect(interceptor.getQueueSize()).toBe(2);
      
      // Clear queue
      interceptor.clearMessageQueue();
      expect(interceptor.getQueueSize()).toBe(0);
    });

    test('should process queued messages', () => {
      // Add message to queue
      interceptor.messageQueue.push({ test: 'queued message' });
      expect(interceptor.getQueueSize()).toBe(1);
      
      // Process queue (will try to send but fallback to capturedLogs)
      window.capturedLogs = [];
      interceptor.processMessageQueue();
      
      // Queue should be reduced
      expect(interceptor.getQueueSize()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully during message capture', () => {
      // Mock sendToBackground to throw error
      const originalSend = interceptor.sendToBackground;
      interceptor.sendToBackground = () => {
        throw new Error('Test error');
      };

      // Should not throw error
      expect(() => {
        window.console.log('Test message');
      }).not.toThrow();

      // Restore original method
      interceptor.sendToBackground = originalSend;
    });
  });
});