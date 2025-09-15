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

  // Create a storage for logs (namespaced to avoid collisions)
  window.__clm_extensionLogs = window.__clm_extensionLogs || [];

  // Safely convert any console arg to a readable string without exposing page internals
  function safeArgToString(arg) {
    try {
      if (arg === null || arg === undefined) return String(arg);
      const t = typeof arg;
      if (t === 'string' || t === 'number' || t === 'boolean') return String(arg);
      // Errors: prefer stack or name: message
      if (arg instanceof Error) {
        return arg.stack || (arg.name ? `${arg.name}: ${arg.message}` : arg.message) || 'Error';
      }
      // Arrays: shallow stringify elements
      if (Array.isArray(arg)) {
        return `[${arg.map(safeArgToString).join(', ')}]`;
      }
      // DOM Nodes: show tag name to avoid dumping full HTML
      if (typeof Node !== 'undefined' && arg instanceof Node) {
        try { return `<${String(arg.nodeName).toLowerCase()}>`; } catch { return '<node>'; }
      }
      // If object has a custom toString that yields something useful
      if (typeof arg.toString === 'function' && arg.toString !== Object.prototype.toString) {
        const s = String(arg);
        if (s && s !== '[object Object]') return s;
      }
      // Try a safe JSON stringify with circular handling and function elision
      try {
        const seen = new WeakSet();
        const json = JSON.stringify(arg, (k, v) => {
          if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) return '[Circular]';
            seen.add(v);
          }
          if (typeof v === 'function') return '[Function]';
          return v;
        });
        if (json && json !== '{}' && json !== '[]') return json;
      } catch {}
      return '[Object]';
    } catch {
      return '[Object]';
    }
  }

  // Suppress noisy vendor errors like "Cannot read properties of null (reading 'sendMessage')"
  function isSuppressedNoise(msg) {
    try {
      const s = String(msg || '');
      return /Cannot\s+read\s+(properties|property)\s+of\s+null/i.test(s) && /\bsendMessage\b/i.test(s);
    } catch (_) { return false; }
  }

  // Override console methods in page context
  console.log = function(...args) {
    try {
      // Build a safe string message and avoid passing page args through to original console
      let safeMessage = '';
      try {
        safeMessage = args.map(safeArgToString).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }
      // Do not echo info-level logs to page console to prevent noise duplication
      
      const logEntry = {
        level: 'log',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window.__clm_extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('clm:consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors to avoid interfering with page scripts
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        if (typeof originalLog === 'function') {
          originalLog.call(console, '[Extension Error]', error.message);
        }
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
        safeMessage = args.map(safeArgToString).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }

      // Vendor noise suppression (page-side guard)
      if (isSuppressedNoise(safeMessage)) {
        return; // do not log or echo
      }

      // Call original error with safe message only, if still a function
      if (typeof originalError === 'function') {
        try { originalError.call(console, safeMessage); } catch (_) { /* noop */ }
      }
      
      const logEntry = {
        level: 'error',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window.__clm_extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('clm:consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        if (typeof originalError === 'function') {
          originalError.call(console, '[Extension Error]', error.message);
        }
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
        safeMessage = args.map(safeArgToString).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }

      // Vendor noise suppression (page-side guard)
      if (isSuppressedNoise(safeMessage)) {
        return;
      }

      // Call original warn with safe message only, if still a function
      if (typeof originalWarn === 'function') {
        try { originalWarn.call(console, safeMessage); } catch (_) { /* noop */ }
      }
      
      const logEntry = {
        level: 'warn',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window.__clm_extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('clm:consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        if (typeof originalWarn === 'function') {
          originalWarn.call(console, '[Extension Error]', error.message);
        }
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
        safeMessage = args.map(safeArgToString).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }
      // Do not echo info-level logs
      
      const logEntry = {
        level: 'info',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window.__clm_extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('clm:consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        if (typeof originalInfo === 'function') {
          originalInfo.call(console, '[Extension Error]', error.message);
        }
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
        safeMessage = args.map(safeArgToString).join(' ');
      } catch (e) {
        safeMessage = '[Error extracting message]';
      }
      // Do not echo debug-level logs
      
      const logEntry = {
        level: 'log',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window.__clm_extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('clm:consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        if (typeof originalDebug === 'function') {
          originalDebug.call(console, '[Extension Error]', error.message);
        }
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
      // Do not echo trace-level logs
      
      const logEntry = {
        level: 'log',
        message: safeMessage,
        timestamp: Date.now(),
        stack: new Error().stack,
        url: window.location.href
      };
      window.__clm_extensionLogs.push(logEntry);
      try {
        window.dispatchEvent(new CustomEvent('clm:consoleLogCaptured', { detail: logEntry }));
      } catch (e) {
        // Swallow any dispatch errors
      }
    } catch (error) {
      // Silently fail to avoid interfering with page functionality
      try {
        if (typeof originalTrace === 'function') {
          originalTrace.call(console, '[Extension Error]', error.message);
        }
      } catch (e) {
        // Last resort - do nothing
      }
    }
  };

  // Suppress startup info log to avoid extension-generated messages in page console

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
        window.__clm_extensionLogs.push(logEntry);
        window.dispatchEvent(new CustomEvent('clm:consoleLogCaptured', {
          detail: logEntry
        }));
      });
    }

    // Try to access Chrome DevTools console API if available
    if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.console) {
      // This would only work in DevTools extension context; don't log to page console
      // console.debug('[Console Extension] DevTools console API detected');
    }

    // Global page error capture disabled by default to avoid logging unrelated site errors.
    // If needed in the future, gate this behind a user setting.

  } catch (error) {
    // Swallow setup errors silently to avoid cluttering page console
  }

  // --- Additional capture: browser/network errors and unhandled rejections ---
  // Many DevTools "Failed to load resource", CORS blocks, and rejected fetch/XHR requests
  // do not come from console.* calls. Capture a concise, safe summary so they appear in the UI.
  try {
    function emitCaptured(level, message, extras) {
      // Vendor noise suppression (event-based captures)
      if (isSuppressedNoise(message)) return;
      const logEntry = {
        level,
        message,
        timestamp: Date.now(),
        stack: (extras && extras.stack) || undefined,
        url: window.location.href
      };
      try { window.__clm_extensionLogs.push(logEntry); } catch {}
      try { window.dispatchEvent(new CustomEvent('clm:consoleLogCaptured', { detail: logEntry })); } catch {}
    }

    // 1) Global error events (script/runtime and some resource errors)
    // Use capture:true to see resource element errors where available.
    window.addEventListener('error', function onWindowError(e) {
      try {
        // Avoid logging extension-originated messages
        const src = e && (e.filename || (e.target && e.target.src) || '');
        const isExtensionSrc = typeof src === 'string' && src.startsWith('chrome-extension://');
        if (isExtensionSrc) return;

        // Build a compact message
        let msg = '';
        if (e.error instanceof Error) {
          msg = e.error.stack || `${e.error.name || 'Error'}: ${e.error.message}`;
        } else if (e.message) {
          msg = String(e.message);
        } else if (e.target && (e.target.src || e.target.href)) {
          const tag = (e.target.tagName || 'resource').toLowerCase();
          const url = e.target.src || e.target.href;
          msg = `Resource error: <${tag}> ${url}`;
        } else if (src) {
          msg = `Script error at ${src}`;
        } else {
          msg = 'Unspecified window error';
        }

        emitCaptured('error', msg, { stack: (e.error && e.error.stack) || undefined });
      } catch {}
    }, true);

    // 2) Unhandled promise rejections
    window.addEventListener('unhandledrejection', function onUnhandledRejection(e) {
      try {
        const reason = e && e.reason;
        const msg = reason instanceof Error
          ? (reason.stack || `${reason.name || 'Error'}: ${reason.message}`)
          : `Unhandled promise rejection: ${safeArgToString(reason)}`;
        emitCaptured('error', msg, { stack: reason && reason.stack });
      } catch {}
    });

    // 3) Wrap fetch to capture network failures and non-OK responses
    if (typeof window.fetch === 'function') {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async function(...args) {
        const req = args[0];
        const reqUrl = (typeof req === 'string') ? req : (req && req.url) ? req.url : '';
        try {
          const res = await originalFetch(...args);
          if (res && !res.ok) {
            const level = res.status >= 500 ? 'error' : 'warn';
            emitCaptured(level, `Fetch ${res.status} ${res.statusText || ''} ${res.url || reqUrl}`.trim());
          }
          return res;
        } catch (err) {
          emitCaptured('error', `Fetch failed ${reqUrl ? `for ${reqUrl}` : ''}: ${safeArgToString(err)}`.trim());
          throw err;
        }
      };
    }

    // 4) Wrap XMLHttpRequest to capture failures and non-2xx/3xx statuses
    if (typeof XMLHttpRequest !== 'undefined') {
      const OriginalXHR = XMLHttpRequest;
      function WrappedXHR() {
        const xhr = new OriginalXHR();
        let method = 'GET';
        let url = '';
        const setHandlers = () => {
          xhr.addEventListener('load', () => {
            try {
              const status = xhr.status || 0;
              if (status >= 400) {
                const level = status >= 500 ? 'error' : 'warn';
                emitCaptured(level, `XHR ${status} ${xhr.statusText || ''} ${url}`.trim());
              }
            } catch {}
          });
          xhr.addEventListener('error', () => {
            try { emitCaptured('error', `XHR network error ${url}`); } catch {}
          });
          xhr.addEventListener('abort', () => {
            try { emitCaptured('warn', `XHR aborted ${url}`); } catch {}
          });
        };
        const originalOpen = xhr.open;
        xhr.open = function(m, u, ...rest) {
          try { method = String(m || 'GET'); url = String(u || ''); } catch {}
          return originalOpen.call(xhr, m, u, ...rest);
        };
        setHandlers();
        return xhr;
      }
      // Preserve prototype chain
      WrappedXHR.prototype = OriginalXHR.prototype;
      // Replace global XHR constructor
      window.XMLHttpRequest = WrappedXHR;
    }
  } catch {}

})();