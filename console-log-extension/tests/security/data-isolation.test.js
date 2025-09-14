/**
 * Data Isolation Security Tests
 * Tests that ensure proper data isolation between websites and sessions
 */

const { JSDOM } = require('jsdom');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    getURL: jest.fn(path => `chrome-extension://test-id/${path}`)
  },
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue()
    },
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue()
    }
  }
};

// Setup IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

describe('Data Isolation Security Tests', () => {
  let StorageManager;
  let LogEntry;
  let SensitiveDataDetector;

  beforeEach(async () => {
    StorageManager = require('../../models/StorageManager');
    LogEntry = require('../../models/LogEntry');
    SensitiveDataDetector = require('../../models/SensitiveDataDetector');

    await StorageManager.initialize();
    jest.clearAllMocks();
  });

  test('domain-based data isolation', async () => {
    const domains = [
      'https://banking.example.com',
      'https://shopping.example.com',
      'https://social.example.com',
      'https://work.company.com'
    ];

    // Create logs for different domains with potentially sensitive content
    const logsByDomain = {};
    
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      const logs = [
        new LogEntry('log', `User logged in to ${domain}`, [`User logged in to ${domain}`], domain, i + 1),
        new LogEntry('error', `API error on ${domain}`, [`API error on ${domain}`], domain, i + 1),
        new LogEntry('warn', `Session timeout warning for ${domain}`, [`Session timeout warning for ${domain}`], domain, i + 1)
      ];
      
      logsByDomain[domain] = logs;
      await StorageManager.saveLogs(logs);
    }

    // Test that each domain can only access its own logs
    for (const domain of domains) {
      const domainName = new URL(domain).hostname;
      const domainLogs = await StorageManager.queryLogs({ domains: [domainName] });
      
      // Verify only logs from this domain are returned
      expect(domainLogs.logs.every(log => log.domain === domainName)).toBe(true);
      expect(domainLogs.logs.length).toBe(3);
      
      // Verify no cross-domain data leakage
      const otherDomains = domains.filter(d => d !== domain).map(d => new URL(d).hostname);
      expect(domainLogs.logs.every(log => !otherDomains.includes(log.domain))).toBe(true);
    }
  });

  test('session-based data isolation', async () => {
    const domain = 'https://example.com';
    const sessions = ['session-1', 'session-2', 'session-3'];
    
    // Create logs for different sessions
    const logsBySessions = {};
    
    for (const sessionId of sessions) {
      const logs = [
        new LogEntry('log', `Session ${sessionId} started`, [`Session ${sessionId} started`], domain, 1),
        new LogEntry('log', `User action in ${sessionId}`, [`User action in ${sessionId}`], domain, 1),
        new LogEntry('log', `Session ${sessionId} data processed`, [`Session ${sessionId} data processed`], domain, 1)
      ];
      
      // Set session IDs
      logs.forEach(log => log.sessionId = sessionId);
      
      logsBySessions[sessionId] = logs;
      await StorageManager.saveLogs(logs);
    }

    // Test session isolation
    for (const sessionId of sessions) {
      const sessionLogs = await StorageManager.queryLogs({ sessionIds: [sessionId] });
      
      // Verify only logs from this session are returned
      expect(sessionLogs.logs.every(log => log.sessionId === sessionId)).toBe(true);
      expect(sessionLogs.logs.length).toBe(3);
      
      // Verify no cross-session data leakage
      const otherSessions = sessions.filter(s => s !== sessionId);
      expect(sessionLogs.logs.every(log => !otherSessions.includes(log.sessionId))).toBe(true);
    }
  });

  test('tab-based data isolation', async () => {
    const domain = 'https://example.com';
    const tabIds = [1, 2, 3, 4];
    
    // Create logs for different tabs
    for (const tabId of tabIds) {
      const logs = [
        new LogEntry('log', `Tab ${tabId} initialized`, [`Tab ${tabId} initialized`], domain, tabId),
        new LogEntry('log', `Tab ${tabId} user interaction`, [`Tab ${tabId} user interaction`], domain, tabId),
        new LogEntry('error', `Tab ${tabId} error occurred`, [`Tab ${tabId} error occurred`], domain, tabId)
      ];
      
      await StorageManager.saveLogs(logs);
    }

    // Verify tab isolation by checking tabId filtering
    for (const tabId of tabIds) {
      const allLogs = await StorageManager.queryLogs({});
      const tabLogs = allLogs.logs.filter(log => log.tabId === tabId);
      
      expect(tabLogs.length).toBe(3);
      expect(tabLogs.every(log => log.tabId === tabId)).toBe(true);
      
      // Verify logs contain tab-specific content
      expect(tabLogs.every(log => log.message.includes(`Tab ${tabId}`))).toBe(true);
    }
  });

  test('sensitive data detection and isolation', async () => {
    const sensitivePatterns = [
      'password123',
      'sk_test_4eC39HqLyjWDarjtT1zdp7dc', // Stripe API key pattern
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // JWT token pattern
      '4532-1234-5678-9012', // Credit card pattern
      'user@example.com:secretpassword' // Credentials pattern
    ];

    const logs = sensitivePatterns.map((pattern, i) => 
      new LogEntry(
        'log',
        `Log entry containing sensitive data: ${pattern}`,
        [`Log entry containing sensitive data: ${pattern}`],
        `https://site${i}.com`,
        i + 1
      )
    );

    await StorageManager.saveLogs(logs);

    // Test sensitive data detection
    for (const log of logs) {
      const hasSensitiveData = SensitiveDataDetector.detectSensitiveData(log.message);
      expect(hasSensitiveData.detected).toBe(true);
      expect(hasSensitiveData.patterns.length).toBeGreaterThan(0);
    }

    // Test that sensitive data can be filtered out
    const filteredLogs = await StorageManager.queryLogs({
      excludeSensitive: true
    });

    // Should return fewer logs or sanitized versions
    expect(filteredLogs.logs.length).toBeLessThanOrEqual(logs.length);
  });

  test('cross-origin request isolation', async () => {
    const origins = [
      'https://trusted.example.com',
      'https://untrusted.malicious.com',
      'https://partner.site.com'
    ];

    // Simulate logs from different origins
    const logsByOrigin = {};
    
    for (const origin of origins) {
      const logs = [
        new LogEntry('log', `API request to ${origin}`, [`API request to ${origin}`], origin, 1),
        new LogEntry('log', `Response from ${origin}`, [`Response from ${origin}`], origin, 1)
      ];
      
      logsByOrigin[origin] = logs;
      await StorageManager.saveLogs(logs);
    }

    // Test that origin-based filtering works correctly
    for (const origin of origins) {
      const domain = new URL(origin).hostname;
      const originLogs = await StorageManager.queryLogs({ domains: [domain] });
      
      expect(originLogs.logs.every(log => log.domain === domain)).toBe(true);
      expect(originLogs.logs.length).toBe(2);
    }

    // Test that malicious origin cannot access other origins' data
    const maliciousDomain = new URL('https://untrusted.malicious.com').hostname;
    const maliciousLogs = await StorageManager.queryLogs({ domains: [maliciousDomain] });
    
    expect(maliciousLogs.logs.every(log => log.domain === maliciousDomain)).toBe(true);
    expect(maliciousLogs.logs.every(log => 
      !log.message.includes('trusted.example.com') && 
      !log.message.includes('partner.site.com')
    )).toBe(true);
  });

  test('user data privacy protection', async () => {
    const personalData = [
      'John Doe',
      'john.doe@email.com',
      '555-123-4567',
      '123 Main St, Anytown, USA',
      'SSN: 123-45-6789'
    ];

    const logs = personalData.map((data, i) => 
      new LogEntry(
        'log',
        `User data logged: ${data}`,
        [`User data logged: ${data}`],
        'https://example.com',
        1
      )
    );

    await StorageManager.saveLogs(logs);

    // Test that personal data is detected
    for (const log of logs) {
      const detection = SensitiveDataDetector.detectPersonalData(log.message);
      expect(detection.detected).toBe(true);
    }

    // Test data anonymization
    const anonymizedLogs = logs.map(log => ({
      ...log,
      message: SensitiveDataDetector.anonymizePersonalData(log.message)
    }));

    for (const log of anonymizedLogs) {
      expect(log.message).not.toContain('John Doe');
      expect(log.message).not.toContain('john.doe@email.com');
      expect(log.message).not.toContain('555-123-4567');
      expect(log.message).toContain('[REDACTED]');
    }
  });

  test('storage access control', async () => {
    // Test that storage operations require proper context
    const unauthorizedAccess = async () => {
      // Simulate access without proper extension context
      const fakeContext = {
        origin: 'https://malicious.com',
        extensionId: 'fake-extension-id'
      };

      // This should fail or be restricted
      try {
        await StorageManager.queryLogs({}, fakeContext);
        return false; // Should not reach here
      } catch (error) {
        return true; // Expected to fail
      }
    };

    // In a real extension, this would be enforced by Chrome's security model
    // Here we simulate the security check
    const accessDenied = await unauthorizedAccess();
    expect(accessDenied).toBe(true);
  });

  test('data export security validation', async () => {
    const ExportManager = require('../../models/ExportManager');
    
    // Create logs with mixed sensitive and non-sensitive data
    const logs = [
      new LogEntry('log', 'Normal log message', ['Normal log message'], 'https://example.com', 1),
      new LogEntry('log', 'API key: sk_test_123456789', ['API key: sk_test_123456789'], 'https://example.com', 1),
      new LogEntry('log', 'User password: secret123', ['User password: secret123'], 'https://example.com', 1),
      new LogEntry('log', 'Another normal message', ['Another normal message'], 'https://example.com', 1)
    ];

    await StorageManager.saveLogs(logs);

    // Test export with security validation
    const exportData = await ExportManager.exportLogs('json', {});
    const exportedLogs = JSON.parse(exportData);

    // Verify security warnings are included
    expect(exportedLogs.securityWarnings).toBeDefined();
    expect(exportedLogs.securityWarnings.length).toBeGreaterThan(0);

    // Test that sensitive data is flagged
    const sensitiveCount = exportedLogs.logs.filter(log => 
      SensitiveDataDetector.detectSensitiveData(log.message).detected
    ).length;

    expect(sensitiveCount).toBe(2); // Two logs with sensitive data
    expect(exportedLogs.securityWarnings.some(warning => 
      warning.includes('sensitive data')
    )).toBe(true);
  });

  test('memory isolation between operations', async () => {
    const domain1 = 'https://site1.com';
    const domain2 = 'https://site2.com';

    // Create logs for domain 1
    const logs1 = Array.from({ length: 100 }, (_, i) => 
      new LogEntry('log', `Site1 secret data ${i}`, [`Site1 secret data ${i}`], domain1, 1)
    );

    await StorageManager.saveLogs(logs1);

    // Query domain 1 logs
    const domain1Results = await StorageManager.queryLogs({ 
      domains: [new URL(domain1).hostname] 
    });

    // Create logs for domain 2
    const logs2 = Array.from({ length: 100 }, (_, i) => 
      new LogEntry('log', `Site2 confidential info ${i}`, [`Site2 confidential info ${i}`], domain2, 2)
    );

    await StorageManager.saveLogs(logs2);

    // Query domain 2 logs
    const domain2Results = await StorageManager.queryLogs({ 
      domains: [new URL(domain2).hostname] 
    });

    // Verify no cross-contamination in results
    expect(domain1Results.logs.every(log => 
      log.message.includes('Site1') && !log.message.includes('Site2')
    )).toBe(true);

    expect(domain2Results.logs.every(log => 
      log.message.includes('Site2') && !log.message.includes('Site1')
    )).toBe(true);

    // Verify complete isolation
    expect(domain1Results.logs.length).toBe(100);
    expect(domain2Results.logs.length).toBe(100);
    
    const allDomain1Messages = domain1Results.logs.map(log => log.message).join(' ');
    const allDomain2Messages = domain2Results.logs.map(log => log.message).join(' ');
    
    expect(allDomain1Messages).not.toContain('Site2');
    expect(allDomain2Messages).not.toContain('Site1');
  });

  test('temporal data isolation', async () => {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;

    // Create logs at different time periods
    const timePeriods = [
      { name: 'morning', offset: -8 * hourMs },
      { name: 'afternoon', offset: -4 * hourMs },
      { name: 'evening', offset: -1 * hourMs },
      { name: 'current', offset: 0 }
    ];

    for (const period of timePeriods) {
      const logs = Array.from({ length: 10 }, (_, i) => {
        const log = new LogEntry(
          'log',
          `${period.name} activity ${i}`,
          [`${period.name} activity ${i}`],
          'https://example.com',
          1
        );
        log.timestamp = now + period.offset;
        return log;
      });

      await StorageManager.saveLogs(logs);
    }

    // Test time-based filtering isolation
    const morningStart = now - 9 * hourMs;
    const morningEnd = now - 7 * hourMs;

    const morningLogs = await StorageManager.queryLogs({
      dateRange: {
        start: morningStart,
        end: morningEnd
      }
    });

    // Verify only morning logs are returned
    expect(morningLogs.logs.every(log => 
      log.timestamp >= morningStart && log.timestamp <= morningEnd
    )).toBe(true);

    expect(morningLogs.logs.every(log => 
      log.message.includes('morning')
    )).toBe(true);

    expect(morningLogs.logs.length).toBe(10);
  });
});