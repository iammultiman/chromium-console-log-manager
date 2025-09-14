/**
 * FilterCriteria class for filtering console logs
 * Handles text search, level filtering, date ranges, and domain filtering
 */
class FilterCriteria {
  constructor() {
    this.textSearch = '';
    this.levels = ['log', 'error', 'warn', 'info'];
    this.dateRange = { start: null, end: null };
    this.domains = [];
    this.sessionIds = [];
  }

  /**
   * Sets text search criteria
   * @param {string} searchText - Text to search for in log messages
   * @returns {FilterCriteria} This instance for chaining
   */
  setTextSearch(searchText) {
    this.textSearch = searchText || '';
    return this;
  }

  /**
   * Sets log levels to include
   * @param {Array<string>} levels - Array of log levels ('log', 'error', 'warn', 'info')
   * @returns {FilterCriteria} This instance for chaining
   */
  setLevels(levels) {
    this.levels = Array.isArray(levels) ? levels : [];
    return this;
  }

  /**
   * Sets date range filter
   * @param {Date|number} start - Start date/timestamp
   * @param {Date|number} end - End date/timestamp
   * @returns {FilterCriteria} This instance for chaining
   */
  setDateRange(start, end) {
    this.dateRange = {
      start: start ? new Date(start).getTime() : null,
      end: end ? new Date(end).getTime() : null
    };
    return this;
  }

  /**
   * Sets domains to filter by
   * @param {Array<string>} domains - Array of domain names
   * @returns {FilterCriteria} This instance for chaining
   */
  setDomains(domains) {
    this.domains = Array.isArray(domains) ? domains : [];
    return this;
  }

  /**
   * Sets session IDs to filter by
   * @param {Array<string>} sessionIds - Array of session IDs
   * @returns {FilterCriteria} This instance for chaining
   */
  setSessionIds(sessionIds) {
    this.sessionIds = Array.isArray(sessionIds) ? sessionIds : [];
    return this;
  }

  /**
   * Checks if a log entry matches the filter criteria
   * @param {Object} logEntry - Log entry to test
   * @returns {boolean} True if entry matches all criteria
   */
  matches(logEntry) {
    // Check log level
    if (this.levels.length > 0 && !this.levels.includes(logEntry.level)) {
      return false;
    }

    // Check text search
    if (this.textSearch && !this.matchesTextSearch(logEntry.message)) {
      return false;
    }

    // Check date range
    if (!this.matchesDateRange(logEntry.timestamp)) {
      return false;
    }

    // Check domains
    if (this.domains.length > 0 && !this.domains.includes(logEntry.domain)) {
      return false;
    }

    // Check session IDs
    if (this.sessionIds.length > 0 && !this.sessionIds.includes(logEntry.sessionId)) {
      return false;
    }

    return true;
  }

  /**
   * Checks if message matches text search criteria
   * @param {string} message - Message to search
   * @returns {boolean} True if message contains search text
   */
  matchesTextSearch(message) {
    if (!this.textSearch) return true;
    
    const searchLower = this.textSearch.toLowerCase();
    const messageLower = (message || '').toLowerCase();
    
    return messageLower.includes(searchLower);
  }

  /**
   * Checks if timestamp falls within date range
   * @param {number} timestamp - Timestamp to check
   * @returns {boolean} True if timestamp is within range
   */
  matchesDateRange(timestamp) {
    if (this.dateRange.start && timestamp < this.dateRange.start) {
      return false;
    }
    
    if (this.dateRange.end && timestamp > this.dateRange.end) {
      return false;
    }
    
    return true;
  }

  /**
   * Resets all filter criteria to defaults
   * @returns {FilterCriteria} This instance for chaining
   */
  reset() {
    this.textSearch = '';
    this.levels = ['log', 'error', 'warn', 'info'];
    this.dateRange = { start: null, end: null };
    this.domains = [];
    this.sessionIds = [];
    return this;
  }

  /**
   * Creates a copy of the filter criteria
   * @returns {FilterCriteria} New FilterCriteria instance
   */
  clone() {
    const clone = new FilterCriteria();
    clone.textSearch = this.textSearch;
    clone.levels = [...this.levels];
    clone.dateRange = { ...this.dateRange };
    clone.domains = [...this.domains];
    clone.sessionIds = [...this.sessionIds];
    return clone;
  }

  /**
   * Converts FilterCriteria to JSON for storage
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      textSearch: this.textSearch,
      levels: this.levels,
      dateRange: this.dateRange,
      domains: this.domains,
      sessionIds: this.sessionIds
    };
  }

  /**
   * Creates FilterCriteria from JSON data
   * @param {Object} data - JSON data
   * @returns {FilterCriteria} FilterCriteria instance
   */
  static fromJSON(data) {
    const filter = new FilterCriteria();
    if (data) {
      filter.textSearch = data.textSearch || '';
      filter.levels = data.levels || ['log', 'error', 'warn', 'info'];
      filter.dateRange = data.dateRange || { start: null, end: null };
      filter.domains = data.domains || [];
      filter.sessionIds = data.sessionIds || [];
    }
    return filter;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FilterCriteria;
} else if (typeof window !== 'undefined') {
  window.FilterCriteria = FilterCriteria;
}

