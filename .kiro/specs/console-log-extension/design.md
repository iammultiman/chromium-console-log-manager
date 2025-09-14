# Design Document

## Overview

The Console Log Extension is a Chrome extension that provides comprehensive console log management for developers. The extension captures console messages from web pages, organizes them by website and session, provides advanced search and filtering capabilities, and offers multiple export formats. The design follows Chrome extension best practices with a focus on security, performance, and user experience.

## Architecture

The extension follows a multi-component architecture leveraging Chrome Extension APIs:

### Core Components

1. **Content Script** - Injected into web pages to capture console logs
2. **Background Script** - Manages data storage, filtering, and cross-tab coordination  
3. **Popup Interface** - Quick access interface for recent logs and basic controls
4. **Options Page** - Full-featured interface for log management and configuration
5. **Storage Manager** - Handles persistent data storage and cleanup policies

### Data Flow

```
Web Page Console → Content Script → Background Script → Storage Manager → IndexedDB
                                        ↓
User Interface ← Background Script ← Storage Manager ← IndexedDB
```

## Components and Interfaces

### Content Script (`content.js`)

**Purpose:** Captures console messages from web pages and forwards them to the background script.

**Key Functions:**
- `interceptConsole()` - Overrides native console methods to capture messages
- `captureLogMessage(level, args, timestamp)` - Processes and formats log data
- `sendToBackground(logData)` - Sends captured logs to background script
- `applyKeywordFilters(message, filters)` - Applies inclusion/exclusion keyword filtering

**Interface:**
```javascript
// Message format sent to background script
{
  id: string,           // Unique log ID
  timestamp: number,    // Unix timestamp
  level: string,        // 'log', 'error', 'warn', 'info'
  message: string,      // Formatted log message
  args: any[],         // Original console arguments
  url: string,         // Page URL
  tabId: number,       // Chrome tab ID
  sessionId: string    // Session identifier
}
```

### Background Script (`background.js`)

**Purpose:** Central coordinator for log processing, storage, and cross-component communication.

**Key Functions:**
- `processLogMessage(logData)` - Validates and processes incoming logs
- `manageStorage()` - Handles storage limits and cleanup policies
- `handleTabEvents()` - Manages session creation and tab lifecycle
- `applyGlobalFilters(logData)` - Applies user-configured filters
- `generateSessionId(tabId, url)` - Creates unique session identifiers

**Storage Schema:**
```javascript
// Logs stored in IndexedDB
{
  id: string,
  timestamp: number,
  level: string,
  message: string,
  args: any[],
  url: string,
  domain: string,      // Extracted from URL
  tabId: number,
  sessionId: string,
  metadata: {
    userAgent: string,
    viewport: object
  }
}

// Settings stored in chrome.storage.sync
{
  captureEnabled: boolean,
  logLevels: string[],
  retentionDays: number,
  maxStorageSize: number,
  keywordFilters: {
    include: string[],
    exclude: string[],
    caseSensitive: boolean
  },
  sensitiveDataFiltering: boolean,
  websiteSettings: {
    [domain]: {
      enabled: boolean,
      customFilters: object
    }
  }
}
```

### Storage Manager (`storage.js`)

**Purpose:** Manages persistent storage operations and data lifecycle.

**Key Functions:**
- `saveLogs(logArray)` - Batch saves logs to IndexedDB
- `queryLogs(filters)` - Retrieves logs with filtering and pagination
- `cleanupOldLogs()` - Removes logs based on retention policies
- `exportLogs(format, filters)` - Exports filtered logs in specified format
- `calculateStorageUsage()` - Monitors storage consumption

**IndexedDB Schema:**
```javascript
// Object Store: 'logs'
{
  keyPath: 'id',
  indexes: [
    { name: 'timestamp', keyPath: 'timestamp' },
    { name: 'domain', keyPath: 'domain' },
    { name: 'level', keyPath: 'level' },
    { name: 'sessionId', keyPath: 'sessionId' }
  ]
}
```

### User Interface Components

#### Popup Interface (`popup.html`, `popup.js`)
- Recent log summary (last 10 logs)
- Quick enable/disable toggle
- Link to full options page
- Current session status

#### Options Page (`options.html`, `options.js`)
- Full log browser with search and filtering
- Settings configuration panel
- Export functionality
- Storage management tools

## Data Models

### Log Entry Model
```javascript
class LogEntry {
  constructor(level, message, args, url, tabId) {
    this.id = generateUniqueId();
    this.timestamp = Date.now();
    this.level = level;
    this.message = this.formatMessage(message, args);
    this.args = args;
    this.url = url;
    this.domain = this.extractDomain(url);
    this.tabId = tabId;
    this.sessionId = this.generateSessionId();
  }
  
  formatMessage(message, args) { /* Implementation */ }
  extractDomain(url) { /* Implementation */ }
  generateSessionId() { /* Implementation */ }
}
```

### Filter Model
```javascript
class FilterCriteria {
  constructor() {
    this.textSearch = '';
    this.levels = ['log', 'error', 'warn', 'info'];
    this.dateRange = { start: null, end: null };
    this.domains = [];
    this.sessionIds = [];
  }
  
  matches(logEntry) { /* Implementation */ }
}
```

### Settings Model
```javascript
class ExtensionSettings {
  constructor() {
    this.captureEnabled = true;
    this.logLevels = ['log', 'error', 'warn', 'info'];
    this.retentionDays = 30;
    this.maxStorageSize = 100; // MB
    this.keywordFilters = new KeywordFilters();
    this.sensitiveDataFiltering = true;
    this.websiteSettings = new Map();
  }
  
  save() { /* Save to chrome.storage.sync */ }
  load() { /* Load from chrome.storage.sync */ }
}
```

## Error Handling

### Content Script Error Handling
- Graceful fallback if console override fails
- Error reporting to background script without breaking page functionality
- Automatic retry mechanism for failed message transmission

### Background Script Error Handling
- Storage quota exceeded handling with user notification
- IndexedDB transaction failure recovery
- Cross-tab communication error handling

### Storage Error Handling
- Database corruption recovery procedures
- Automatic backup and restore mechanisms
- Storage migration for extension updates

## Testing Strategy

### Unit Testing
- **Content Script Tests:** Console interception, message formatting, keyword filtering
- **Background Script Tests:** Log processing, storage management, session handling
- **Storage Manager Tests:** CRUD operations, cleanup policies, export functionality
- **UI Component Tests:** User interactions, data display, settings management

### Integration Testing
- **End-to-End Log Flow:** From console message to storage and retrieval
- **Cross-Component Communication:** Message passing between content, background, and UI
- **Storage Integration:** IndexedDB operations with Chrome storage APIs
- **Extension Lifecycle:** Installation, updates, and uninstallation scenarios

### Performance Testing
- **Memory Usage:** Monitor extension memory footprint with large log volumes
- **Storage Performance:** Test IndexedDB operations with thousands of log entries
- **UI Responsiveness:** Ensure smooth user experience with large datasets
- **Background Script Efficiency:** Minimize CPU usage during log processing

### Security Testing
- **Data Isolation:** Verify logs from different websites remain separate
- **Sensitive Data Detection:** Test filtering of common sensitive patterns
- **Permission Validation:** Ensure minimal required permissions are used
- **Export Security:** Validate exported data doesn't expose unintended information

### Browser Compatibility Testing
- **Chrome Versions:** Test across different Chrome versions (latest and LTS)
- **Extension API Changes:** Validate compatibility with Manifest V3 requirements
- **Cross-Platform:** Test on Windows, macOS, and Linux Chrome installations