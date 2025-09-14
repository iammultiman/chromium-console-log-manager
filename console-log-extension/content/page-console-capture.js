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
    originalLog.apply(console, args);
    const logEntry = {
      level: 'info',  // Changed from 'log' to 'info' to match Chrome's console levels
      args: args,
      timestamp: Date.now(),
      stack: new Error().stack,
      url: window.location.href
    };
    window._extensionLogs.push(logEntry);
    window.dispatchEvent(new CustomEvent('consoleLogCaptured', {
      detail: logEntry
    }));
  };

  console.error = function(...args) {
    originalError.apply(console, args);
    const logEntry = {
      level: 'error',
      args: args,
      timestamp: Date.now(),
      stack: new Error().stack,
      url: window.location.href
    };
    window._extensionLogs.push(logEntry);
    window.dispatchEvent(new CustomEvent('consoleLogCaptured', {
      detail: logEntry
    }));
  };

  console.warn = function(...args) {
    originalWarn.apply(console, args);
    const logEntry = {
      level: 'warn',
      args: args,
      timestamp: Date.now(),
      stack: new Error().stack,
      url: window.location.href
    };
    window._extensionLogs.push(logEntry);
    window.dispatchEvent(new CustomEvent('consoleLogCaptured', {
      detail: logEntry
    }));
  };

  console.info = function(...args) {
    originalInfo.apply(console, args);
    const logEntry = {
      level: 'info',
      args: args,
      timestamp: Date.now(),
      stack: new Error().stack,
      url: window.location.href
    };
    window._extensionLogs.push(logEntry);
    window.dispatchEvent(new CustomEvent('consoleLogCaptured', {
      detail: logEntry
    }));
  };

  console.debug = function(...args) {
    originalDebug.apply(console, args);
    const logEntry = {
      level: 'debug',
      args: args,
      timestamp: Date.now(),
      stack: new Error().stack,
      url: window.location.href
    };
    window._extensionLogs.push(logEntry);
    window.dispatchEvent(new CustomEvent('consoleLogCaptured', {
      detail: logEntry
    }));
  };

  console.trace = function(...args) {
    originalTrace.apply(console, args);
    const logEntry = {
      level: 'trace',
      args: args,
      timestamp: Date.now(),
      stack: new Error().stack,
      url: window.location.href
    };
    window._extensionLogs.push(logEntry);
    window.dispatchEvent(new CustomEvent('consoleLogCaptured', {
      detail: logEntry
    }));
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
      window.dispatchEvent(new CustomEvent('consoleLogCaptured', {
        detail: logEntry
      }));
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
      window.dispatchEvent(new CustomEvent('consoleLogCaptured', {
        detail: logEntry
      }));
    });

  } catch (error) {
    console.log('[Console Extension] Error setting up additional capture:', error.message);
  }

})();