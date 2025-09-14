/**
 * CleanupScheduler - Manages automatic cleanup operations for the storage system
 * Handles scheduling, policy enforcement, and background cleanup tasks
 */
class CleanupScheduler {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.isRunning = false;
    this.intervalId = null;
    this.defaultInterval = 60 * 60 * 1000; // 1 hour in milliseconds
  }

  /**
   * Start the cleanup scheduler with specified interval
   * @param {number} intervalMs - Cleanup check interval in milliseconds
   * @param {Object} retentionPolicy - Retention policy configuration
   */
  start(intervalMs = this.defaultInterval, retentionPolicy = {}) {
    if (this.isRunning) {
      console.warn('Cleanup scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.retentionPolicy = retentionPolicy;

    // Perform initial cleanup
    this._performScheduledCleanup();

    // Set up recurring cleanup
    this.intervalId = setInterval(() => {
      this._performScheduledCleanup();
    }, intervalMs);

    console.log(`Cleanup scheduler started with ${intervalMs}ms interval`);
  }

  /**
   * Stop the cleanup scheduler
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('Cleanup scheduler stopped');
  }

  /**
   * Update retention policy without restarting scheduler
   * @param {Object} retentionPolicy - New retention policy configuration
   */
  updateRetentionPolicy(retentionPolicy) {
    this.retentionPolicy = retentionPolicy;
    console.log('Retention policy updated:', retentionPolicy);
  }

  /**
   * Perform immediate cleanup based on current policy
   * @returns {Promise<Object>} Cleanup results
   */
  async performImmediateCleanup() {
    try {
      const results = await this.storageManager.performCleanup(this.retentionPolicy);
      console.log('Immediate cleanup completed:', results);
      return results;
    } catch (error) {
      console.error('Immediate cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get current scheduler status
   * @returns {Object} Scheduler status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      retentionPolicy: this.retentionPolicy,
      intervalMs: this.defaultInterval,
      nextCleanup: this.intervalId ? Date.now() + this.defaultInterval : null
    };
  }

  /**
   * Perform scheduled cleanup operation
   * @private
   */
  async _performScheduledCleanup() {
    try {
      console.log('Performing scheduled cleanup check...');
      
      const results = await this.storageManager.scheduleCleanup(this.retentionPolicy);
      
      if (results) {
        console.log('Scheduled cleanup completed:', results);
        
        // Notify about cleanup if significant amount was removed
        if (results.totalDeleted > 0) {
          this._notifyCleanupCompleted(results);
        }
      } else {
        console.log('No cleanup needed at this time');
      }
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
      // Don't throw error to prevent scheduler from stopping
    }
  }

  /**
   * Notify about completed cleanup operation
   * @private
   * @param {Object} results - Cleanup results
   */
  _notifyCleanupCompleted(results) {
    // This could be enhanced to send notifications to the UI
    // or trigger Chrome notifications if needed
    console.log(`Cleanup completed: ${results.totalDeleted} entries removed, ` +
                `${results.finalUsage.totalSizeMB}MB remaining`);
  }

  /**
   * Create default retention policy based on common use cases
   * @param {string} profile - Policy profile ('conservative', 'balanced', 'aggressive')
   * @returns {Object} Retention policy configuration
   */
  static createRetentionPolicy(profile = 'balanced') {
    const policies = {
      conservative: {
        maxAgeMs: 90 * 24 * 60 * 60 * 1000, // 90 days
        maxSizeBytes: 200 * 1024 * 1024,     // 200MB
        maxEntries: 50000
      },
      balanced: {
        maxAgeMs: 30 * 24 * 60 * 60 * 1000,  // 30 days
        maxSizeBytes: 100 * 1024 * 1024,     // 100MB
        maxEntries: 25000
      },
      aggressive: {
        maxAgeMs: 7 * 24 * 60 * 60 * 1000,   // 7 days
        maxSizeBytes: 50 * 1024 * 1024,      // 50MB
        maxEntries: 10000
      }
    };

    return policies[profile] || policies.balanced;
  }

  /**
   * Validate retention policy configuration
   * @param {Object} policy - Retention policy to validate
   * @returns {Object} Validation result with errors if any
   */
  static validateRetentionPolicy(policy) {
    const errors = [];
    const warnings = [];

    if (policy.maxAgeMs !== null && policy.maxAgeMs !== undefined) {
      if (typeof policy.maxAgeMs !== 'number' || policy.maxAgeMs <= 0) {
        errors.push('maxAgeMs must be a positive number');
      } else if (policy.maxAgeMs < 24 * 60 * 60 * 1000) {
        warnings.push('maxAgeMs is less than 24 hours, which may cause frequent cleanup');
      }
    }

    if (policy.maxSizeBytes !== null && policy.maxSizeBytes !== undefined) {
      if (typeof policy.maxSizeBytes !== 'number' || policy.maxSizeBytes <= 0) {
        errors.push('maxSizeBytes must be a positive number');
      } else if (policy.maxSizeBytes < 10 * 1024 * 1024) {
        warnings.push('maxSizeBytes is less than 10MB, which may cause frequent cleanup');
      }
    }

    if (policy.maxEntries !== null && policy.maxEntries !== undefined) {
      if (typeof policy.maxEntries !== 'number' || policy.maxEntries <= 0) {
        errors.push('maxEntries must be a positive number');
      } else if (policy.maxEntries < 1000) {
        warnings.push('maxEntries is less than 1000, which may cause frequent cleanup');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CleanupScheduler;
} else if (typeof window !== 'undefined') {
  window.CleanupScheduler = CleanupScheduler;
}


