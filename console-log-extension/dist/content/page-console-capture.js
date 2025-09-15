/**
 * Page Console Capture Script
 * This script runs in the page context to capture console logs
 * Loaded as external file to avoid CSP violations
 */

(function() {
  'use strict';

  // Store reference to original console methods
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  const originalTrace = console.trace;

  // Create a storage for logs
  window._extensionLogs = window._extensionLogs || [];

  // Override console methods in page context
  console.log = function(...args) {
    try {
      // Build a safe string message and avoid passing page args through to original console
      let safeMessage = '';
      try {
        safeMessage = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
          return '[Object]';
        }).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }

      // Call original console with the safe string only
      originalLog.call(console, safeMessage);
      
      const logEntry = {
        level: 'info',  // Changed from 'log' to 'info' to match Chrome's console levels
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window._extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors to avoid interfering with page scripts
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        originalLog.call(console, '[Extension Error]', error.message);
      } catch (e) {
        // Last resort - do nothing
      }
    }
  };

  console.error = function(...args) {
    try {
      // Build a safe string and avoid passing original args through
      let safeMessage = '';
      try {
        safeMessage = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
          return '[Object]';
        }).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }

      // Call original error with safe message only
      originalError.call(console, safeMessage);
      
      const logEntry = {
        level: 'error',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window._extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        originalError.call(console, '[Extension Error]', error.message);
      } catch (e) {
        // Last resort - do nothing
      }
    }
  };

  console.warn = function(...args) {
    try {
      // Build a safe string and avoid passing original args through
      let safeMessage = '';
      try {
        safeMessage = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
          return '[Object]';
        }).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }

      // Call original warn with safe message only
      originalWarn.call(console, safeMessage);
      
      const logEntry = {
        level: 'warn',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window._extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        originalWarn.call(console, '[Extension Error]', error.message);
      } catch (e) {
        // Last resort - do nothing
      }
    }
  };

  console.info = function(...args) {
    try {
      // Build a safe string and avoid passing original args through
      let safeMessage = '';
      try {
        safeMessage = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
          return '[Object]';
        }).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }

      // Call original info with safe message only
      originalInfo.call(console, safeMessage);
      
      const logEntry = {
        level: 'info',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window._extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        originalInfo.call(console, '[Extension Error]', error.message);
      } catch (e) {
        // Last resort - do nothing
      }
    }
  };

  console.debug = function(...args) {
    try {
      // Build a safe string and avoid passing original args through
      let safeMessage = '';
      try {
        safeMessage = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
          return '[Object]';
        }).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }

      // Call original debug with safe message only
      originalDebug.call(console, safeMessage);
      
      const logEntry = {
        level: 'debug',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window._extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        originalDebug.call(console, '[Extension Error]', error.message);
      } catch (e) {
        // Last resort - do nothing
      }
    }
  };

  console.trace = function(...args) {
    try {
      // Build a safe string and avoid passing original args through
      let safeMessage = '';
      try {
        safeMessage = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
          return '[Object]';
        }).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }

      // Call original trace with safe message only
      originalTrace.call(console, safeMessage);
      
      const logEntry = {
        level: 'trace',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window._extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        originalTrace.call(console, '[Extension Error]', error.message);
      } catch (e) {
        // Last resort - do nothing
      }
    }
  };

  // Signal that the script has been loaded and console methods are overridden
  console.log('[Console Extension] Page console capture script loaded and active');

  // Try to capture any existing console logs that might be stored
  try {
    // Some browsers might store logs in console.history or similar
    if (window.console && window.console.history && Array.isArray(window.console.history)) {
      window.console.history.forEach(log => {
        const logEntry = {
          level: 'log',
          args: [log],
          timestamp: Date.now(),
          stack: null,
          url: window.location.href,
          source: 'existing'
        };
        window._extensionLogs.push(logEntry);
        window.dispatchEvent(new CustomEvent('consoleLogCaptured', {
          detail: logEntry
        }));
      });
    }

    // Try to access Chrome DevTools console API if available
    if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.console) {
      // This would only work in DevTools extension context
      console.log('[Console Extension] DevTools console API detected');
    }

    // Monitor for unhandled errors and promise rejections
    window.addEventListener('error', function(event) {
      const logEntry = {
        level: 'error',
        args: [event.message, event.filename + ':' + event.lineno + ':' + event.colno],
        timestamp: Date.now(),
        stack: event.error ? event.error.stack : null,
        url: window.location.href,
        source: 'error_event'
      };
      window._extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('consoleLogCaptured', { detail: logEntry }));
      } catch (e) {}
    });

    window.addEventListener('unhandledrejection', function(event) {
      const logEntry = {
        level: 'error',
        args: ['Unhandled promise rejection:', event.reason],
        timestamp: Date.now(),
        stack: event.reason && event.reason.stack ? event.reason.stack : null,
        url: window.location.href,
        source: 'promise_rejection'
      };
      window._extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('consoleLogCaptured', { detail: logEntry }));
      } catch (e) {}
    });

  } catch (error) {
    console.log('[Console Extension] Error setting up additional capture:', error.message);
  }

})();