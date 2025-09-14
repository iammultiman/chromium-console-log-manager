// SensitiveDataDetector will be available globally

/**
 * ExportManager - Handles exporting console logs in multiple formats
 * Supports JSON, CSV, and plain text exports with security warnings
 */
class ExportManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.sensitiveDataDetector = new SensitiveDataDetector();
  }

  /**
   * Export logs in JSON format with full metadata
   * @param {Object} filterCriteria - Filter criteria to apply
   * @returns {Promise<Object>} Export result with data and metadata
   */
  async exportToJSON(filterCriteria = {}) {
    try {
      const logs = await this._getFilteredLogs(filterCriteria);
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalEntries: logs.length,
          format: 'JSON',
          filters: filterCriteria,
          version: '1.0'
        },
        logs: logs.map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          timestampISO: new Date(log.timestamp).toISOString(),
          level: log.level,
          message: log.message,
          args: log.args,
          url: log.url,
          domain: log.domain,
          tabId: log.tabId,
          sessionId: log.sessionId,
          metadata: log.metadata || {}
        }))
      };

      const validation = this.sensitiveDataDetector.validateExport(logs, { format: 'json' });
      
      return {
        data: JSON.stringify(exportData, null, 2),
        filename: this._generateFilename('json', filterCriteria),
        mimeType: 'application/json',
        validation,
        sensitiveDataWarning: validation.scanResults // Backward compatibility
      };
    } catch (error) {
      throw new Error(`JSON export failed: ${error.message}`);
    }
  }

  /**
   * Export logs in CSV format for spreadsheet compatibility
   * @param {Object} filterCriteria - Filter criteria to apply
   * @returns {Promise<Object>} Export result with data and metadata
   */
  async exportToCSV(filterCriteria = {}) {
    try {
      const logs = await this._getFilteredLogs(filterCriteria);
      
      // CSV headers
      const headers = [
        'ID',
        'Timestamp',
        'Date/Time',
        'Level',
        'Message',
        'URL',
        'Domain',
        'Tab ID',
        'Session ID'
      ];

      // Convert logs to CSV rows
      const rows = logs.map(log => [
        log.id,
        log.timestamp,
        new Date(log.timestamp).toISOString(),
        log.level,
        this._escapeCsvValue(log.message),
        log.url,
        log.domain,
        log.tabId,
        log.sessionId
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

      const validation = this.sensitiveDataDetector.validateExport(logs, { format: 'csv' });

      return {
        data: csvContent,
        filename: this._generateFilename('csv', filterCriteria),
        mimeType: 'text/csv',
        validation,
        sensitiveDataWarning: validation.scanResults // Backward compatibility
      };
    } catch (error) {
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  /**
   * Export logs in plain text format for simple sharing
   * @param {Object} filterCriteria - Filter criteria to apply
   * @returns {Promise<Object>} Export result with data and metadata
   */
  async exportToText(filterCriteria = {}) {
    try {
      const logs = await this._getFilteredLogs(filterCriteria);
      
      const textContent = logs.map(log => {
        const timestamp = new Date(log.timestamp).toISOString();
        return `[${timestamp}] [${log.level.toUpperCase()}] [${log.domain}] ${log.message}`;
      }).join('\n');

      const headerLines = [
        'Console Log Export',
        `Generated: ${new Date().toISOString()}`,
        `Total Entries: ${logs.length}`
      ];

      if (filterCriteria.textSearch) {
        headerLines.push(`Search: "${filterCriteria.textSearch}"`);
      }
      if (filterCriteria.levels?.length) {
        headerLines.push(`Levels: ${filterCriteria.levels.join(', ')}`);
      }
      if (filterCriteria.domains?.length) {
        headerLines.push(`Domains: ${filterCriteria.domains.join(', ')}`);
      }

      const header = headerLines.join('\n') + '\n\n';

      const fullContent = header + textContent;
      const validation = this.sensitiveDataDetector.validateExport(logs, { format: 'text' });

      return {
        data: fullContent,
        filename: this._generateFilename('txt', filterCriteria),
        mimeType: 'text/plain',
        validation,
        sensitiveDataWarning: validation.scanResults // Backward compatibility
      };
    } catch (error) {
      throw new Error(`Text export failed: ${error.message}`);
    }
  }

  /**
   * Get filtered logs based on criteria
   * @private
   * @param {Object} filterCriteria - Filter criteria
   * @returns {Promise<Array>} Filtered log entries
   */
  async _getFilteredLogs(filterCriteria = {}) {
    const {
      textSearch = '',
      levels = [],
      domains = [],
      startTime = 0,
      endTime = Date.now(),
      limit = 10000,
      offset = 0
    } = filterCriteria;

    // Get logs from storage with basic filters
    const logs = await this.storageManager.queryLogs({
      levels,
      domains,
      startTime,
      endTime,
      limit,
      offset
    });

    // Apply text search if specified
    if (textSearch) {
      const searchLower = textSearch.toLowerCase();
      return logs.filter(log => 
        log.message.toLowerCase().includes(searchLower)
      );
    }

    return logs;
  }

  /**
   * Create a secure export preview with redacted sensitive data
   * @param {Object} filterCriteria - Filter criteria to apply
   * @param {number} maxEntries - Maximum number of entries to preview
   * @returns {Promise<Object>} Preview with redacted data and security summary
   */
  async createSecurePreview(filterCriteria = {}, maxEntries = 50) {
    try {
      const logs = await this._getFilteredLogs({ ...filterCriteria, limit: maxEntries });
      const scanResults = this.sensitiveDataDetector.scanLogs(logs);
      const redactedLogs = this.sensitiveDataDetector.createRedactedPreview(logs);
      const securitySummary = this.sensitiveDataDetector.generateSecuritySummary(scanResults);

      return {
        logs: redactedLogs,
        securitySummary,
        totalOriginalLogs: logs.length,
        hasRedactions: scanResults.hasSensitiveData
      };
    } catch (error) {
      throw new Error(`Failed to create secure preview: ${error.message}`);
    }
  }

  /**
   * Validate export request before processing
   * @param {Object} filterCriteria - Filter criteria to apply
   * @param {Object} exportOptions - Export options (format, etc.)
   * @returns {Promise<Object>} Validation result
   */
  async validateExportRequest(filterCriteria = {}, exportOptions = {}) {
    try {
      const logs = await this._getFilteredLogs(filterCriteria);
      return this.sensitiveDataDetector.validateExport(logs, exportOptions);
    } catch (error) {
      throw new Error(`Failed to validate export request: ${error.message}`);
    }
  }

  /**
   * Escape CSV values to handle commas, quotes, and newlines
   * @private
   * @param {string} value - Value to escape
   * @returns {string} Escaped CSV value
   */
  _escapeCsvValue(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }

    // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  /**
   * Generate filename for export based on format and filters
   * @private
   * @param {string} extension - File extension
   * @param {Object} filterCriteria - Filter criteria used
   * @returns {string} Generated filename
   */
  _generateFilename(extension, filterCriteria) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let filename = `console-logs-${timestamp}`;

    // Add filter information to filename
    if (filterCriteria.domains?.length === 1) {
      const domain = filterCriteria.domains[0].replace(/[^a-zA-Z0-9]/g, '-');
      filename += `-${domain}`;
    }

    if (filterCriteria.levels?.length && filterCriteria.levels.length < 4) {
      filename += `-${filterCriteria.levels.join('-')}`;
    }

    return `${filename}.${extension}`;
  }

  /**
   * Validate export parameters
   * @param {Object} filterCriteria - Filter criteria to validate
   * @returns {Object} Validation result
   */
  validateExportParameters(filterCriteria) {
    const errors = [];
    const warnings = [];

    // Check date range
    if (filterCriteria.startTime && filterCriteria.endTime) {
      if (filterCriteria.startTime >= filterCriteria.endTime) {
        errors.push('Start time must be before end time');
      }
    }

    // Check limit
    if (filterCriteria.limit && filterCriteria.limit > 50000) {
      warnings.push('Large exports may take a long time and consume significant memory');
    }

    // Check if any filters are applied
    const hasFilters = filterCriteria.textSearch || 
                      filterCriteria.levels?.length || 
                      filterCriteria.domains?.length ||
                      filterCriteria.startTime ||
                      filterCriteria.endTime;

    if (!hasFilters) {
      warnings.push('No filters applied - this will export all stored logs');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get export statistics for given filter criteria
   * @param {Object} filterCriteria - Filter criteria
   * @returns {Promise<Object>} Export statistics
   */
  async getExportStatistics(filterCriteria = {}) {
    try {
      const logs = await this._getFilteredLogs(filterCriteria);
      const scanResults = this.sensitiveDataDetector.scanLogs(logs);
      const securitySummary = this.sensitiveDataDetector.generateSecuritySummary(scanResults);

      // Calculate approximate sizes
      const sampleLog = logs[0];
      const avgLogSize = sampleLog ? JSON.stringify(sampleLog).length : 100;
      
      return {
        totalEntries: logs.length,
        estimatedSizes: {
          json: Math.round((logs.length * avgLogSize * 1.5) / 1024), // KB
          csv: Math.round((logs.length * avgLogSize * 0.8) / 1024), // KB  
          text: Math.round((logs.length * avgLogSize * 0.6) / 1024) // KB
        },
        dateRange: logs.length > 0 ? {
          earliest: new Date(Math.min(...logs.map(l => l.timestamp))).toISOString(),
          latest: new Date(Math.max(...logs.map(l => l.timestamp))).toISOString()
        } : null,
        levelDistribution: this._calculateLevelDistribution(logs),
        domainDistribution: this._calculateDomainDistribution(logs),
        securitySummary,
        sensitiveDataInfo: scanResults // Backward compatibility
      };
    } catch (error) {
      throw new Error(`Failed to get export statistics: ${error.message}`);
    }
  }

  /**
   * Calculate distribution of log levels
   * @private
   * @param {Array} logs - Log entries
   * @returns {Object} Level distribution
   */
  _calculateLevelDistribution(logs) {
    const distribution = {};
    logs.forEach(log => {
      distribution[log.level] = (distribution[log.level] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Calculate distribution of domains
   * @private
   * @param {Array} logs - Log entries
   * @returns {Object} Domain distribution
   */
  _calculateDomainDistribution(logs) {
    const distribution = {};
    logs.forEach(log => {
      distribution[log.domain] = (distribution[log.domain] || 0) + 1;
    });
    
    // Return top 10 domains
    return Object.entries(distribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [domain, count]) => {
        obj[domain] = count;
        return obj;
      }, {});
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportManager;
} else if (typeof window !== 'undefined') {
  window.ExportManager = ExportManager;
} else if (typeof self !== 'undefined') {
  self.ExportManager = ExportManager;
}

