/**
 * Unit tests for Background Script message handling
 */

// Import required modules for testing
const LogEntry = require('../models/LogEntry.js');
const ExtensionSettings = require('../models/ExtensionSettings.js');
const StorageManager = require('../models/StorageManager.js');
const KeywordFilters = require('../models/KeywordFilters.js');

// Mock Chrome APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    lastError: null
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onRemoved: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    }
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock IndexedDB
global.indexedDB = {
  open: jest.fn()
};

// Import background script functions
const {
  handleMessage,
  processLogMessage,
  shouldCaptureLog,
  updateSessionTracking,
  getSessionInfo,
  updateSettings,
  getLogs,
  deleteLogs,
  clearDomainLogs,
  getStorageStatus,
  performCleanup,
  containsSensitiveData,
  extractDomain,
  isValidTabId,
  isValidLogLevel,
  getActiveSessions,
  cleanupInactiveSessions,
  initialize
} = require('../background/background.js');

describe('Background Script Message Handling', () => {
  let mockStorageManager;
  let mockExtensionSettings;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock StorageManager
    mockStorageManager = {
      initializeDatabase: jest.fn().mockResolvedValue({}),
      saveLogs: jest.fn().mockResolvedValue(true),
      queryLogs: jest.fn().mockResolvedValue([]),
      getLogCount: jest.fn().mockResolvedValue(0),
      calculateStorageUsage: jest.fn().mockResolvedValue({ used: 0, total: 1000 }),
      deleteLogs: jest.fn().mockResolvedValue(5),
      deleteLogsByDomain: jest.fn().mockResolvedValue(10),
      checkStorageStatus: jest.fn().mockResolvedValue({ needsCleanup: false }),
      performCleanup: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      getLogsBySession: jest.fn().mockResolvedValue([])
    };
    
    // Mock ExtensionSettings
    mockExtensionSettings = {
      load: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true),
      toJSON: jest.fn().mockReturnValue({
        captureEnabled: true,
        logLevels: ['log', 'error', 'warn', 'info'],
        retentionDays: 30,
        maxStorageSize: 100
      }),
      fromJSON: jest.fn(),
      captureEnabled: true,
      logLevels: ['log', 'error', 'warn', 'info'],
      retentionDays: 30,
      maxStorageSize: 100,
      keywordFilters: null,
      sensitiveDataFiltering: false,
      isCaptureEnabledForDomain: jest.fn().mockReturnValue(true)
    };
  });

  describe('Message Validation', () => {
    test('should reject invalid message format', async () => {
      const result = await handleMessage(null, {});
      expect(result.error).toBe('Invalid message format');
    });

    test('should reject message without type', async () => {
      const result = await handleMessage({}, {});
      expect(result.error).toBe('Message type is required');
    });

    test('should handle unknown message type', async () => {
      const result = await handleMessage({ type: 'UNKNOWN_TYPE' }, {});
      expect(result.error).toBe('Unknown message type: UNKNOWN_TYPE');
    });

    test('should respond to PING message', async () => {
      const result = await handleMessage({ type: 'PING' }, {});
      expect(result.pong).toBe(true);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Log Message Processing', () => {
    const validSender = {
      tab: {
        id: 123,
        url: 'https://example.com'
      }
    };

    const validLogData = {
      level: 'log',
      message: 'Test message',
      args: ['test'],
      url: 'https://example.com'
    };

    test('should process valid log message', async () => {
      const result = await processLogMessage(validLogData, validSender);
      expect(result.captured).toBe(true);
      expect(result.logId).toBeDefined();
    });

    test('should reject log message without data', async () => {
      const result = await processLogMessage(null, validSender);
      expect(result.captured).toBe(false);
      expect(result.error).toBe('Log data is required');
    });

    test('should reject log message without level', async () => {
      const invalidData = { ...validLogData, level: undefined };
      const result = await processLogMessage(invalidData, validSender);
      expect(result.captured).toBe(false);
      expect(result.error).toBe('Log level and message are required');
    });

    test('should reject log message without message', async () => {
      const invalidData = { ...validLogData, message: undefined };
      const result = await processLogMessage(invalidData, validSender);
      expect(result.captured).toBe(false);
      expect(result.error).toBe('Log level and message are required');
    });

    test('should reject invalid log level', async () => {
      const invalidData = { ...validLogData, level: 'invalid' };
      const result = await processLogMessage(invalidData, validSender);
      expect(result.captured).toBe(false);
      expect(result.error).toBe('Invalid log level: invalid');
    });

    test('should reject invalid sender', async () => {
      const invalidSender = { tab: null };
      const result = await processLogMessage(validLogData, invalidSender);
      expect(result.captured).toBe(false);
      expect(result.error).toBe('Invalid sender information - tab ID required');
    });

    test('should handle missing tab ID', async () => {
      const invalidSender = { tab: { url: 'https://example.com' } };
      const result = await processLogMessage(validLogData, invalidSender);
      expect(result.captured).toBe(false);
      expect(result.error).toBe('Invalid sender information - tab ID required');
    });
  });

  describe('Session Management', () => {
    test('should update session tracking', () => {
      updateSessionTracking(123, 'https://example.com', 'session-123');
      const sessions = getActiveSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].tabId).toBe(123);
      expect(sessions[0].domain).toBe('example.com');
    });

    test('should get session info for active tab', async () => {
      updateSessionTracking(123, 'https://example.com', 'session-123');
      const sessionInfo = await getSessionInfo(123);
      expect(sessionInfo.active).toBe(true);
      expect(sessionInfo.sessionId).toBe('session-123');
      expect(sessionInfo.domain).toBe('example.com');
    });

    test('should return inactive for unknown tab', async () => {
      const sessionInfo = await getSessionInfo(999);
      expect(sessionInfo.active).toBe(false);
    });

    test('should cleanup inactive sessions', () => {
      // Add a session with old timestamp
      updateSessionTracking(123, 'https://example.com', 'session-123');
      const sessions = getActiveSessions();
      sessions[0].lastActivity = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      
      cleanupInactiveSessions();
      const remainingSessions = getActiveSessions();
      expect(remainingSessions).toHaveLength(0);
    });
  });

  describe('Utility Functions', () => {
    test('should validate tab IDs correctly', () => {
      expect(isValidTabId(123)).toBe(true);
      expect(isValidTabId(0)).toBe(false);
      expect(isValidTabId(-1)).toBe(false);
      expect(isValidTabId('123')).toBe(false);
      expect(isValidTabId(null)).toBe(false);
    });

    test('should validate log levels correctly', () => {
      expect(isValidLogLevel('log')).toBe(true);
      expect(isValidLogLevel('error')).toBe(true);
      expect(isValidLogLevel('warn')).toBe(true);
      expect(isValidLogLevel('info')).toBe(true);
      expect(isValidLogLevel('debug')).toBe(false);
      expect(isValidLogLevel('invalid')).toBe(false);
      expect(isValidLogLevel(null)).toBe(false);
    });

    test('should extract domain from URL correctly', () => {
      expect(extractDomain('https://example.com/path')).toBe('example.com');
      expect(extractDomain('http://subdomain.example.com')).toBe('subdomain.example.com');
      expect(extractDomain('https://localhost:3000')).toBe('localhost');
      expect(extractDomain('invalid-url')).toBe('unknown');
    });

    test('should detect sensitive data patterns', () => {
      expect(containsSensitiveData('user@example.com')).toBe(true);
      expect(containsSensitiveData('password=secret123')).toBe(true);
      expect(containsSensitiveData('token: abc123def456')).toBe(true);
      expect(containsSensitiveData('4111-1111-1111-1111')).toBe(true);
      expect(containsSensitiveData('sk_test_123456789012345678901234')).toBe(true);
      expect(containsSensitiveData('AKIAIOSFODNN7EXAMPLE')).toBe(true);
      expect(containsSensitiveData('123-45-6789')).toBe(true);
      expect(containsSensitiveData('normal log message')).toBe(false);
    });
  });

  describe('Settings Management', () => {
    test('should handle GET_SETTINGS message', async () => {
      const result = await handleMessage({ type: 'GET_SETTINGS' }, {});
      expect(result.settings).toBeDefined();
      expect(result.settings.captureEnabled).toBe(true);
    });

    test('should handle UPDATE_SETTINGS message', async () => {
      const newSettings = { captureEnabled: false };
      const result = await handleMessage({ 
        type: 'UPDATE_SETTINGS', 
        data: newSettings 
      }, {});
      expect(result.success).toBe(true);
    });
  });

  describe('Log Retrieval and Management', () => {
    test('should handle GET_LOGS message', async () => {
      const result = await handleMessage({ type: 'GET_LOGS' }, {});
      expect(result.logs).toBeDefined();
      expect(result.totalCount).toBeDefined();
      expect(result.storageUsage).toBeDefined();
    });

    test('should handle DELETE_LOGS message', async () => {
      const result = await handleMessage({ 
        type: 'DELETE_LOGS', 
        data: ['log1', 'log2'] 
      }, {});
      expect(result.deletedCount).toBe(5);
    });

    test('should handle CLEAR_DOMAIN_LOGS message', async () => {
      const result = await handleMessage({ 
        type: 'CLEAR_DOMAIN_LOGS', 
        data: { domain: 'example.com' } 
      }, {});
      expect(result.deletedCount).toBe(10);
      expect(result.domain).toBe('example.com');
    });

    test('should handle GET_STORAGE_STATUS message', async () => {
      const result = await handleMessage({ type: 'GET_STORAGE_STATUS' }, {});
      expect(result.needsCleanup).toBe(false);
    });

    test('should handle PERFORM_CLEANUP message', async () => {
      const cleanupOptions = { maxAgeDays: 7, maxSizeMB: 50 };
      const result = await handleMessage({ 
        type: 'PERFORM_CLEANUP', 
        data: cleanupOptions 
      }, {});
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      mockStorageManager.saveLogs.mockRejectedValue(new Error('Storage full'));
      
      const validSender = { tab: { id: 123, url: 'https://example.com' } };
      const validLogData = { level: 'log', message: 'Test', args: [] };
      
      const result = await processLogMessage(validLogData, validSender);
      expect(result.captured).toBe(true); // Should still return success for queuing
    });

    test('should handle settings load errors', async () => {
      mockExtensionSettings.load.mockRejectedValue(new Error('Settings error'));
      
      try {
        await initialize();
      } catch (error) {
        expect(error.message).toBe('Settings error');
      }
    });
  });
});