/**
 * StorageManager - Handles IndexedDB operations for console log storage
 * Provides CRUD operations, database initialization, and schema management
 */
class StorageManager {
  constructor() {
    this.dbName = 'ConsoleLogExtensionDB';
    this.dbVersion = 1;
    this.db = null;
    this.storeName = 'logs';
    this.errorHandler = null;
  }

  /**
   * Set error handler for graceful error handling
   * @param {ErrorHandler} errorHandler - Error handler instance
   */
  setErrorHandler(errorHandler) {
    this.errorHandler = errorHandler;
  }

  /**
   * Initialize IndexedDB database with proper schema and indexes
   * @returns {Promise<IDBDatabase>} Database instance
   */
  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        const error = new Error(`Failed to open database: ${request.error}`);
        if (this.errorHandler) {
          this.errorHandler.handleStorageError(error, 'initializeDatabase');
        }
        reject(error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        
        // Set up database error handling
        this.db.onerror = (event) => {
          if (this.errorHandler) {
            this.errorHandler.handleStorageError(
              new Error(`Database error: ${event.target.error}`),
              'database_operation'
            );
          }
        };
        
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        try {
          const db = event.target.result;
          
          // Create logs object store if it doesn't exist
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
            
            // Create indexes for efficient querying
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('domain', 'domain', { unique: false });
            store.createIndex('level', 'level', { unique: false });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('domainTimestamp', ['domain', 'timestamp'], { unique: false });
            store.createIndex('levelTimestamp', ['level', 'timestamp'], { unique: false });
          }
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.handleStorageError(error, 'database_upgrade');
          }
          throw error;
        }
      };
    });
  }

  /**
   * Ensure database is initialized before operations
   * @returns {Promise<IDBDatabase>}
   */
  async ensureDatabase() {
    if (!this.db) {
      await this.initializeDatabase();
    }
    return this.db;
  }

  /**
   * Save a single log entry to the database
   * @param {Object} logEntry - Log entry object
   * @returns {Promise<string>} Log entry ID
   */
  async saveLog(logEntry) {
    try {
      const db = await this.ensureDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        transaction.onerror = () => {
          const error = new Error(`Transaction failed: ${transaction.error}`);
          if (this.errorHandler) {
            this.errorHandler.handleStorageError(error, 'saveLog');
          }
          reject(error);
        };
        
        const request = store.add(logEntry);
        
        request.onsuccess = () => {
          resolve(logEntry.id);
        };
        
        request.onerror = () => {
          const error = new Error(`Failed to save log entry: ${request.error}`);
          if (this.errorHandler) {
            this.errorHandler.handleStorageError(error, 'saveLog');
          }
          reject(error);
        };
      });
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handleStorageError(error, 'saveLog', null);
      }
      throw error;
    }
  }

  /**
   * Save multiple log entries in a batch operation
   * @param {Array} logEntries - Array of log entry objects
   * @returns {Promise<Array>} Array of saved log IDs
   */
  async saveLogs(logEntries) {
    try {
      const db = await this.ensureDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const savedIds = [];
        let completed = 0;
        
        if (logEntries.length === 0) {
          resolve([]);
          return;
        }
        
        transaction.onerror = () => {
          const error = new Error(`Batch transaction failed: ${transaction.error}`);
          if (this.errorHandler) {
            this.errorHandler.handleStorageError(error, 'saveLogs');
          }
          reject(error);
        };
        
        transaction.oncomplete = () => {
          resolve(savedIds);
        };
        
        logEntries.forEach((logEntry) => {
        const request = store.add(logEntry);
        
        request.onsuccess = () => {
          savedIds.push(logEntry.id);
          completed++;
          
          if (completed === logEntries.length) {
            resolve(savedIds);
          }
        };
        
        request.onerror = () => {
          const error = new Error(`Failed to save log entry ${logEntry.id}: ${request.error}`);
          if (this.errorHandler) {
            this.errorHandler.handleStorageError(error, 'saveLogs');
          }
          reject(error);
        };
      });
    });
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handleStorageError(error, 'saveLogs', []);
      }
      throw error;
    }
  }

  /**
*
   * Retrieve a single log entry by ID
   * @param {string} id - Log entry ID
   * @returns {Promise<Object|null>} Log entry or null if not found
   */
  async getLog(id) {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to retrieve log entry: ${request.error}`));
      };
    });
  }

  /**
   * Query logs with filtering and pagination
   * @param {Object} options - Query options
   * @param {Array} options.levels - Log levels to include
   * @param {Array} options.domains - Domains to include
   * @param {number} options.startTime - Start timestamp
   * @param {number} options.endTime - End timestamp
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Number of results to skip
   * @returns {Promise<Array>} Array of log entries
   */
  async queryLogs(options = {}) {
    const db = await this.ensureDatabase();
    const {
      levels = [],
      domains = [],
      sessionIds = [],
      startTime = 0,
      endTime = Date.now(),
      limit = 1000,
      offset = 0
    } = options;
    
    // Normalize and validate time range to avoid IDBKeyRange errors
    let start = Number.isFinite(Number(startTime)) ? Math.floor(Number(startTime)) : 0;
    let end = Number.isFinite(Number(endTime)) ? Math.floor(Number(endTime)) : Date.now();
    if (start < 0) start = 0;
    if (!Number.isFinite(end) || end <= 0) end = Date.now();
    if (end < start) {
      // Swap or widen to a minimal valid range
      const tmp = start; start = end; end = Math.max(tmp, start + 1);
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      const range = IDBKeyRange.bound(start, end);
      const request = index.openCursor(range);
      
      const results = [];
      let skipped = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }
        
        const logEntry = cursor.value;
        
        // Apply filters
        const levelMatch = levels.length === 0 || levels.includes(logEntry.level);
        const domainMatch = domains.length === 0 || domains.includes(logEntry.domain);
        const sessionMatch = sessionIds.length === 0 || sessionIds.includes(logEntry.sessionId);
        
        if (levelMatch && domainMatch && sessionMatch) {
          if (skipped < offset) {
            skipped++;
          } else {
            results.push(logEntry);
          }
        }
        
        cursor.continue();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to query logs: ${request.error}`));
      };
    });
  }

  /**
   * Get logs by domain with optional time range
   * @param {string} domain - Domain to filter by
   * @param {number} startTime - Start timestamp (optional)
   * @param {number} endTime - End timestamp (optional)
   * @returns {Promise<Array>} Array of log entries
   */
  async getLogsByDomain(domain, startTime = 0, endTime = Date.now()) {
    const db = await this.ensureDatabase();
    // Normalize and validate time range
    let start = Number.isFinite(Number(startTime)) ? Math.floor(Number(startTime)) : 0;
    let end = Number.isFinite(Number(endTime)) ? Math.floor(Number(endTime)) : Date.now();
    if (start < 0) start = 0;
    if (!Number.isFinite(end) || end <= 0) end = Date.now();
    if (end < start) { const tmp = start; start = end; end = Math.max(tmp, start + 1); }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('domainTimestamp');
      
      const range = IDBKeyRange.bound([domain, start], [domain, end]);
      const request = index.getAll(range);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get logs by domain: ${request.error}`));
      };
    });
  }

  /**
   * Get logs by session ID
   * @param {string} sessionId - Session ID to filter by
   * @returns {Promise<Array>} Array of log entries
   */
  async getLogsBySession(sessionId) {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('sessionId');
      
      const request = index.getAll(sessionId);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get logs by session: ${request.error}`));
      };
    });
  }  
/**
   * Update an existing log entry
   * @param {Object} logEntry - Updated log entry object
   * @returns {Promise<string>} Log entry ID
   */
  async updateLog(logEntry) {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.put(logEntry);
      
      request.onsuccess = () => {
        resolve(logEntry.id);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to update log entry: ${request.error}`));
      };
    });
  }

  /**
   * Delete a log entry by ID
   * @param {string} id - Log entry ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteLog(id) {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to delete log entry: ${request.error}`));
      };
    });
  }

  /**
   * Delete multiple log entries by IDs
   * @param {Array} ids - Array of log entry IDs
   * @returns {Promise<number>} Number of entries deleted
   */
  async deleteLogs(ids) {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      let deleted = 0;
      let completed = 0;
      
      if (ids.length === 0) {
        resolve(0);
        return;
      }
      
      ids.forEach((id) => {
        const request = store.delete(id);
        
        request.onsuccess = () => {
          deleted++;
          completed++;
          
          if (completed === ids.length) {
            resolve(deleted);
          }
        };
        
        request.onerror = () => {
          completed++;
          
          if (completed === ids.length) {
            resolve(deleted);
          }
        };
      });
    });
  }

  /**
   * Delete logs by domain
   * @param {string} domain - Domain to delete logs for
   * @returns {Promise<number>} Number of entries deleted
   */
  async deleteLogsByDomain(domain) {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('domain');
      
      const request = index.openCursor(domain);
      let deleted = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (!cursor) {
          resolve(deleted);
          return;
        }
        
        cursor.delete();
        deleted++;
        cursor.continue();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to delete logs by domain: ${request.error}`));
      };
    });
  }

  /**
   * Get total count of log entries
   * @returns {Promise<number>} Total number of log entries
   */
  async getLogCount() {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.count();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get log count: ${request.error}`));
      };
    });
  }

  /**
   * Clear all log entries from the database
   * @returns {Promise<boolean>} True if successful
   */
  async clearAllLogs() {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to clear all logs: ${request.error}`));
      };
    });
  }  /**

   * Calculate current storage usage in bytes
   * @returns {Promise<Object>} Storage usage information
   */
  async calculateStorageUsage() {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.openCursor();
      let totalSize = 0;
      let entryCount = 0;
      const domainSizes = {};
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (!cursor) {
          resolve({
            totalSizeBytes: totalSize,
            totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
            entryCount,
            domainSizes,
            averageEntrySize: entryCount > 0 ? Math.round(totalSize / entryCount) : 0
          });
          return;
        }
        
        const logEntry = cursor.value;
        const entrySize = this._calculateEntrySize(logEntry);
        
        totalSize += entrySize;
        entryCount++;
        
        if (!domainSizes[logEntry.domain]) {
          domainSizes[logEntry.domain] = { size: 0, count: 0 };
        }
        domainSizes[logEntry.domain].size += entrySize;
        domainSizes[logEntry.domain].count++;
        
        cursor.continue();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to calculate storage usage: ${request.error}`));
      };
    });
  }

  /**
   * Calculate approximate size of a log entry in bytes
   * @private
   * @param {Object} logEntry - Log entry object
   * @returns {number} Approximate size in bytes
   */
  _calculateEntrySize(logEntry) {
    // Rough estimation of object size in bytes
    const jsonString = JSON.stringify(logEntry);
    return new Blob([jsonString]).size;
  }

  /**
   * Clean up old logs based on age limit
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {Promise<number>} Number of entries deleted
   */
  async cleanupByAge(maxAgeMs) {
    const db = await this.ensureDatabase();
    const cutoffTime = Date.now() - maxAgeMs;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);
      
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (!cursor) {
          resolve(deletedCount);
          return;
        }
        
        cursor.delete();
        deletedCount++;
        cursor.continue();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to cleanup by age: ${request.error}`));
      };
    });
  }

  /**
   * Clean up logs to stay within size limit by removing oldest entries
   * @param {number} maxSizeBytes - Maximum storage size in bytes
   * @returns {Promise<number>} Number of entries deleted
   */
  async cleanupBySize(maxSizeBytes) {
    const usage = await this.calculateStorageUsage();
    
    if (usage.totalSizeBytes <= maxSizeBytes) {
      return 0; // No cleanup needed
    }
    
    const bytesToRemove = usage.totalSizeBytes - maxSizeBytes;
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      // Start from oldest entries
      const request = index.openCursor();
      
      let deletedCount = 0;
      let bytesRemoved = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (!cursor || bytesRemoved >= bytesToRemove) {
          resolve(deletedCount);
          return;
        }
        
        const logEntry = cursor.value;
        const entrySize = this._calculateEntrySize(logEntry);
        
        cursor.delete();
        deletedCount++;
        bytesRemoved += entrySize;
        
        cursor.continue();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to cleanup by size: ${request.error}`));
      };
    });
  }

  /**
   * Clean up logs to stay within entry count limit
   * @param {number} maxEntries - Maximum number of entries to keep
   * @returns {Promise<number>} Number of entries deleted
   */
  async cleanupByCount(maxEntries) {
    const totalCount = await this.getLogCount();
    
    if (totalCount <= maxEntries) {
      return 0; // No cleanup needed
    }
    
    const entriesToRemove = totalCount - maxEntries;
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      // Start from oldest entries
      const request = index.openCursor();
      
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (!cursor || deletedCount >= entriesToRemove) {
          resolve(deletedCount);
          return;
        }
        
        cursor.delete();
        deletedCount++;
        cursor.continue();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to cleanup by count: ${request.error}`));
      };
    });
  }

  /**
   * Perform comprehensive cleanup based on retention policies
   * @param {Object} retentionPolicy - Retention policy configuration
   * @param {number} retentionPolicy.maxAgeMs - Maximum age in milliseconds
   * @param {number} retentionPolicy.maxSizeBytes - Maximum size in bytes
   * @param {number} retentionPolicy.maxEntries - Maximum number of entries
   * @returns {Promise<Object>} Cleanup results
   */
  async performCleanup(retentionPolicy) {
    const {
      maxAgeMs = null,
      maxSizeBytes = null,
      maxEntries = null
    } = retentionPolicy;
    
    const results = {
      deletedByAge: 0,
      deletedBySize: 0,
      deletedByCount: 0,
      totalDeleted: 0,
      finalUsage: null
    };
    
    try {
      // Clean up by age first (oldest entries)
      if (maxAgeMs !== null) {
        results.deletedByAge = await this.cleanupByAge(maxAgeMs);
      }
      
      // Then clean up by size if still needed
      if (maxSizeBytes !== null) {
        results.deletedBySize = await this.cleanupBySize(maxSizeBytes);
      }
      
      // Finally clean up by count if still needed
      if (maxEntries !== null) {
        results.deletedByCount = await this.cleanupByCount(maxEntries);
      }
      
      results.totalDeleted = results.deletedByAge + results.deletedBySize + results.deletedByCount;
      results.finalUsage = await this.calculateStorageUsage();
      
      return results;
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get storage quota information from browser
   * @returns {Promise<Object>} Quota information
   */
  async getStorageQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          available: estimate.quota - estimate.usage,
          usagePercentage: Math.round((estimate.usage / estimate.quota) * 100)
        };
      } catch (error) {
        console.warn('Failed to get storage estimate:', error);
      }
    }
    
    // Fallback for browsers that don't support storage.estimate()
    return {
      quota: null,
      usage: null,
      available: null,
      usagePercentage: null
    };
  }

  /**
   * Check if storage is approaching quota limits
   * @param {number} warningThreshold - Warning threshold percentage (0-100)
   * @returns {Promise<Object>} Storage status information
   */
  async checkStorageStatus(warningThreshold = 80) {
    const quota = await this.getStorageQuota();
    const usage = await this.calculateStorageUsage();
    
    const status = {
      extensionUsage: usage,
      browserQuota: quota,
      needsCleanup: false,
      warningLevel: 'normal' // 'normal', 'warning', 'critical'
    };
    
    if (quota.usagePercentage !== null) {
      if (quota.usagePercentage >= 95) {
        status.warningLevel = 'critical';
        status.needsCleanup = true;
      } else if (quota.usagePercentage >= warningThreshold) {
        status.warningLevel = 'warning';
        status.needsCleanup = true;
      }
    }
    
    return status;
  }  
/**
   * Schedule automatic cleanup based on retention policies
   * This method would typically be called by a background script
   * @param {Object} retentionPolicy - Retention policy configuration
   * @returns {Promise<Object>} Cleanup results or null if no cleanup needed
   */
  async scheduleCleanup(retentionPolicy) {
    const status = await this.checkStorageStatus();
    
    // Perform cleanup if storage is getting full or based on policy
    if (status.needsCleanup || this._shouldPerformScheduledCleanup(retentionPolicy)) {
      return await this.performCleanup(retentionPolicy);
    }
    
    return null; // No cleanup performed
  }

  /**
   * Determine if scheduled cleanup should be performed
   * @private
   * @param {Object} retentionPolicy - Retention policy configuration
   * @returns {boolean} True if cleanup should be performed
   */
  _shouldPerformScheduledCleanup(retentionPolicy) {
    // This could be enhanced with more sophisticated logic
    // For now, we'll perform cleanup if any retention policy is set
    return retentionPolicy.maxAgeMs !== null || 
           retentionPolicy.maxSizeBytes !== null || 
           retentionPolicy.maxEntries !== null;
  }

  /**
   * Get cleanup recommendations based on current usage
   * @returns {Promise<Object>} Cleanup recommendations
   */
  async getCleanupRecommendations() {
    const usage = await this.calculateStorageUsage();
    const quota = await this.getStorageQuota();
    
    const recommendations = {
      shouldCleanup: false,
      reasons: [],
      suggestedActions: []
    };
    
    // Check if storage is getting full
    if (quota.usagePercentage && quota.usagePercentage > 70) {
      recommendations.shouldCleanup = true;
      recommendations.reasons.push(`Browser storage is ${quota.usagePercentage}% full`);
      recommendations.suggestedActions.push('Remove old log entries');
    }
    
    // Check if extension is using too much space
    if (usage.totalSizeMB > 50) {
      recommendations.shouldCleanup = true;
      recommendations.reasons.push(`Extension is using ${usage.totalSizeMB}MB of storage`);
      recommendations.suggestedActions.push('Set up automatic cleanup policies');
    }
    
    // Check if there are too many entries
    if (usage.entryCount > 10000) {
      recommendations.shouldCleanup = true;
      recommendations.reasons.push(`${usage.entryCount} log entries stored`);
      recommendations.suggestedActions.push('Reduce retention period');
    }
    
    // Suggest domain-specific cleanup if needed
    const largeDomains = Object.entries(usage.domainSizes)
      .filter(([_, data]) => data.count > 1000)
      .map(([domain, _]) => domain);
    
    if (largeDomains.length > 0) {
      recommendations.suggestedActions.push(`Consider cleaning up logs for: ${largeDomains.join(', ')}`);
    }
    
    return recommendations;
  }

  /**
   * Export logs in JSON format with full metadata
   * @param {Object} filterCriteria - Filter criteria to apply
   * @returns {Promise<string>} JSON string of exported logs
   */
  async exportLogsAsJSON(filterCriteria = {}) {
    const logs = await this.queryLogs(filterCriteria);
    
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

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export logs in CSV format for spreadsheet compatibility
   * @param {Object} filterCriteria - Filter criteria to apply
   * @returns {Promise<string>} CSV string of exported logs
   */
  async exportLogsAsCSV(filterCriteria = {}) {
    const logs = await this.queryLogs(filterCriteria);
    
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
    return [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
  }

  /**
   * Export logs in plain text format for simple sharing
   * @param {Object} filterCriteria - Filter criteria to apply
   * @returns {Promise<string>} Plain text string of exported logs
   */
  async exportLogsAsText(filterCriteria = {}) {
    const logs = await this.queryLogs(filterCriteria);
    
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

    return header + textContent;
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
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
} else if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
} else if (typeof self !== 'undefined') {
  self.StorageManager = StorageManager;
}

