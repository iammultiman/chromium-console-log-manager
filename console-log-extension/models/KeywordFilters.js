/**
 * KeywordFilters class for inclusion/exclusion keyword filtering
 * Handles keyword-based filtering with case sensitivity options
 */
class KeywordFilters {
  constructor() {
    this.include = [];
    this.exclude = [];
    this.caseSensitive = false;
  }

  /**
   * Sets inclusion keywords
   * @param {Array<string>} keywords - Keywords that must be present
   * @returns {KeywordFilters} This instance for chaining
   */
  setIncludeKeywords(keywords) {
    this.include = Array.isArray(keywords) ? keywords.filter(k => k && k.trim()) : [];
    return this;
  }

  /**
   * Sets exclusion keywords
   * @param {Array<string>} keywords - Keywords that must not be present
   * @returns {KeywordFilters} This instance for chaining
   */
  setExcludeKeywords(keywords) {
    this.exclude = Array.isArray(keywords) ? keywords.filter(k => k && k.trim()) : [];
    return this;
  }

  /**
   * Sets case sensitivity for keyword matching
   * @param {boolean} caseSensitive - Whether matching should be case sensitive
   * @returns {KeywordFilters} This instance for chaining
   */
  setCaseSensitive(caseSensitive) {
    this.caseSensitive = Boolean(caseSensitive);
    return this;
  }

  /**
   * Adds a keyword to the inclusion list
   * @param {string} keyword - Keyword to add
   * @returns {KeywordFilters} This instance for chaining
   */
  addIncludeKeyword(keyword) {
    if (keyword && keyword.trim() && !this.include.includes(keyword.trim())) {
      this.include.push(keyword.trim());
    }
    return this;
  }

  /**
   * Adds a keyword to the exclusion list
   * @param {string} keyword - Keyword to add
   * @returns {KeywordFilters} This instance for chaining
   */
  addExcludeKeyword(keyword) {
    if (keyword && keyword.trim() && !this.exclude.includes(keyword.trim())) {
      this.exclude.push(keyword.trim());
    }
    return this;
  }

  /**
   * Removes a keyword from the inclusion list
   * @param {string} keyword - Keyword to remove
   * @returns {KeywordFilters} This instance for chaining
   */
  removeIncludeKeyword(keyword) {
    const index = this.include.indexOf(keyword);
    if (index > -1) {
      this.include.splice(index, 1);
    }
    return this;
  }

  /**
   * Removes a keyword from the exclusion list
   * @param {string} keyword - Keyword to remove
   * @returns {KeywordFilters} This instance for chaining
   */
  removeExcludeKeyword(keyword) {
    const index = this.exclude.indexOf(keyword);
    if (index > -1) {
      this.exclude.splice(index, 1);
    }
    return this;
  }

  /**
   * Checks if a message should be captured based on keyword filters
   * @param {string} message - Message to test
   * @returns {boolean} True if message should be captured
   */
  shouldCapture(message) {
    if (!message) return this.include.length === 0;

    const testMessage = this.caseSensitive ? message : message.toLowerCase();

    // Apply inclusion filters first
    if (this.include.length > 0) {
      const hasIncludeMatch = this.include.some(keyword => {
        const testKeyword = this.caseSensitive ? keyword : keyword.toLowerCase();
        return testMessage.includes(testKeyword);
      });
      
      if (!hasIncludeMatch) {
        return false;
      }
    }

    // Apply exclusion filters
    if (this.exclude.length > 0) {
      const hasExcludeMatch = this.exclude.some(keyword => {
        const testKeyword = this.caseSensitive ? keyword : keyword.toLowerCase();
        return testMessage.includes(testKeyword);
      });
      
      if (hasExcludeMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if any filters are active
   * @returns {boolean} True if any filters are configured
   */
  hasActiveFilters() {
    return this.include.length > 0 || this.exclude.length > 0;
  }

  /**
   * Resets all keyword filters
   * @returns {KeywordFilters} This instance for chaining
   */
  reset() {
    this.include = [];
    this.exclude = [];
    this.caseSensitive = false;
    return this;
  }

  /**
   * Creates a copy of the keyword filters
   * @returns {KeywordFilters} New KeywordFilters instance
   */
  clone() {
    const clone = new KeywordFilters();
    clone.include = [...this.include];
    clone.exclude = [...this.exclude];
    clone.caseSensitive = this.caseSensitive;
    return clone;
  }

  /**
   * Converts KeywordFilters to JSON for storage
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      include: this.include,
      exclude: this.exclude,
      caseSensitive: this.caseSensitive
    };
  }

  /**
   * Creates KeywordFilters from JSON data
   * @param {Object} data - JSON data
   * @returns {KeywordFilters} KeywordFilters instance
   */
  static fromJSON(data) {
    const filters = new KeywordFilters();
    if (data) {
      filters.include = data.include || [];
      filters.exclude = data.exclude || [];
      filters.caseSensitive = Boolean(data.caseSensitive);
    }
    return filters;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KeywordFilters;
} else if (typeof window !== 'undefined') {
  window.KeywordFilters = KeywordFilters;
} else if (typeof self !== 'undefined') {
  self.KeywordFilters = KeywordFilters;
}

