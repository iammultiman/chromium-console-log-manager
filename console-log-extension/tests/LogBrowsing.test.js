/**
 * Tests for log browsing and search functionality
 */

const { JSDOM } = require('jsdom');

// Mock IndexedDB for testing
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
          get: jest.fn(),
          getAll: jest.fn(),
          openCursor: jest.fn(),
          index: jest.fn(() => ({
            openCursor: jest.fn(),
            getAll: jest.fn()
          }))
        }))
      }))
    }
  }))
};

// Mock chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

describe('Log Browsing and Search Functionality', () => {
  let dom;
  let document;
  let window;
  let StorageManager;
  let FilterCriteria;
  let OptionsPageManager;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div id="logs-list"></div>
          <input id="log-search" type="text">
          <button id="search-btn">Search</button>
          <button id="clear-search">Clear</button>
          <select id="level-filter">
            <option value="">All Levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="log">Log</option>
          </select>
          <select id="domain-filter">
            <option value="">All Domains</option>
          </select>
          <select id="session-filter">
            <option value="">All Sessions</option>
          </select>
          <input id="date-from" type="date">
          <input id="date-to" type="date">
          <button id="apply-filters">Apply Filters</button>
          <button id="clear-filters">Clear Filters</button>
          <input id="show-timestamps" type="checkbox" checked>
          <input id="show-domains" type="checkbox" checked>
          <input id="syntax-highlighting" type="checkbox" checked>
          <select id="sort-by">
            <option value="timestamp-desc">Newest first</option>
            <option value="timestamp-asc">Oldest first</option>
            <option value="level">Log level</option>
            <option value="domain">Domain</option>
          </select>
          <button id="prev-page">Previous</button>
          <button id="next-page">Next</button>
          <span id="page-info">Page 1 of 1</span>
        </body>
      </html>
    `);

    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;

    // Load the classes directly
    StorageManager = require('../models/StorageManager.js');
    FilterCriteria = require('../models/FilterCriteria.js');

    // Mock OptionsPageManager class (simplified for testing)
    class MockOptionsPageManager {
      constructor() {
        this.storageManager = new StorageManager();
        this.currentFilter = new FilterCriteria();
        this.currentLogs = [];
        this.currentPage = 1;
        this.logsPerPage = 50;
        this.totalLogs = 0;
        this.syntaxHighlighting = true;
      }

      escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      applySyntaxHighlighting(message) {
        return message
          .replace(/(".*?")/g, '<span class="syntax-string">$1</span>')
          .replace(/\b(\d+\.?\d*)\b/g, '<span class="syntax-number">$1</span>')
          .replace(/\b(true|false|null|undefined)\b/g, '<span class="syntax-keyword">$1</span>')
          .replace(/(https?:\/\/[^\s]+)/g, '<span class="syntax-url">$1</span>')
          .replace(/\b(ERROR|WARN|INFO|DEBUG)\b/g, '<span class="syntax-level">$1</span>');
      }

      highlightSearchTerms(message, searchTerm) {
        if (!searchTerm) return message;
        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
        return message.replace(regex, '<mark class="search-highlight">$1</mark>');
      }

      renderLogEntry(log, showTimestamps, showDomains) {
        const timestamp = showTimestamps ? new Date(log.timestamp).toLocaleString() : '';
        const domain = showDomains ? log.domain : '';
        const levelClass = `log-${log.level}`;
        
        let message = this.escapeHtml(log.message);
        if (this.syntaxHighlighting) {
          message = this.applySyntaxHighlighting(message);
        }
        
        if (this.currentFilter.textSearch) {
          message = this.highlightSearchTerms(message, this.currentFilter.textSearch);
        }
        
        return `
          <div class="log-entry" data-log-id="${log.id}">
            <div class="log-header">
              <span class="log-level ${levelClass}">${log.level.toUpperCase()}</span>
              ${showDomains ? `<span class="log-domain">${domain}</span>` : ''}
              ${showTimestamps ? `<span class="log-timestamp">${timestamp}</span>` : ''}
              <span class="log-session" title="Session: ${log.sessionId}">Session</span>
            </div>
            <div class="log-message">${message}</div>
          </div>
        `;
      }

      displayLogs(logs) {
        const logsList = document.getElementById('logs-list');
        const showTimestamps = document.getElementById('show-timestamps').checked;
        const showDomains = document.getElementById('show-domains').checked;
        
        if (logs.length === 0) {
          logsList.innerHTML = '<div class="no-logs">No logs found matching your criteria.</div>';
          return;
        }
        
        const logsHTML = logs.map(log => this.renderLogEntry(log, showTimestamps, showDomains)).join('');
        logsList.innerHTML = logsHTML;
      }
    }

    OptionsPageManager = MockOptionsPageManager;
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('FilterCriteria', () => {
    test('should create filter with default values', () => {
      const filter = new FilterCriteria();
      
      expect(filter.textSearch).toBe('');
      expect(filter.levels).toEqual(['log', 'error', 'warn', 'info']);
      expect(filter.dateRange).toEqual({ start: null, end: null });
      expect(filter.domains).toEqual([]);
      expect(filter.sessionIds).toEqual([]);
    });

    test('should set text search criteria', () => {
      const filter = new FilterCriteria();
      filter.setTextSearch('error message');
      
      expect(filter.textSearch).toBe('error message');
    });

    test('should set log levels', () => {
      const filter = new FilterCriteria();
      filter.setLevels(['error', 'warn']);
      
      expect(filter.levels).toEqual(['error', 'warn']);
    });

    test('should set date range', () => {
      const filter = new FilterCriteria();
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      
      filter.setDateRange(start, end);
      
      expect(filter.dateRange.start).toBe(start.getTime());
      expect(filter.dateRange.end).toBe(end.getTime());
    });

    test('should match log entries correctly', () => {
      const filter = new FilterCriteria();
      filter.setTextSearch('test');
      filter.setLevels(['error']);
      
      const logEntry = {
        level: 'error',
        message: 'This is a test error message',
        timestamp: Date.now(),
        domain: 'example.com',
        sessionId: 'session1'
      };
      
      expect(filter.matches(logEntry)).toBe(true);
    });

    test('should not match log entries with different level', () => {
      const filter = new FilterCriteria();
      filter.setLevels(['error']);
      
      const logEntry = {
        level: 'info',
        message: 'This is an info message',
        timestamp: Date.now(),
        domain: 'example.com',
        sessionId: 'session1'
      };
      
      expect(filter.matches(logEntry)).toBe(false);
    });

    test('should match text search case-insensitively', () => {
      const filter = new FilterCriteria();
      filter.setTextSearch('ERROR');
      
      const logEntry = {
        level: 'error',
        message: 'This is an error message',
        timestamp: Date.now(),
        domain: 'example.com',
        sessionId: 'session1'
      };
      
      expect(filter.matchesTextSearch(logEntry.message)).toBe(true);
    });
  });

  describe('Log Display and Rendering', () => {
    let optionsManager;

    beforeEach(() => {
      optionsManager = new OptionsPageManager();
    });

    test('should render log entry with all elements', () => {
      const log = {
        id: 'log1',
        level: 'error',
        message: 'Test error message',
        timestamp: Date.now(),
        domain: 'example.com',
        sessionId: 'session1'
      };

      const html = optionsManager.renderLogEntry(log, true, true);
      
      expect(html).toContain('log-error');
      expect(html).toContain('ERROR');
      expect(html).toContain('example.com');
      expect(html).toContain('Test error message');
      expect(html).toContain('session1');
    });

    test('should apply syntax highlighting', () => {
      const message = 'Value is "test string" and number is 123';
      const highlighted = optionsManager.applySyntaxHighlighting(message);
      
      expect(highlighted).toContain('<span class="syntax-string">"test string"</span>');
      expect(highlighted).toContain('<span class="syntax-number">123</span>');
    });

    test('should highlight search terms', () => {
      const message = 'This is a test message';
      const highlighted = optionsManager.highlightSearchTerms(message, 'test');
      
      expect(highlighted).toContain('<mark class="search-highlight">test</mark>');
    });

    test('should display no logs message when empty', () => {
      optionsManager.displayLogs([]);
      
      const logsList = document.getElementById('logs-list');
      expect(logsList.innerHTML).toContain('No logs found matching your criteria');
    });

    test('should display logs when provided', () => {
      const logs = [
        {
          id: 'log1',
          level: 'info',
          message: 'Test message',
          timestamp: Date.now(),
          domain: 'example.com',
          sessionId: 'session1'
        }
      ];

      optionsManager.displayLogs(logs);
      
      const logsList = document.getElementById('logs-list');
      expect(logsList.innerHTML).toContain('Test message');
      expect(logsList.innerHTML).toContain('log-info');
    });
  });

  describe('Search and Filter Integration', () => {
    let optionsManager;

    beforeEach(() => {
      optionsManager = new OptionsPageManager();
    });

    test('should escape HTML in log messages', () => {
      const maliciousMessage = '<script>alert("xss")</script>';
      const escaped = optionsManager.escapeHtml(maliciousMessage);
      
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });

    test('should escape regex special characters', () => {
      const specialChars = '.*+?^${}()|[]\\';
      const escaped = optionsManager.escapeRegex(specialChars);
      
      expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    test('should handle empty search terms gracefully', () => {
      const message = 'Test message';
      const highlighted = optionsManager.highlightSearchTerms(message, '');
      
      expect(highlighted).toBe(message);
    });

    test('should handle null/undefined values in filters', () => {
      const filter = new FilterCriteria();
      
      const logEntry = {
        level: 'info',
        message: null,
        timestamp: Date.now(),
        domain: 'example.com',
        sessionId: 'session1'
      };
      
      expect(() => filter.matches(logEntry)).not.toThrow();
    });
  });

  describe('Pagination Logic', () => {
    test('should calculate correct page numbers', () => {
      const totalLogs = 150;
      const logsPerPage = 50;
      const totalPages = Math.ceil(totalLogs / logsPerPage);
      
      expect(totalPages).toBe(3);
    });

    test('should calculate correct offset for pagination', () => {
      const currentPage = 2;
      const logsPerPage = 50;
      const offset = (currentPage - 1) * logsPerPage;
      
      expect(offset).toBe(50);
    });
  });
});