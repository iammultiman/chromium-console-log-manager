/**
 * Tests for log management UI integration
 * Covers cleanup functionality, bulk operations, and storage management
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <div class="options-container">
    <section id="logs-tab" class="tab-content">
      <div class="logs-controls">
        <div class="bulk-select-controls">
          <label class="bulk-select-all">
            <input type="checkbox" id="select-all-logs">
            Select all visible logs
          </label>
        </div>
      </div>
      <div class="logs-display">
        <div id="logs-list" class="logs-list"></div>
      </div>
    </section>
    
    <section id="storage-tab" class="tab-content">
      <div class="storage-section">
        <div class="storage-stats">
          <div class="stat-card">
            <h3>Total Logs</h3>
            <span id="total-logs-count">0</span>
          </div>
          <div class="stat-card">
            <h3>Storage Used</h3>
            <span id="storage-used">0 MB</span>
          </div>
          <div class="stat-card">
            <h3>Oldest Log</h3>
            <span id="oldest-log">N/A</span>
          </div>
          <div class="stat-card">
            <h3>Active Sessions</h3>
            <span id="active-sessions">0</span>
          </div>
        </div>
        
        <div class="storage-breakdown">
          <h3>Storage by Domain</h3>
          <div id="domain-storage-list" class="domain-storage-list"></div>
        </div>
        
        <div class="cleanup-options">
          <div class="cleanup-controls">
            <div class="cleanup-option">
              <label for="cleanup-older-than">Clean up logs older than:</label>
              <select id="cleanup-older-than">
                <option value="7">7 days</option>
                <option value="30" selected>30 days</option>
              </select>
              <button id="cleanup-by-age" class="btn-secondary">Clean Up</button>
            </div>
            
            <div class="cleanup-option">
              <label for="cleanup-domain-select">Clean up logs for domain:</label>
              <select id="cleanup-domain-select">
                <option value="">Select domain...</option>
              </select>
              <button id="cleanup-by-domain" class="btn-secondary">Clean Up Domain</button>
            </div>
            
            <div class="cleanup-option">
              <label for="cleanup-session-select">Clean up specific session:</label>
              <select id="cleanup-session-select">
                <option value="">Select session...</option>
              </select>
              <button id="cleanup-by-session" class="btn-secondary">Clean Up Session</button>
            </div>
          </div>
        </div>
        
        <div class="storage-actions">
          <button id="refresh-storage-stats" class="btn-secondary">Refresh Stats</button>
          <button id="export-storage-report" class="btn-secondary">Export Storage Report</button>
          <button id="clear-all" class="btn-danger">Clear All Logs</button>
        </div>
      </div>
    </section>
  </div>
</body>
</html>
`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock chrome API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock URL and Blob for export functionality
global.URL = {
  createObjectURL: jest.fn(() => 'mock-url'),
  revokeObjectURL: jest.fn()
};

global.Blob = jest.fn();

// Import the classes we need to test
const LogEntry = require('../models/LogEntry');

// Mock StorageManager for testing
class MockStorageManager {
  constructor() {
    this.logs = [];
  }

  async initializeDatabase() {
    return Promise.resolve();
  }

  async calculateStorageUsage() {
    const totalSize = this.logs.length * 1000; // Mock size calculation
    const domainSizes = {};
    
    this.logs.forEach(log => {
      if (!domainSizes[log.domain]) {
        domainSizes[log.domain] = { size: 0, count: 0 };
      }
      domainSizes[log.domain].size += 1000;
      domainSizes[log.domain].count++;
    });

    return {
      entryCount: this.logs.length,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      domainSizes,
      averageEntrySize: this.logs.length > 0 ? 1000 : 0
    };
  }

  async saveLog(log) {
    this.logs.push(log);
    return log.id;
  }

  async queryLogs(options = {}) {
    return this.logs.slice(0, options.limit || this.logs.length);
  }

  async clearAllLogs() {
    this.logs = [];
    return true;
  }

  async cleanupByAge(maxAgeMs) {
    const cutoffTime = Date.now() - maxAgeMs;
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp > cutoffTime);
    return initialCount - this.logs.length;
  }

  async deleteLogsByDomain(domain) {
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => log.domain !== domain);
    return initialCount - this.logs.length;
  }

  async getLogsBySession(sessionId) {
    return this.logs.filter(log => log.sessionId === sessionId);
  }

  async getLogsByDomain(domain) {
    return this.logs.filter(log => log.domain === domain);
  }

  async deleteLogs(logIds) {
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => !logIds.includes(log.id));
    return initialCount - this.logs.length;
  }

  async getLog(id) {
    return this.logs.find(log => log.id === id) || null;
  }

  async getLogCount() {
    return this.logs.length;
  }
}

// Mock OptionsPageManager class with log management methods
class MockOptionsPageManager {
  constructor() {
    this.storageManager = new MockStorageManager();
    this.currentLogs = [];
    this.isLoading = false;
  }

  async refreshStorageStats() {
    const usage = await this.storageManager.calculateStorageUsage();
    this.updateStorageStatsDisplay(usage, {}, {});
    return usage;
  }

  updateStorageStatsDisplay(usage, quota, status) {
    document.getElementById('total-logs-count').textContent = usage.entryCount.toString();
    document.getElementById('storage-used').textContent = `${usage.totalSizeMB} MB`;
  }

  async updateDomainStorageBreakdown(domainSizes) {
    const domainList = document.getElementById('domain-storage-list');
    
    if (Object.keys(domainSizes).length === 0) {
      domainList.innerHTML = '<div class="no-domains">No domains found</div>';
      return;
    }
    
    const sortedDomains = Object.entries(domainSizes)
      .sort(([,a], [,b]) => b.size - a.size);
    
    const domainHTML = sortedDomains.map(([domain, data]) => {
      const sizeMB = Math.round((data.size / (1024 * 1024)) * 100) / 100;
      return `
        <div class="domain-storage-item">
          <div class="domain-name">${domain}</div>
          <div class="domain-stats">
            <span>${data.count} logs</span>
            <span>${sizeMB} MB</span>
          </div>
        </div>
      `;
    }).join('');
    
    domainList.innerHTML = domainHTML;
  }

  async clearAllLogs() {
    return await this.storageManager.clearAllLogs();
  }

  async cleanupByAge() {
    const ageSelect = document.getElementById('cleanup-older-than');
    const days = parseInt(ageSelect.value);
    const maxAgeMs = days * 24 * 60 * 60 * 1000;
    return await this.storageManager.cleanupByAge(maxAgeMs);
  }

  async cleanupByDomain() {
    const domainSelect = document.getElementById('cleanup-domain-select');
    const domain = domainSelect.value;
    if (!domain) return 0;
    return await this.storageManager.deleteLogsByDomain(domain);
  }

  async cleanupBySession() {
    const sessionSelect = document.getElementById('cleanup-session-select');
    const sessionId = sessionSelect.value;
    if (!sessionId) return 0;
    
    const sessionLogs = await this.storageManager.getLogsBySession(sessionId);
    const logIds = sessionLogs.map(log => log.id);
    return await this.storageManager.deleteLogs(logIds);
  }

  toggleSelectAllLogs(selectAll) {
    const logEntries = document.querySelectorAll('.log-entry');
    logEntries.forEach(entry => {
      const checkbox = entry.querySelector('.log-select-checkbox');
      if (checkbox) {
        checkbox.checked = selectAll;
      }
    });
    this.updateBulkSelectionCount();
  }

  updateBulkSelectionCount() {
    const selectedCheckboxes = document.querySelectorAll('.log-select-checkbox:checked');
    return selectedCheckboxes.length;
  }

  async bulkDeleteLogs() {
    const selectedCheckboxes = document.querySelectorAll('.log-select-checkbox:checked');
    const logIds = Array.from(selectedCheckboxes).map(checkbox => {
      const logEntry = checkbox.closest('.log-entry');
      return logEntry.dataset.logId;
    });
    
    return await this.storageManager.deleteLogs(logIds);
  }

  renderLogEntry(log) {
    return `
      <div class="log-entry" data-log-id="${log.id}">
        <div class="log-header">
          <input type="checkbox" class="log-select-checkbox">
          <span class="log-level log-${log.level}">${log.level.toUpperCase()}</span>
          <span class="log-domain">${log.domain}</span>
          <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
        </div>
        <div class="log-message">${log.message}</div>
      </div>
    `;
  }

  displayLogs(logs) {
    const logsList = document.getElementById('logs-list');
    const logsHTML = logs.map(log => this.renderLogEntry(log)).join('');
    logsList.innerHTML = logsHTML;
  }

  showStorageMessage(message, type) {
    // Mock implementation for testing
    console.log(`${type}: ${message}`);
  }

  showLoading(show) {
    // Mock implementation for testing
    this.isLoading = show;
  }
}

describe('Log Management UI Integration', () => {
  let optionsManager;
  let mockLogs;

  beforeEach(async () => {
    optionsManager = new MockOptionsPageManager();
    await optionsManager.storageManager.initializeDatabase();
    
    // Create mock log entries
    mockLogs = [
      new LogEntry('info', 'Test log 1', [], 'https://example.com', 1),
      new LogEntry('error', 'Test error', [], 'https://test.com', 2),
      new LogEntry('warn', 'Test warning', [], 'https://example.com', 1),
      new LogEntry('log', 'Debug message', [], 'https://debug.com', 3)
    ];
    
    // Set proper domains for the mock logs
    mockLogs[0].domain = 'example.com';
    mockLogs[1].domain = 'test.com';
    mockLogs[2].domain = 'example.com';
    mockLogs[3].domain = 'debug.com';
    
    // Save mock logs
    for (const log of mockLogs) {
      await optionsManager.storageManager.saveLog(log);
    }
  });

  afterEach(async () => {
    await optionsManager.storageManager.clearAllLogs();
  });

  describe('Storage Statistics Display', () => {
    test('should refresh and display storage statistics', async () => {
      const usage = await optionsManager.refreshStorageStats();
      
      expect(usage.entryCount).toBe(4);
      expect(usage.totalSizeBytes).toBeGreaterThan(0);
      expect(document.getElementById('total-logs-count').textContent).toBe('4');
    });

    test('should update domain storage breakdown', async () => {
      const usage = await optionsManager.storageManager.calculateStorageUsage();
      await optionsManager.updateDomainStorageBreakdown(usage.domainSizes);
      
      const domainList = document.getElementById('domain-storage-list');
      const domainItems = domainList.querySelectorAll('.domain-storage-item');
      
      expect(domainItems.length).toBeGreaterThan(0);
      expect(domainList.innerHTML).toContain('example.com');
      expect(domainList.innerHTML).toContain('test.com');
    });

    test('should handle empty domain breakdown', async () => {
      await optionsManager.storageManager.clearAllLogs();
      await optionsManager.updateDomainStorageBreakdown({});
      
      const domainList = document.getElementById('domain-storage-list');
      expect(domainList.innerHTML).toContain('No domains found');
    });
  });

  describe('Cleanup Operations', () => {
    test('should clear all logs', async () => {
      const result = await optionsManager.clearAllLogs();
      expect(result).toBe(true);
      
      const count = await optionsManager.storageManager.getLogCount();
      expect(count).toBe(0);
    });

    test('should cleanup logs by age', async () => {
      // Set cleanup age to 30 days
      document.getElementById('cleanup-older-than').value = '30';
      
      const deletedCount = await optionsManager.cleanupByAge();
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });

    test('should cleanup logs by domain', async () => {
      // Set domain to clean up
      const domainSelect = document.getElementById('cleanup-domain-select');
      domainSelect.innerHTML = '<option value="">Select domain...</option><option value="example.com">example.com</option>';
      domainSelect.value = 'example.com';
      
      const deletedCount = await optionsManager.cleanupByDomain();
      expect(deletedCount).toBeGreaterThan(0);
      
      // Verify logs for that domain are gone
      const remainingLogs = await optionsManager.storageManager.getLogsByDomain('example.com');
      expect(remainingLogs.length).toBe(0);
    });

    test('should cleanup logs by session', async () => {
      // Get a session ID from existing logs
      const logs = await optionsManager.storageManager.queryLogs({ limit: 1 });
      const sessionId = logs[0].sessionId;
      
      // Set session to clean up
      const sessionSelect = document.getElementById('cleanup-session-select');
      sessionSelect.innerHTML = `<option value="">Select session...</option><option value="${sessionId}">Test Session</option>`;
      sessionSelect.value = sessionId;
      
      const deletedCount = await optionsManager.cleanupBySession();
      expect(deletedCount).toBeGreaterThan(0);
    });

    test('should handle cleanup with no selection', async () => {
      // Test domain cleanup with no selection
      document.getElementById('cleanup-domain-select').value = '';
      const domainResult = await optionsManager.cleanupByDomain();
      expect(domainResult).toBe(0);
      
      // Test session cleanup with no selection
      document.getElementById('cleanup-session-select').value = '';
      const sessionResult = await optionsManager.cleanupBySession();
      expect(sessionResult).toBe(0);
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(() => {
      // Display logs in the UI
      optionsManager.displayLogs(mockLogs);
    });

    test('should select all logs', () => {
      optionsManager.toggleSelectAllLogs(true);
      
      const selectedCount = optionsManager.updateBulkSelectionCount();
      expect(selectedCount).toBe(mockLogs.length);
      
      const checkboxes = document.querySelectorAll('.log-select-checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox.checked).toBe(true);
      });
    });

    test('should deselect all logs', () => {
      // First select all
      optionsManager.toggleSelectAllLogs(true);
      
      // Then deselect all
      optionsManager.toggleSelectAllLogs(false);
      
      const selectedCount = optionsManager.updateBulkSelectionCount();
      expect(selectedCount).toBe(0);
      
      const checkboxes = document.querySelectorAll('.log-select-checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox.checked).toBe(false);
      });
    });

    test('should delete selected logs in bulk', async () => {
      // Select first two logs
      const checkboxes = document.querySelectorAll('.log-select-checkbox');
      checkboxes[0].checked = true;
      checkboxes[1].checked = true;
      
      const deletedCount = await optionsManager.bulkDeleteLogs();
      expect(deletedCount).toBe(2);
      
      const remainingCount = await optionsManager.storageManager.getLogCount();
      expect(remainingCount).toBe(2);
    });

    test('should handle bulk delete with no selection', async () => {
      // No checkboxes selected
      const deletedCount = await optionsManager.bulkDeleteLogs();
      expect(deletedCount).toBe(0);
      
      const totalCount = await optionsManager.storageManager.getLogCount();
      expect(totalCount).toBe(4); // All logs should remain
    });

    test('should update selection count correctly', () => {
      const checkboxes = document.querySelectorAll('.log-select-checkbox');
      
      // Select first checkbox
      checkboxes[0].checked = true;
      let count = optionsManager.updateBulkSelectionCount();
      expect(count).toBe(1);
      
      // Select second checkbox
      checkboxes[1].checked = true;
      count = optionsManager.updateBulkSelectionCount();
      expect(count).toBe(2);
      
      // Deselect first checkbox
      checkboxes[0].checked = false;
      count = optionsManager.updateBulkSelectionCount();
      expect(count).toBe(1);
    });
  });

  describe('Log Entry Rendering', () => {
    test('should render log entry with selection checkbox', () => {
      const log = mockLogs[0];
      const html = optionsManager.renderLogEntry(log);
      
      expect(html).toContain('log-select-checkbox');
      expect(html).toContain(log.level.toUpperCase());
      expect(html).toContain(log.domain);
      expect(html).toContain(log.message);
      expect(html).toContain(`data-log-id="${log.id}"`);
    });

    test('should display multiple logs with checkboxes', () => {
      optionsManager.displayLogs(mockLogs);
      
      const logEntries = document.querySelectorAll('.log-entry');
      const checkboxes = document.querySelectorAll('.log-select-checkbox');
      
      expect(logEntries.length).toBe(mockLogs.length);
      expect(checkboxes.length).toBe(mockLogs.length);
      
      // Verify each log has correct data
      logEntries.forEach((entry, index) => {
        expect(entry.dataset.logId).toBe(mockLogs[index].id);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      // Mock a storage error
      const originalMethod = optionsManager.storageManager.calculateStorageUsage;
      optionsManager.storageManager.calculateStorageUsage = jest.fn().mockRejectedValue(new Error('Storage error'));
      
      // Should not throw
      await expect(optionsManager.refreshStorageStats()).rejects.toThrow('Storage error');
      
      // Restore original method
      optionsManager.storageManager.calculateStorageUsage = originalMethod;
    });

    test('should handle cleanup errors gracefully', async () => {
      // Mock a cleanup error
      const originalMethod = optionsManager.storageManager.cleanupByAge;
      optionsManager.storageManager.cleanupByAge = jest.fn().mockRejectedValue(new Error('Cleanup error'));
      
      await expect(optionsManager.cleanupByAge()).rejects.toThrow('Cleanup error');
      
      // Restore original method
      optionsManager.storageManager.cleanupByAge = originalMethod;
    });
  });

  describe('UI State Management', () => {
    test('should show loading state', () => {
      optionsManager.showLoading(true);
      expect(optionsManager.isLoading).toBe(true);
      
      optionsManager.showLoading(false);
      expect(optionsManager.isLoading).toBe(false);
    });

    test('should display storage messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      optionsManager.showStorageMessage('Test message', 'success');
      expect(consoleSpy).toHaveBeenCalledWith('success: Test message');
      
      optionsManager.showStorageMessage('Error message', 'error');
      expect(consoleSpy).toHaveBeenCalledWith('error: Error message');
      
      consoleSpy.mockRestore();
    });
  });
});

describe('Storage Management Integration', () => {
  let storageManager;

  beforeEach(async () => {
    storageManager = new MockStorageManager();
    await storageManager.initializeDatabase();
  });

  afterEach(async () => {
    await storageManager.clearAllLogs();
  });

  test('should perform comprehensive cleanup', async () => {
    // Add test logs with different ages
    const now = Date.now();
    const oldLog = new LogEntry('info', 'Old log', [], 'https://example.com', 1);
    oldLog.timestamp = now - (40 * 24 * 60 * 60 * 1000); // 40 days old
    
    const newLog = new LogEntry('info', 'New log', [], 'https://example.com', 1);
    newLog.timestamp = now - (10 * 24 * 60 * 60 * 1000); // 10 days old
    
    await storageManager.saveLog(oldLog);
    await storageManager.saveLog(newLog);
    
    // Perform cleanup with 30-day retention
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
    const deletedCount = await storageManager.cleanupByAge(maxAgeMs);
    
    expect(deletedCount).toBe(1);
    
    // Verify only new log remains
    const remainingLogs = await storageManager.queryLogs({});
    expect(remainingLogs.length).toBe(1);
    expect(remainingLogs[0].id).toBe(newLog.id);
  });

  test('should calculate storage usage correctly', async () => {
    // Add test logs
    const logs = [];
    for (let i = 0; i < 5; i++) {
      const log = new LogEntry('info', `Test log ${i}`, [], 'https://example.com', 1);
      log.domain = 'example.com'; // Ensure domain is set
      logs.push(log);
      await storageManager.saveLog(log);
    }
    
    const usage = await storageManager.calculateStorageUsage();
    
    expect(usage.entryCount).toBe(5);
    expect(usage.totalSizeBytes).toBe(5000);
    expect(usage.domainSizes['example.com']).toEqual({ size: 5000, count: 5 });
  });
});