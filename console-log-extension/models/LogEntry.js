/**
 * LogEntry class for representing console log messages
 * Handles message formatting, domain extraction, and session management
 */
class LogEntry {
  constructor(level, message, args, url, tabId) {
    this.id = this.generateUniqueId();
    this.timestamp = Date.now();
    this.level = level;
    this.message = this.formatMessage(message, args);
    this.args = args;
    this.url = url;
    this.domain = this.extractDomain(url);
    this.tabId = tabId;
    this.sessionId = this.generateSessionId(tabId, url);
  }

  /**
   * Formats console message and arguments into a readable string
   * @param {string} message - Primary message
   * @param {Array} args - Additional console arguments
   * @returns {string} Formatted message
   */
  formatMessage(message, args) {
    if (!args || args.length === 0) {
      return String(message);
    }

    // Handle different argument types
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return '[Object]';
        }
      }
      return String(arg);
    });

    // Combine message with formatted arguments
    const baseMessage = String(message);
    if (formattedArgs.length > 0) {
      return `${baseMessage} ${formattedArgs.join(' ')}`;
    }
    
    return baseMessage;
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
      // Fallback for invalid URLs
      return 'unknown';
    }
  }

  /**
   * Generates unique session ID based on tab and URL
   * @param {number} tabId - Chrome tab ID
   * @param {string} url - Page URL
   * @returns {string} Session ID
   */
  generateSessionId(tabId, url) {
    const domain = this.extractDomain(url);
    const sessionStart = Math.floor(Date.now() / (1000 * 60 * 30)); // 30-minute sessions
    return `${domain}_${tabId}_${sessionStart}`;
  }

  /**
   * Generates unique ID for log entry
   * @returns {string} Unique identifier
   */
  generateUniqueId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Converts LogEntry to JSON for storage
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      level: this.level,
      message: this.message,
      args: this.args,
      url: this.url,
      domain: this.domain,
      tabId: this.tabId,
      sessionId: this.sessionId
    };
  }

  /**
   * Creates LogEntry from stored JSON data
   * @param {Object} data - JSON data
   * @returns {LogEntry} LogEntry instance
   */
  static fromJSON(data) {
    const entry = Object.create(LogEntry.prototype);
    Object.assign(entry, data);
    return entry;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LogEntry;
} else if (typeof window !== 'undefined') {
  window.LogEntry = LogEntry;
} else if (typeof self !== 'undefined') {
  self.LogEntry = LogEntry;
}

