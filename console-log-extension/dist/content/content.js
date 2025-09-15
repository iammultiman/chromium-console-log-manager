/**
 * Console Log Extension - Content Script
 * Captures console messages from web pages using DevTools Console API
 */

/**
 * Console Log Interceptor
 * Uses Chrome DevTools Console API to read existing logs and intercept new ones
 */
class ConsoleInterceptor {
  constructor() {
    this.originalConsole = {};
    this.isEnabled = false; // Start as disabled, check settings later
    this.sessionId = this.generateSessionId();
    this.tabId = null;
    this.capturedLogIds = new Set(); // Track already captured logs
    
    // Error handling
    this.errorCount = 0;
    this.maxErrors = 10;
    this.lastErrorTime = 0;
    this.errorCooldown = 5000;
    
    // Keyword filtering settings
    this.keywordFilters = {
      enabled: false,
      includeKeywords: [],
      excludeKeywords: [],
      caseSensitive: false
    };
    
    // Message transmission settings
    this.messageQueue = [];
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.transmissionErrors = 0;
    this.maxTransmissionErrors = 5;
    
    // Check if extension should be enabled before initializing
    this.checkIfEnabled();
  }

  /**
   * Checks if the extension should be enabled for this page
   */
  async checkIfEnabled() {
    try {
      // Check if we can communicate with background script
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // Ask background script if capture is enabled
        const response = await chrome.runtime.sendMessage({ type: 'GET_CAPTURE_STATUS' });
        this.isEnabled = response && response.enabled !== false;
      } else {
        // In testing environment, default to disabled
        this.isEnabled = false;
      }
      
      // Only initialize if enabled
      if (this.isEnabled) {
        this.initializeConsoleCapture();
      } else {
        // Clean up any existing listeners/data
        this.cleanup();
      }
      
      // Add cleanup on page unload
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    } catch (error) {
      // If we can't check status, assume disabled to be safe
      console.warn('[Console Extension] Could not check capture status, disabling:', error.message);
      this.isEnabled = false;
      this.cleanup();
    }
  }

  /**
   * Initializes console capture using multiple approaches
   */
  initializeConsoleCapture() {
    try {
      // console.log('[Console Extension] Initializing console capture...');
      
      // Store original console methods
      this.storeOriginalMethods();
      
      // Approach 1: Override console methods for future logs
      this.interceptConsoleMethods();
      
      // Approach 2: Try to access existing console logs
      this.captureExistingLogs();
      
      // Approach 3: Set up periodic log scanning
      this.startPeriodicLogScan();
      
      // console.log('[Console Extension] Console capture initialized');
    } catch (error) {
      console.error('[Console Extension] Failed to initialize:', error);
    }
  }

  /**
   * Stores original console methods safely
   */
  storeOriginalMethods() {
    this.originalConsole.log = console.log.bind(console);
    this.originalConsole.error = console.error.bind(console);
    this.originalConsole.warn = console.warn.bind(console);
    this.originalConsole.info = console.info.bind(console);
    this.originalConsole.debug = console.debug.bind(console);
    this.originalConsole.trace = console.trace.bind(console);
  }

  /**
   * Intercepts console methods (placeholder - actual interception done by injected script)
   */
  interceptConsoleMethods() {
    // Console method interception is handled by the injected page-console-capture.js script
    // This method is kept for API compatibility
  }

  /**
   * Captures existing console logs that are already in the browser
   */
  captureExistingLogs() {
    try {
      // Try multiple approaches to access existing logs
      
      // Approach 1: Check if console has a logs array (some browsers)
      if (console.logs && Array.isArray(console.logs)) {
        console.logs.forEach(log => this.processExistingLog(log));
      }
      
      // Approach 2: Check window.console for stored logs
      if (window.console && window.console._logs) {
        window.console._logs.forEach(log => this.processExistingLog(log));
      }
      
      // Approach 3: Use Chrome DevTools Console API if available
      this.tryDevToolsConsoleAPI();
      
    } catch (error) {
      console.error('[Console Extension] Could not access existing logs:', error.message);
    }
  }

  /**
   * Attempts to use Chrome DevTools Console API
   */
  tryDevToolsConsoleAPI() {
    try {
      // Check if we can access the DevTools Console API
      if (typeof chrome !== 'undefined' && chrome.devtools) {
        // This would only work in DevTools context, not content script
        console.warn('[Console Extension] DevTools API detected but not accessible from content script');
        return;
      }
      
      // Alternative: Try to inject a script into the page context
      this.injectPageScript();
      
    } catch (error) {
      console.error('[Console Extension] DevTools API approach failed:', error.message);
    }
  }

  /**
   * Injects a script into the page context to capture console logs
   * Uses external script file to avoid CSP violations
   */
  injectPageScript() {
    try {
      // Create script element that loads external file
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/page-console-capture.js');
      script.onload = () => {
        // console.log('[Console Extension] Page script loaded successfully');
      };
      script.onerror = (error) => {
        console.error('[Console Extension] Failed to load page script:', error);
      };
      
      // Listen for console events from the page
      window.addEventListener('consoleLogCaptured', (event) => {
        // console.log('[Console Extension] Received console event from page:', event.detail.level, event.detail.args ? event.detail.args[0] : 'no args');
        this.handlePageConsoleLog(event.detail);
      });
      
      (document.head || document.documentElement).appendChild(script);
      
      // Test our console capture by generating some test logs after script loads
      setTimeout(() => {
        // console.log('[Console Extension] Test log from content script');
        // console.error('[Console Extension] Test error from content script');
        // console.warn('[Console Extension] Test warning from content script');
      }, 3000);
      
    } catch (error) {
      console.error('[Console Extension] Failed to inject page script:', error);
    }
  }

  /**
   * Handles console logs captured from the page context
   */
  handlePageConsoleLog(logDetail) {
    try {
      const { level, args, message, timestamp, url, source } = logDetail;
      
      // console.log(`[Console Extension] Captured ${level} from page:`, args && args[0] ? args[0] : 'no args');
      
      // Create log data object
      const logData = {
        id: this.generateUniqueId(),
        timestamp: timestamp || Date.now(),
        level: level || 'info',  // Changed default from 'log' to 'info' for consistency
        message: message || this.formatMessage(args || []),
        args: this.serializeArgs(args || []),
        url: url || window.location.href,
        domain: this.extractDomain(url || window.location.href),
        tabId: this.tabId,
        sessionId: this.sessionId,
        source: source || 'page'
      };

      // Send to background script
      this.sendToBackground(logData).catch(error => {
        console.error('[Console Extension] Failed to send page log:', error);
      });
      
    } catch (error) {
      console.error('[Console Extension] Error handling page console log:', error);
    }
  }

  /**
   * Starts periodic scanning for new logs
   */
  startPeriodicLogScan() {
    // Reduced frequency significantly - only check every 30 seconds as fallback
    // Event listeners handle real-time capture, this is just a safety net
    setInterval(() => {
      this.scanForNewLogs();
    }, 30000); // Changed from 50ms to 30000ms (30 seconds)
    
    // Also check after initial load
    setTimeout(() => this.scanForNewLogs(), 5000);
  }

  /**
   * Scans for new logs in the page context
   */
  scanForNewLogs() {
    try {
      if (window._extensionLogs && Array.isArray(window._extensionLogs)) {
        const newLogs = window._extensionLogs.slice(this.capturedLogIds.size);
        if (newLogs.length > 0) {
          // console.log(`[Console Extension] Found ${newLogs.length} new logs to process`);
          newLogs.forEach((log, index) => {
            const logId = this.capturedLogIds.size + index;
            if (!this.capturedLogIds.has(logId)) {
              this.capturedLogIds.add(logId);
              this.handlePageConsoleLog(log);
            }
          });
        }
      }
      
      // Try alternative methods to capture console logs that might have been missed
      this.tryAlternativeLogCapture();
      
    } catch (error) {
      // Silently ignore scanning errors to avoid spam
    }
  }

  /**
   * Try alternative methods to capture console logs
   */
  tryAlternativeLogCapture() {
    try {
      // Try to access browser's performance entries for resource errors
      if (window.performance && window.performance.getEntries) {
        const entries = window.performance.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'resource' && entry.transferSize === 0 && entry.decodedBodySize === 0) {
            // This might indicate a failed resource load
            const logEntry = {
              level: 'error',
              args: [`Failed to load resource: ${entry.name}`],
              timestamp: Date.now(),
              stack: null,
              url: window.location.href,
              source: 'performance_api'
            };
            this.handlePageConsoleLog(logEntry);
          }
        });
      }
      
    } catch (error) {
      // Ignore errors in alternative capture methods
    }
  }

  /**
   * Generates session ID for current tab context
   * @returns {string} Session identifier
   */
  generateSessionId() {
    const domain = this.extractDomain(window.location.href);
    const sessionStart = Math.floor(Date.now() / (1000 * 60 * 30)); // 30-minute sessions
    const randomId = Math.random().toString(36).substr(2, 9);
    return `${domain}_${sessionStart}_${randomId}`;
  }

  /**
   * Extracts domain from URL
   * @param {string} url - Full URL
   * @returns {string} Domain name
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * Intercepts console methods in content script context (for extension logs)
   */
  interceptConsoleMethods() {
    const levels = ['log', 'error', 'warn', 'info'];
    
    levels.forEach(level => {
      try {
        const originalMethod = this.originalConsole[level];
        
        console[level] = (...args) => {
          // Call original console method
          originalMethod.apply(console, args);
          
          // Only capture extension-generated logs in content script context
          if (this.isEnabled && this.isExtensionLog(args)) {
            this.captureLogMessage(level, args, 'extension');
          }
        };
        
      } catch (error) {
        console.error(`[Console Extension] Failed to intercept console.${level}:`, error);
      }
    });
  }

  /**
   * Determines if a log message is from the extension
   */
  isExtensionLog(args) {
    if (!args || args.length === 0) return false;
    const firstArg = String(args[0]);
    return firstArg.includes('[Console Extension]') || 
           firstArg.includes('Content:') || 
           firstArg.includes('Background:');
  }

  /**
   * Captures and processes console log messages
   * @param {string} level - Log level (log, error, warn, info)
   * @param {Array} args - Console arguments
   * @param {string} source - Source of the log ('extension' or 'page')
   */
  captureLogMessage(level, args, source = 'page') {
    try {
      // Check if interceptor is still enabled and not in error state
      if (!this.isEnabled || this.errorCount >= this.maxErrors) {
        return;
      }
      
      const timestamp = Date.now();
      const url = window.location.href;
      const message = this.formatMessage(args);
      
      // Apply keyword filtering before processing
      if (!this.passesKeywordFilter(message)) {
        return; // Skip this log message
      }
      
      // Create log data object (similar to LogEntry structure)
      const logData = {
        id: this.generateUniqueId(),
        timestamp: timestamp,
        level: level,
        message: message,
        args: this.serializeArgs(args),
        url: url,
        domain: this.extractDomain(url),
        tabId: this.tabId, // Will be null until set by background script
        sessionId: this.sessionId,
        source: source
      };

      // Send to background script with error handling
      this.sendToBackground(logData).catch(error => {
        this.handleInterceptorError('Failed to send log message', error);
      });
      
    } catch (error) {
      // Handle capture error
      this.handleInterceptorError('Failed to capture log message', error);
    }
  }

  /**
   * Formats console arguments into a readable message
   * @param {Array} args - Console arguments
   * @returns {string} Formatted message
   */
  formatMessage(args) {
    if (!args || args.length === 0) {
      return '';
    }

    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return this.safeStringify(arg);
      }
      return String(arg);
    }).join(' ');
  }

  /**
   * Safely stringify objects, handling circular references
   * @param {*} obj - Object to stringify
   * @returns {string} Safe string representation
   */
  safeStringify(obj) {
    const seen = new WeakSet();
    
    try {
      return JSON.stringify(obj, (key, value) => {
        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        return value;
      }, 2);
    } catch (error) {
      // Fallback for objects that can't be stringified
      if (typeof obj === 'object' && obj !== null) {
        try {
          const simpleObj = {};
          for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'function') {
              simpleObj[k] = '[Function]';
            } else if (typeof v === 'object' && v !== null) {
              simpleObj[k] = '[Object]';
            } else {
              simpleObj[k] = v;
            }
          }
          return JSON.stringify(simpleObj, null, 2);
        } catch (fallbackError) {
          return `[Unable to stringify: ${error.message}]`;
        }
      }
      return String(obj);
    }
  }

  /**
   * Serializes console arguments for storage
   * @param {Array} args - Console arguments
   * @returns {Array} Serialized arguments
   */
  serializeArgs(args) {
    return args.map(arg => {
      if (typeof arg === 'function') {
        return '[Function]';
      } else if (typeof arg === 'object' && arg !== null) {
        try {
          // Use safe stringify for circular reference handling
          const seen = new WeakSet();
          const cloned = JSON.parse(JSON.stringify(arg, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular Reference]';
              }
              seen.add(value);
            }
            return value;
          }));
          return cloned;
        } catch (e) {
          return '[Object]';
        }
      }
      return arg;
    });
  }

  /**
   * Generates unique ID for log entry
   * @returns {string} Unique identifier
   */
  generateUniqueId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sends log data to background script
   * @param {Object} logData - Log data to send
   */
  async sendToBackground(logData) {
    try {
      // Send message to background script using Chrome extension API
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        await this.sendMessageWithRetry(logData, 0);
      } else {
        // Fallback for testing environment - store in temporary array with size limit
        this.storeInFallbackArray(logData);
      }
    } catch (error) {
      console.error(`Content: Failed to send ${logData.level} message to background:`, error);
      // Handle transmission error
      this.handleTransmissionError(error, logData);
      
      // Fallback for testing environment with size limit
      this.storeInFallbackArray(logData);
    }
  }

  /**
   * Cleans up resources when extension is disabled or page unloads
   */
  cleanup() {
    // Clear any stored logs
    if (window.capturedLogs) {
      window.capturedLogs.length = 0;
    }
    
    if (window._extensionLogs) {
      window._extensionLogs.length = 0;
    }
    
    // Clear captured log IDs
    this.capturedLogIds.clear();
    
    // Clear message queue
    this.messageQueue.length = 0;
    
    // Stop periodic scanning if it exists
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
  }

  /**
   * Sends message with retry mechanism
   * @param {Object} logData - Log data to send
   * @param {number} retryCount - Current retry attempt
   */
  async sendMessageWithRetry(logData, retryCount) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({
          type: 'LOG_CAPTURED',
          data: logData
        }, (response) => {
          if (chrome.runtime.lastError) {
            const error = new Error(chrome.runtime.lastError.message);
            
            // Check if we should retry
            if (retryCount < this.maxRetries) {
              // Retry after delay with exponential backoff
              setTimeout(async () => {
                try {
                  await this.sendMessageWithRetry(logData, retryCount + 1);
                  resolve();
                } catch (retryError) {
                  reject(retryError);
                }
              }, this.retryDelay * Math.pow(2, retryCount));
            } else {
              // Max retries reached
              reject(error);
            }
          } else {
            // Success
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Processes queued messages
   */
  processMessageQueue() {
    if (this.messageQueue.length > 0) {
      const queuedMessage = this.messageQueue.shift();
      this.sendMessageWithRetry(queuedMessage, 0);
    }
  }

  /**
   * Clears the message queue
   */
  clearMessageQueue() {
    this.messageQueue = [];
  }

  /**
   * Gets the current queue size
   * @returns {number} Number of queued messages
   */
  getQueueSize() {
    return this.messageQueue.length;
  }

  /**
   * Enables console log capture
   */
  enable() {
    this.isEnabled = true;
  }

  /**
   * Disables console log capture
   */
  disable() {
    this.isEnabled = false;
  }

  /**
   * Restores original console methods
   */
  restore() {
    const levels = ['log', 'error', 'warn', 'info'];
    levels.forEach(level => {
      try {
        // Delete the property to restore the original
        delete console[level];
      } catch (error) {
        // If delete fails, try to restore the original method
        try {
          console[level] = this.originalConsole[level];
        } catch (restoreError) {
          // Ignore restore errors
        }
      }
    });
  }

  /**
   * Sets the tab ID (called by background script)
   * @param {number} tabId - Chrome tab ID
   */
  setTabId(tabId) {
    this.tabId = tabId;
  }

  /**
   * Updates keyword filter settings
   * @param {Object} filters - Keyword filter configuration
   */
  updateKeywordFilters(filters) {
    this.keywordFilters = {
      enabled: filters.enabled || false,
      includeKeywords: filters.includeKeywords || [],
      excludeKeywords: filters.excludeKeywords || [],
      caseSensitive: filters.caseSensitive || false
    };
  }

  /**
   * Checks if a message passes keyword filtering
   * @param {string} message - Log message to check
   * @returns {boolean} True if message should be captured
   */
  passesKeywordFilter(message) {
    // If keyword filtering is disabled, allow all messages
    if (!this.keywordFilters.enabled) {
      return true;
    }

    const searchMessage = this.keywordFilters.caseSensitive ? message : message.toLowerCase();
    
    // Check exclusion keywords first (if any match, exclude the message)
    if (this.keywordFilters.excludeKeywords.length > 0) {
      for (const keyword of this.keywordFilters.excludeKeywords) {
        const searchKeyword = this.keywordFilters.caseSensitive ? keyword : keyword.toLowerCase();
        if (searchMessage.includes(searchKeyword)) {
          return false; // Message contains excluded keyword
        }
      }
    }

    // Check inclusion keywords (if any are specified, at least one must match)
    if (this.keywordFilters.includeKeywords.length > 0) {
      for (const keyword of this.keywordFilters.includeKeywords) {
        const searchKeyword = this.keywordFilters.caseSensitive ? keyword : keyword.toLowerCase();
        if (searchMessage.includes(searchKeyword)) {
          return true; // Message contains included keyword
        }
      }
      return false; // No inclusion keywords matched
    }

    // If no inclusion keywords specified but exclusion passed, allow message
    return true;
  }
  /**
   * Handle interceptor errors with graceful degradation
   * @param {string} context - Error context
   * @param {Error} error - The error that occurred
   */
  handleInterceptorError(context, error) {
    this.errorCount++;
    
    // Log error to original console (if available)
    if (this.originalConsole.error) {
      this.originalConsole.error(`Console Log Extension Error [${context}]:`, error);
    }
    
    // Report error to background script (with throttling)
    const now = Date.now();
    if (now - this.lastErrorTime > this.errorCooldown) {
      this.lastErrorTime = now;
      this.reportErrorToBackground(context, error);
    }
    
    // Disable interceptor if too many errors
    if (this.errorCount >= this.maxErrors) {
      this.originalConsole.error('Console Log Extension: Too many errors, disabling interceptor');
      this.disable();
    }
  }

  /**
   * Set up global error handling for the content script
   */
  setupGlobalErrorHandling() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleInterceptorError('Unhandled promise rejection', event.reason);
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.handleInterceptorError('Global error', event.error || event.message);
    });
  }

  /**
   * Report error to background script
   * @param {string} context - Error context
   * @param {Error} error - The error that occurred
   */
  reportErrorToBackground(context, error) {
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'CONTENT_SCRIPT_ERROR',
          data: {
            context,
            message: error.message,
            stack: error.stack,
            url: window.location.href,
            timestamp: Date.now(),
            sessionId: this.sessionId
          }
        }).catch(() => {
          // Ignore errors when reporting errors to avoid recursion
        });
      }
    } catch (reportError) {
      // Ignore errors when reporting errors to avoid recursion
    }
  }

  /**
   * Handle transmission errors with retry logic
   * @param {Error} error - Transmission error
   * @param {Object} messageData - Message that failed to send
   */
  handleTransmissionError(error, messageData) {
    this.transmissionErrors++;
    
    // Log transmission error
    if (this.originalConsole.warn) {
      this.originalConsole.warn('Console Log Extension: Message transmission failed', error);
    }
    
    // Add to retry queue if not too many errors
    if (this.transmissionErrors < this.maxTransmissionErrors && messageData) {
      this.messageQueue.push({
        ...messageData,
        retryCount: (messageData.retryCount || 0) + 1,
        lastAttempt: Date.now()
      });
      
      // Schedule retry
      setTimeout(() => this.processMessageQueue(), this.retryDelay);
    } else if (this.transmissionErrors >= this.maxTransmissionErrors) {
      this.originalConsole.error('Console Log Extension: Too many transmission errors, stopping message sending');
    }
  }

  /**
   * Process queued messages with retry logic
   */
  async processMessageQueue() {
    if (this.messageQueue.length === 0) {
      return;
    }
    
    const messagesToRetry = [];
    
    for (const messageData of this.messageQueue) {
      try {
        // Skip if too many retries
        if (messageData.retryCount >= this.maxRetries) {
          continue;
        }
        
        // Skip if too recent (rate limiting)
        if (Date.now() - messageData.lastAttempt < this.retryDelay) {
          messagesToRetry.push(messageData);
          continue;
        }
        
        // Attempt to send message
        await this.sendToBackground(messageData);
        
        // Success - reset transmission error count
        this.transmissionErrors = Math.max(0, this.transmissionErrors - 1);
        
      } catch (error) {
        // Failed - add back to retry queue
        messagesToRetry.push({
          ...messageData,
          retryCount: messageData.retryCount + 1,
          lastAttempt: Date.now()
        });
      }
    }
    
    // Update queue with messages that need retry
    this.messageQueue = messagesToRetry;
    
    // Schedule next retry if needed
    if (this.messageQueue.length > 0) {
      setTimeout(() => this.processMessageQueue(), this.retryDelay);
    }
  }

  /**
   * Safely disable the interceptor
   */
  disable() {
    try {
      this.isEnabled = false;
      
      // Restore original console methods
      this.restore();
    } catch (error) {
      // Even disabling failed - log to original console if possible
      if (this.originalConsole.error) {
        this.originalConsole.error('Console Log Extension: Failed to disable interceptor', error);
      }
    }
  }

  /**
   * Safely re-enable the interceptor
   */
  enable() {
    try {
      if (this.errorCount < this.maxErrors) {
        this.isEnabled = true;
        this.interceptConsole();
      }
    } catch (error) {
      this.handleInterceptorError('Failed to re-enable interceptor', error);
    }
  }

  /**
   * Reset error counters (for recovery)
   */
  resetErrorCounters() {
    this.errorCount = 0;
    this.transmissionErrors = 0;
    this.lastErrorTime = 0;
  }
}

// Make ConsoleInterceptor class available globally for testing
window.ConsoleInterceptor = ConsoleInterceptor;

// Initialize console interceptor with error handling
try {
  const consoleInterceptor = new ConsoleInterceptor();
  
  // Make interceptor available globally for testing and control
  window.consoleInterceptor = consoleInterceptor;
  
  // Suppress informational logs in production to avoid polluting page console
  // const originalLog = console.log;
  // originalLog('Console Log Extension: Content script loaded and interceptor initialized for:', window.location.href);
  
  // Listen for extension messages to control interceptor
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        if (message.type === 'TOGGLE_INTERCEPTOR') {
          if (message.data.enabled) {
            consoleInterceptor.enable();
          } else {
            consoleInterceptor.disable();
          }
          sendResponse({ success: true });
        } else if (message.type === 'RESET_INTERCEPTOR') {
          consoleInterceptor.resetErrorCounters();
          consoleInterceptor.enable();
          sendResponse({ success: true });
        }
      } catch (error) {
        consoleInterceptor.handleInterceptorError('Message handler error', error);
        sendResponse({ error: error.message });
      }
    });
  }
  
  // Global error handler for the content script
  window.addEventListener('error', (event) => {
    if (consoleInterceptor && event.error) {
      consoleInterceptor.handleInterceptorError('Global error', event.error);
    }
  });
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    if (consoleInterceptor && event.reason) {
      consoleInterceptor.handleInterceptorError('Unhandled promise rejection', event.reason);
    }
  });
  
  // originalLog('Console Log Extension content script loaded and console interception active for:', window.location.hostname);
  
} catch (initError) {
  // Fallback error logging if interceptor initialization fails completely
  console.error('Console Log Extension: Failed to initialize content script', initError);
}