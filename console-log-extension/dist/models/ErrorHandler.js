/**
 * ErrorHandler - Comprehensive error handling for the extension
 * Provides centralized error logging, user notifications, and graceful degradation
 */
class ErrorHandler {
  constructor(notificationManager) {
    this.notificationManager = notificationManager;
    this.errorLog = [];
    this.maxErrorLogSize = 100;
    this.debugMode = true; // Enable debug mode by default for troubleshooting
    this.globalScope = typeof window !== 'undefined' ? window : self;
    
    // Initialize error handling
    this.initializeGlobalErrorHandling();
  }

  /**
   * Initialize global error handling
   */
  initializeGlobalErrorHandling() {
    // Handle unhandled promise rejections
    this.globalScope.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        type: 'unhandled_promise_rejection',
        context: 'global'
      });
    });

    // Handle global errors
    this.globalScope.addEventListener('error', (event) => {
      this.handleError(event.error || event.message, {
        type: 'global_error',
        context: 'global',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
  }

  /**
   * Handle an error with appropriate logging and user notification
   * @param {Error|string} error - The error to handle
   * @param {Object} [context] - Additional context information
   * @param {boolean} [showToUser] - Whether to show notification to user
   * @returns {string} Error ID for tracking
   */
  handleError(error, context = {}, showToUser = true) {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();
    
    // Normalize error object
    const normalizedError = this.normalizeError(error);
    
    // Create error entry
    const errorEntry = {
      id: errorId,
      timestamp,
      message: normalizedError.message,
      stack: normalizedError.stack,
      type: context.type || 'unknown',
      context: context,
      severity: this.determineSeverity(normalizedError, context)
    };

    // Log error internally
    this.logError(errorEntry);

    // Show user notification if appropriate
    if (showToUser && this.shouldShowToUser(errorEntry)) {
      this.showErrorNotification(errorEntry);
    }

    // Log to console in debug mode
    if (this.debugMode) {
      // Stringify the details to avoid "[object Object]" in environments that stringify console args
      const details = {
        id: errorEntry.id,
        message: errorEntry.message,
        type: errorEntry.type,
        context: errorEntry.context,
        severity: errorEntry.severity,
        stack: errorEntry.stack
      };
      console.error('Extension Error Details:', this.safeStringify(details));
    }

    return errorId;
  }

  /**
   * Handle storage-related errors with graceful degradation
   * @param {Error} error - Storage error
   * @param {string} operation - The operation that failed
   * @param {*} fallbackValue - Fallback value to return
   * @returns {*} Fallback value or null
   */
  handleStorageError(error, operation, fallbackValue = null) {
    const errorId = this.handleError(error, {
      type: 'storage_error',
      operation,
      context: 'storage'
    }, false); // Don't show to user immediately

    // Determine if this is a quota exceeded error
    if (this.isQuotaExceededError(error)) {
      this.handleQuotaExceeded();
    } else if (this.isCorruptionError(error)) {
      this.handleStorageCorruption();
    } else {
      // Generic storage error
      if (this.notificationManager) {
        this.notificationManager.warning(
          `Storage operation "${operation}" failed. Some features may not work properly.`,
          {
            title: 'Storage Issue',
            actions: [
              {
                text: 'Retry',
                primary: true,
                handler: () => {
                  // Emit retry event that calling code can listen for
                  this.globalScope.dispatchEvent(new CustomEvent('storage-retry', {
                    detail: { operation, errorId }
                  }));
                }
              }
            ]
          }
        );
      }
    }

    return fallbackValue;
  }

  /**
   * Handle quota exceeded errors
   */
  handleQuotaExceeded() {
    if (this.notificationManager) {
      this.notificationManager.warning(
        'Storage quota exceeded. Old logs will be automatically cleaned up.',
        {
          title: 'Storage Full',
          actions: [
            {
              text: 'Clean Now',
              primary: true,
              handler: () => {
                this.globalScope.dispatchEvent(new CustomEvent('force-cleanup'));
              }
            },
            {
              text: 'Settings',
              handler: () => {
                this.globalScope.dispatchEvent(new CustomEvent('open-storage-settings'));
              }
            }
          ]
        }
      );
    }
  }

  /**
   * Handle storage corruption errors
   */
  handleStorageCorruption() {
    if (this.notificationManager) {
      this.notificationManager.error(
        'Storage corruption detected. Extension data may need to be reset.',
        {
          title: 'Data Corruption',
          duration: 0, // Persistent
          actions: [
            {
              text: 'Reset Data',
              primary: true,
              handler: () => {
                this.notificationManager.confirm({
                  message: 'This will delete all stored logs and settings. Continue?',
                  title: 'Reset Extension Data',
                  onConfirm: () => {
                    this.globalScope.dispatchEvent(new CustomEvent('reset-extension-data'));
                  }
                });
              }
            }
          ]
        }
      );
    }
  }

  /**
   * Handle network-related errors
   * @param {Error} error - Network error
   * @param {string} operation - The operation that failed
   */
  handleNetworkError(error, operation) {
    this.handleError(error, {
      type: 'network_error',
      operation,
      context: 'network'
    });

    if (this.notificationManager) {
      this.notificationManager.warning(
        `Network operation "${operation}" failed. Please check your connection.`,
        {
          title: 'Network Error',
          actions: [
            {
              text: 'Retry',
              primary: true,
              handler: () => {
                this.globalScope.dispatchEvent(new CustomEvent('network-retry', {
                  detail: { operation }
                }));
              }
            }
          ]
        }
      );
    }
  }

  /**
   * Handle Chrome extension API errors
   * @param {Error} error - Chrome API error
   * @param {string} api - The API that failed
   */
  handleChromeApiError(error, api) {
    this.handleError(error, {
      type: 'chrome_api_error',
      api,
      context: 'chrome_extension'
    });

    // Check for common Chrome API issues
    if (this.notificationManager) {
      if (error.message.includes('Extension context invalidated')) {
        this.notificationManager.error(
          'Extension needs to be reloaded. Please refresh the page or restart the browser.',
          {
            title: 'Extension Error',
            duration: 0
          }
        );
      } else if (error.message.includes('permissions')) {
        this.notificationManager.error(
          'Missing required permissions. Please check extension settings.',
          {
            title: 'Permission Error'
          }
        );
      } else {
        this.notificationManager.error(
          `Chrome API "${api}" failed. Some features may not work properly.`,
          {
            title: 'Extension API Error'
          }
        );
      }
    }
  }

  /**
   * Wrap async operations with error handling
   * @param {Function} operation - Async operation to wrap
   * @param {Object} [context] - Error context
   * @param {*} [fallbackValue] - Value to return on error
   * @returns {Promise} Wrapped operation
   */
  async wrapAsync(operation, context = {}, fallbackValue = null) {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, context);
      return fallbackValue;
    }
  }

  /**
   * Wrap sync operations with error handling
   * @param {Function} operation - Sync operation to wrap
   * @param {Object} [context] - Error context
   * @param {*} [fallbackValue] - Value to return on error
   * @returns {*} Operation result or fallback value
   */
  wrapSync(operation, context = {}, fallbackValue = null) {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, context);
      return fallbackValue;
    }
  }

  /**
   * Normalize error to consistent format
   * @param {Error|string|*} error - Error to normalize
   * @returns {Object} Normalized error
   */
  normalizeError(error) {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    } else if (typeof error === 'string') {
      return {
        message: error,
        stack: null,
        name: 'StringError'
      };
    } else {
      return {
        message: String(error),
        stack: null,
        name: 'UnknownError'
      };
    }
  }

  /**
   * Determine error severity
   * @param {Object} error - Normalized error
   * @param {Object} context - Error context
   * @returns {string} Severity level
   */
  determineSeverity(error, context) {
    // Critical errors that break core functionality
    if (context.type === 'storage_corruption' || 
        context.type === 'chrome_api_error' ||
        error.message.includes('Extension context invalidated')) {
      return 'critical';
    }

    // High severity errors that impact user experience
    if (context.type === 'storage_error' ||
        context.type === 'network_error' ||
        error.message.includes('quota')) {
      return 'high';
    }

    // Medium severity for recoverable errors
    if (context.type === 'validation_error' ||
        context.type === 'parsing_error') {
      return 'medium';
    }

    // Low severity for minor issues
    return 'low';
  }

  /**
   * Check if error should be shown to user
   * @param {Object} errorEntry - Error entry
   * @returns {boolean} Whether to show to user
   */
  shouldShowToUser(errorEntry) {
    // Always show critical and high severity errors
    if (errorEntry.severity === 'critical' || errorEntry.severity === 'high') {
      return true;
    }

    // Show medium severity errors occasionally
    if (errorEntry.severity === 'medium') {
      return Math.random() < 0.5; // 50% chance
    }

    // Don't show low severity errors to avoid noise
    return false;
  }

  /**
   * Show error notification to user
   * @param {Object} errorEntry - Error entry
   */
  showErrorNotification(errorEntry) {
    // Skip notifications if no notification manager (e.g., in service worker)
    if (!this.notificationManager) {
      return;
    }
    
    const message = this.getUserFriendlyMessage(errorEntry);
    
    if (errorEntry.severity === 'critical') {
      this.notificationManager.error(message, {
        title: 'Critical Error',
        duration: 0, // Persistent
        actions: [
          {
            text: 'Report Issue',
            handler: () => this.openIssueReporter(errorEntry)
          }
        ]
      });
    } else if (errorEntry.severity === 'high') {
      this.notificationManager.error(message, {
        title: 'Error',
        duration: 8000
      });
    } else {
      this.notificationManager.warning(message, {
        title: 'Warning'
      });
    }
  }

  /**
   * Get user-friendly error message
   * @param {Object} errorEntry - Error entry
   * @returns {string} User-friendly message
   */
  getUserFriendlyMessage(errorEntry) {
    const context = errorEntry.context;
    
    switch (context.type) {
      case 'storage_error':
        return 'Unable to save or load data. Please check available storage space.';
      case 'network_error':
        return 'Network connection failed. Please check your internet connection.';
      case 'chrome_api_error':
        return 'Extension API error occurred. Try refreshing the page.';
      case 'validation_error':
        return 'Invalid data detected. Please check your input.';
      case 'parsing_error':
        return 'Unable to process data format. The data may be corrupted.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Log error internally
   * @param {Object} errorEntry - Error entry
   */
  logError(errorEntry) {
    this.errorLog.push(errorEntry);
    
    // Maintain log size limit
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.shift();
    }

    // Store in extension storage for debugging
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({
        'extension_error_log': this.errorLog.slice(-20) // Keep last 20 errors
      }).catch(() => {
        // Ignore storage errors when logging errors to avoid recursion
      });
    }
  }

  /**
   * Check if error is quota exceeded
   * @param {Error} error - Error to check
   * @returns {boolean} Whether it's a quota error
   */
  isQuotaExceededError(error) {
    return error.name === 'QuotaExceededError' ||
           error.message.includes('quota') ||
           error.message.includes('storage');
  }

  /**
   * Check if error indicates storage corruption
   * @param {Error} error - Error to check
   * @returns {boolean} Whether it's a corruption error
   */
  isCorruptionError(error) {
    return error.message.includes('corrupt') ||
           error.message.includes('invalid') ||
           error.name === 'DataError';
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
   * Generate unique error ID
   * @returns {string} Error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Open issue reporter (placeholder for future implementation)
   * @param {Object} errorEntry - Error entry
   */
  openIssueReporter(errorEntry) {
    // This could open a form or external issue tracker
  console.warn('Issue reporter would open with:', {
      id: errorEntry.id,
      message: errorEntry.message,
      type: errorEntry.type,
      severity: errorEntry.severity
    });
    
    if (this.notificationManager) {
      this.notificationManager.info(
        'Error details have been logged. Please contact support if the issue persists.',
        { title: 'Issue Reported' }
      );
    }
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      bySeverity: {},
      byType: {},
      recent: this.errorLog.slice(-10)
    };

    this.errorLog.forEach(error => {
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove('extension_error_log');
    }
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
} else if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
} else if (typeof self !== 'undefined') {
  self.ErrorHandler = ErrorHandler;
}
