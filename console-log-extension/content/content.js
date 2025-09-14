/**
 * Console Log Extension - Content Script
 * Captures console messages from web pages and forwards them to background script
 */

// Import LogEntry class (will be available in content script context)
// Note: In actual Chrome extension, this would be loaded via manifest.json

/**
 * Console Log Interceptor
 * Handles console method overriding and message capture
 */
class ConsoleInterceptor {
  constructor() {
    this.originalConsole = {};
    this.isEnabled = true;
    this.sessionId = this.generateSessionId();
    this.tabId = null; // Will be set when available
    
    // Error handling
    this.errorCount = 0;
    this.maxErrors = 10; // Stop intercepting after too many errors
    this.lastErrorTime = 0;
    this.errorCooldown = 5000; // 5 seconds between error reports
    
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
    this.retryDelay = 1000; // 1 second
    this.transmissionErrors = 0;
    this.maxTransmissionErrors = 5;
    
    // Store original console methods safely
    try {
      this.originalConsole.log = console.log.bind(console);
      this.originalConsole.error = console.error.bind(console);
      this.originalConsole.warn = console.warn.bind(console);
      this.originalConsole.info = console.info.bind(console);
      
      this.interceptConsole();
    } catch (error) {
      this.handleInterceptorError('Failed to initialize console interceptor', error);
    }
    
    // Set up global error handling for the content script
    this.setupGlobalErrorHandling();
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
   * Overrides native console methods to capture messages
   */
  interceptConsole() {
    const levels = ['log', 'error', 'warn', 'info'];
    
    levels.forEach(level => {
      console[level] = (...args) => {
        // Call original console method first
        this.originalConsole[level](...args);
        
        // Capture the log if enabled
        if (this.isEnabled) {
          this.captureLogMessage(level, args);
        }
      };
    });
  }

  /**
   * Captures and processes console log messages
   * @param {string} level - Log level (log, error, warn, info)
   * @param {Array} args - Console arguments
   */
  captureLogMessage(level, args) {
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
        sessionId: this.sessionId
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
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return '[Object]';
        }
      }
      return String(arg);
    }).join(' ');
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
          return JSON.parse(JSON.stringify(arg)); // Deep clone
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
        // Fallback for testing environment - store in temporary array
        if (!window.capturedLogs) {
          window.capturedLogs = [];
        }
        window.capturedLogs.push(logData);
      }
    } catch (error) {
      // Handle transmission error
      this.handleTransmissionError(error, logData);
      
      // Fallback for testing environment
      if (!window.capturedLogs) {
        window.capturedLogs = [];
      }
      window.capturedLogs.push(logData);
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
      console[level] = this.originalConsole[level];
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
      if (this.originalConsole.log) console.log = this.originalConsole.log;
      if (this.originalConsole.error) console.error = this.originalConsole.error;
      if (this.originalConsole.warn) console.warn = this.originalConsole.warn;
      if (this.originalConsole.info) console.info = this.originalConsole.info;
      
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
  
  // Debug: Log that the content script has loaded (but don't capture this log)
  const originalLog = console.log;
  originalLog('Console Log Extension: Content script loaded and interceptor initialized for:', window.location.href);
  
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
  
  originalLog('Console Log Extension content script loaded and console interception active for:', window.location.hostname);
  
} catch (initError) {
  // Fallback error logging if interceptor initialization fails completely
  console.error('Console Log Extension: Failed to initialize content script', initError);
}