# Developer Documentation

This document provides detailed technical information for developers working on the Console Log Extension.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Component Details](#component-details)
- [Data Models](#data-models)
- [Storage System](#storage-system)
- [Message Passing](#message-passing)
- [Testing Strategy](#testing-strategy)
- [Build Process](#build-process)
- [Debugging](#debugging)
- [Performance Considerations](#performance-considerations)
- [Security Implementation](#security-implementation)

## Architecture Overview

The Console Log Extension follows a multi-component architecture designed for Chrome Extension Manifest V3:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Content       │    │   Background    │    │   Storage       │
│   Script        │───▶│   Service       │───▶│   Manager       │
│                 │    │   Worker        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │   Settings      │    │   IndexedDB     │
         │              │   Manager       │    │   Storage       │
         │              └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│   Popup         │    │   Options       │
│   Interface     │    │   Page          │
└─────────────────┘    └─────────────────┘
```

### Component Responsibilities

- **Content Script**: Console interception, log capture, keyword filtering
- **Background Service Worker**: Log processing, storage coordination, settings management
- **Storage Manager**: IndexedDB operations, data lifecycle, cleanup policies
- **Popup Interface**: Quick access, status display, basic controls
- **Options Page**: Full log management, advanced settings, export functionality

## Component Details

### Content Script (`content/content.js`)

The content script is injected into every web page and is responsible for capturing console logs.

#### Key Functions

```javascript
// Console method interception
function interceptConsole() {
  const originalMethods = {};
  ['log', 'error', 'warn', 'info'].forEach(method => {
    originalMethods[method] = console[method];
    console[method] = function(...args) {
      captureLogMessage(method, args, Date.now());
      return originalMethods[method].apply(console, args);
    };
  });
}

// Log message processing
function captureLogMessage(level, args, timestamp) {
  const logEntry = new LogEntry(level, args, timestamp, window.location.href, tabId);
  if (shouldCaptureLog(logEntry)) {
    sendToBackground(logEntry);
  }
}

// Keyword filtering
function shouldCaptureLog(logEntry) {
  return keywordFilters.matches(logEntry.message);
}
```

#### Message Format
```javascript
{
  type: 'LOG_CAPTURED',
  data: {
    id: 'unique-log-id',
    timestamp: 1640995200000,
    level: 'error',
    message: 'Formatted log message',
    args: [/* original console arguments */],
    url: 'https://example.com/page',
    tabId: 123,
    sessionId: 'session-uuid'
  }
}
```

### Background Service Worker (`background/background.js`)

The background script coordinates all extension functionality and manages data flow.

#### Key Functions

```javascript
// Message handling from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'LOG_CAPTURED':
      processLogMessage(message.data, sender.tab);
      break;
    case 'GET_SETTINGS':
      sendResponse(await getSettings());
      break;
  }
});

// Log processing pipeline
async function processLogMessage(logData, tab) {
  // 1. Validate log data
  if (!validateLogData(logData)) return;
  
  // 2. Apply global filters
  if (!globalFilters.matches(logData)) return;
  
  // 3. Check sensitive data
  if (settings.sensitiveDataFiltering && containsSensitiveData(logData)) {
    logData.filtered = true;
  }
  
  // 4. Store log
  await storageManager.saveLog(logData);
  
  // 5. Update UI
  notifyUIUpdate(logData);
}
```

#### Session Management
```javascript
// Session tracking
const sessions = new Map();

function getOrCreateSession(tabId, url) {
  const domain = new URL(url).hostname;
  const sessionKey = `${tabId}-${domain}`;
  
  if (!sessions.has(sessionKey)) {
    sessions.set(sessionKey, {
      id: generateUUID(),
      tabId,
      domain,
      startTime: Date.now(),
      logCount: 0
    });
  }
  
  return sessions.get(sessionKey);
}
```

### Storage Manager (`models/StorageManager.js`)

Handles all persistent storage operations using IndexedDB for logs and Chrome Storage API for settings.

#### Database Schema
```javascript
const DB_SCHEMA = {
  name: 'ConsoleLogDB',
  version: 1,
  stores: {
    logs: {
      keyPath: 'id',
      indexes: [
        { name: 'timestamp', keyPath: 'timestamp' },
        { name: 'domain', keyPath: 'domain' },
        { name: 'level', keyPath: 'level' },
        { name: 'sessionId', keyPath: 'sessionId' }
      ]
    },
    sessions: {
      keyPath: 'id',
      indexes: [
        { name: 'domain', keyPath: 'domain' },
        { name: 'startTime', keyPath: 'startTime' }
      ]
    }
  }
};
```

#### Storage Operations
```javascript
class StorageManager {
  async saveLogs(logs) {
    const transaction = this.db.transaction(['logs'], 'readwrite');
    const store = transaction.objectStore('logs');
    
    for (const log of logs) {
      await store.add(log);
    }
    
    return transaction.complete;
  }
  
  async queryLogs(criteria) {
    const transaction = this.db.transaction(['logs'], 'readonly');
    const store = transaction.objectStore('logs');
    
    // Use appropriate index based on criteria
    const index = this.selectOptimalIndex(criteria);
    const range = this.buildKeyRange(criteria);
    
    return store.index(index).getAll(range);
  }
  
  async cleanupOldLogs() {
    const cutoffDate = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    const transaction = this.db.transaction(['logs'], 'readwrite');
    const store = transaction.objectStore('logs');
    const index = store.index('timestamp');
    
    const range = IDBKeyRange.upperBound(cutoffDate);
    const cursor = await index.openCursor(range);
    
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

## Data Models
class LogEntry {
  constructor(level, args, timestamp, url, tabId) {
    this.id = this.generateId();
    this.timestamp = timestamp;
    this.level = level;
    this.message = this.formatMessage(args);
    this.args = this.serializeArgs(args);
    this.url = url;
    this.domain = this.extractDomain(url);
    this.tabId = tabId;
    this.sessionId = this.generateSessionId(tabId, url);
  }
  
  formatMessage(args) {
    return args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return '[Object]';
        }
      }
      return String(arg);
    }).join(' ');
  }
  
  serializeArgs(args) {
    return args.map(arg => {
      if (typeof arg === 'function') return '[Function]';
      if (arg instanceof Error) return { name: arg.name, message: arg.message, stack: arg.stack };
      return arg;
    });
  }
}
```

### FilterCriteria Model
```javascript
class FilterCriteria {
  constructor() {
    this.textSearch = '';
    this.levels = ['log', 'error', 'warn', 'info'];
    this.dateRange = { start: null, end: null };
    this.domains = [];
    this.sessionIds = [];
    this.caseSensitive = false;
  }
  
  matches(logEntry) {
    // Text search
    if (this.textSearch) {
      const searchText = this.caseSensitive ? this.textSearch : this.textSearch.toLowerCase();
      const messageText = this.caseSensitive ? logEntry.message : logEntry.message.toLowerCase();
      if (!messageText.includes(searchText)) return false;
    }
    
    // Level filter
    if (!this.levels.includes(logEntry.level)) return false;
    
    // Date range filter
    if (this.dateRange.start && logEntry.timestamp < this.dateRange.start) return false;
    if (this.dateRange.end && logEntry.timestamp > this.dateRange.end) return false;
    
    // Domain filter
    if (this.domains.length > 0 && !this.domains.includes(logEntry.domain)) return false;
    
    // Session filter
    if (this.sessionIds.length > 0 && !this.sessionIds.includes(logEntry.sessionId)) return false;
    
    return true;
  }
}
```

## Message Passing

The extension uses Chrome's message passing API for communication between components.

### Message Types
```javascript
const MESSAGE_TYPES = {
  // Content Script → Background
  LOG_CAPTURED: 'LOG_CAPTURED',
  GET_SETTINGS: 'GET_SETTINGS',
  
  // Background → Content Script
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  CAPTURE_ENABLED: 'CAPTURE_ENABLED',
  
  // UI → Background
  QUERY_LOGS: 'QUERY_LOGS',
  EXPORT_LOGS: 'EXPORT_LOGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  CLEAR_LOGS: 'CLEAR_LOGS',
  
  // Background → UI
  LOGS_UPDATED: 'LOGS_UPDATED',
  EXPORT_COMPLETE: 'EXPORT_COMPLETE',
  STORAGE_WARNING: 'STORAGE_WARNING'
};
```

### Message Handlers
```javascript
// Background script message router
class MessageRouter {
  constructor() {
    this.handlers = new Map();
    this.setupHandlers();
  }
  
  setupHandlers() {
    this.handlers.set('LOG_CAPTURED', this.handleLogCaptured.bind(this));
    this.handlers.set('QUERY_LOGS', this.handleQueryLogs.bind(this));
    this.handlers.set('EXPORT_LOGS', this.handleExportLogs.bind(this));
  }
  
  async handleMessage(message, sender, sendResponse) {
    const handler = this.handlers.get(message.type);
    if (handler) {
      try {
        const result = await handler(message.data, sender);
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
  }
}
```

## Testing Strategy

### Test Structure
```
tests/
├── unit/                    # Unit tests for individual components
│   ├── LogEntry.test.js
│   ├── StorageManager.test.js
│   └── FilterCriteria.test.js
├── integration/             # Integration tests
│   ├── end-to-end-log-flow.test.js
│   └── cross-component-communication.test.js
├── performance/             # Performance tests
│   ├── large-volume-performance.test.js
│   └── memory-efficiency.test.js
├── security/                # Security tests
│   └── data-isolation.test.js
└── setup/                   # Test configuration
    ├── jest.setup.js
    └── test-utils.js
```

### Test Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  collectCoverageFrom: [
    'models/**/*.js',
    'background/**/*.js',
    'content/**/*.js',
    'popup/**/*.js',
    'options/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Mock Chrome APIs
```javascript
// tests/setup/chrome-mocks.js
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn(),
    getURL: jest.fn(path => `chrome-extension://test/${path}`)
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  }
};
```

## Build Process

### Development Workflow
```bash
# Install dependencies
npm install

# Run development server (for testing)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Package Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "lint": "eslint . --ext .js",
    "lint:fix": "eslint . --ext .js --fix",
    "format": "prettier --write .",
    "build": "node scripts/build.js",
    "package": "node scripts/package.js"
  }
}
```

## Debugging

### Chrome DevTools
```javascript
// Enable debug logging
const DEBUG = true;

function debugLog(message, data) {
  if (DEBUG) {
    console.log(`[Console Log Extension] ${message}`, data);
  }
}

// Background script debugging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('Received message', { message, sender: sender.tab?.url });
  // ... handle message
});
```

### Extension Debugging
1. **Background Script**: Open `chrome://extensions/` → Click "Inspect views: background page"
2. **Content Script**: Open DevTools on the target page → Console tab
3. **Popup**: Right-click extension icon → "Inspect popup"
4. **Options Page**: Right-click extension icon → "Options" → F12

### Common Debug Scenarios
```javascript
// Check if content script is injected
if (typeof window.consoleLogExtensionInjected === 'undefined') {
  console.error('Content script not injected');
}

// Verify message passing
chrome.runtime.sendMessage({ type: 'TEST' }, response => {
  if (chrome.runtime.lastError) {
    console.error('Message passing failed:', chrome.runtime.lastError);
  } else {
    console.log('Message passing working:', response);
  }
});

// Monitor storage operations
chrome.storage.local.get(null, data => {
  console.log('Current storage:', data);
});
```

## Performance Considerations

### Memory Management
- **Batch Operations**: Process logs in batches to avoid memory spikes
- **Lazy Loading**: Load logs on-demand in the UI
- **Cleanup**: Regular cleanup of old sessions and temporary data

### Storage Optimization
- **Indexing**: Use appropriate IndexedDB indexes for query performance
- **Compression**: Consider compressing large log messages
- **Pagination**: Implement pagination for large datasets

### UI Performance
- **Virtual Scrolling**: For large log lists
- **Debounced Search**: Avoid excessive search operations
- **Background Processing**: Use web workers for heavy operations

```javascript
// Example: Batched log processing
class LogProcessor {
  constructor() {
    this.batchSize = 100;
    this.processingQueue = [];
    this.isProcessing = false;
  }
  
  async addLogs(logs) {
    this.processingQueue.push(...logs);
    if (!this.isProcessing) {
      await this.processBatch();
    }
  }
  
  async processBatch() {
    this.isProcessing = true;
    
    while (this.processingQueue.length > 0) {
      const batch = this.processingQueue.splice(0, this.batchSize);
      await this.storageManager.saveLogs(batch);
      
      // Yield control to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    this.isProcessing = false;
  }
}
```

## Security Implementation

### Data Isolation
- **Origin Separation**: Logs are tagged with origin and kept separate
- **Permission Validation**: Verify sender permissions for all messages
- **Sanitization**: Sanitize log data to prevent XSS

### Sensitive Data Detection
```javascript
class SensitiveDataDetector {
  constructor() {
    this.patterns = [
      /[A-Za-z0-9]{20,}/,  // API keys
      /password\s*[:=]\s*\S+/i,  // Passwords
      /token\s*[:=]\s*\S+/i,     // Tokens
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/  // Credit cards
    ];
  }
  
  containsSensitiveData(text) {
    return this.patterns.some(pattern => pattern.test(text));
  }
  
  filterSensitiveData(text) {
    let filtered = text;
    this.patterns.forEach(pattern => {
      filtered = filtered.replace(pattern, '[FILTERED]');
    });
    return filtered;
  }
}
```

### Content Security Policy
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

This developer documentation provides the technical foundation needed to understand, maintain, and extend the Console Log Extension. For additional questions or clarifications, please refer to the main README or create an issue in the project repository.

## Best Practices and Guardrails (Critical)

### Page Context Namespacing and Messaging
- Namespace page globals and events to avoid collisions with site scripts:
  - Use `window.__clm_extensionLogs` for page log buffer (replaces `_extensionLogs`).
  - Use `clm:consoleLogCaptured` as the CustomEvent name (replaces `consoleLogCaptured`).
  - Keep a temporary compatibility listener for old names when migrating.
- Do not add global `window.onerror`/`unhandledrejection` in the page context by default. If ever needed, gate behind a user-visible setting.
- Before calling `chrome.runtime.sendMessage`, verify context and API availability:
  - Ensure `chrome?.runtime?.id` exists and `typeof chrome.runtime.sendMessage === 'function'`.
  - Treat “Extension context invalidated” and “Receiving end does not exist” as non-fatal; fall back to an in-memory buffer.

### Logging Discipline
- Only echo warn/error back to the page console from overrides; suppress info/debug/trace echoes to reduce noise.
- In Options UI, avoid `console.log/info/debug/trace`; use `NotificationManager` for user feedback.
- Tag extension-generated logs with `source: 'extension'` (and `isExtension: true` when applicable).

### Default Hiding and Background Filtering
- Honor `hideExtensionLogs` (default true) in background `GET_LOGS`/`GET_LOGS_COUNT` to reduce payload and keep UI clean by default.
- Keep client-side defensive filtering in the Options UI for legacy entries.

### Noisy Vendor Error Suppression
- Background `shouldCaptureLog` ignores known vendor patterns like null sendMessage errors:
  - Combined regex: `/Cannot\s+read\s+(properties|property)\s+of\s+null/i` and `/\bsendMessage\b/i`.
  - Prevents unrelated third-party scripts from polluting the log view and exports by default.