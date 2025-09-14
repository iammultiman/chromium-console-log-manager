/**
 * Popup Script for Console Log Extension
 * Handles popup UI interactions, loads recent logs, and manages extension state
 */

class PopupManager {
  constructor() {
    this.elements = {};
    this.isLoading = false;
    this.refreshInterval = null;
    
    // Simple error handling for popup context
    this.errorHandler = {
      handleError: (error, context) => {
        console.error('Popup error:', error, context);
      },
      wrapAsync: async (fn, context) => {
        try {
          return await fn();
        } catch (error) {
          console.error('Popup async error:', error, context);
          return null;
        }
      },
      wrapSync: (fn, context) => {
        try {
          return fn();
        } catch (error) {
          console.error('Popup sync error:', error, context);
          return null;
        }
      }
    };
  }

  /**
   * Initialize popup functionality
   */
  async initialize() {
    this.bindElements();
    this.attachEventListeners();
    await this.loadInitialData();
    this.startAutoRefresh();
  }

  /**
   * Bind DOM elements to class properties
   */
  bindElements() {
    this.elements = {
      enableToggle: document.getElementById('enable-toggle'),
      statusText: document.getElementById('status-text'),
      openOptionsBtn: document.getElementById('open-options'),
      clearTodayBtn: document.getElementById('clear-today'),
      recentLogsList: document.getElementById('recent-logs-list'),
      todayCount: document.getElementById('today-count'),
      sessionCount: document.getElementById('session-count')
    };
  }

  /**
   * Attach event listeners to UI elements
   */
  attachEventListeners() {
    // Enable/disable toggle
    this.elements.enableToggle.addEventListener('change', (e) => {
      this.errorHandler.wrapSync(
        () => this.handleToggleChange(e.target.checked),
        { type: 'ui_interaction', context: 'toggle_change' }
      );
    });

    // Open options page
    this.elements.openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });

    // Clear today's logs
    this.elements.clearTodayBtn.addEventListener('click', () => {
      this.handleClearToday();
    });

    // Listen for background script messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
    });
  }

  /**
   * Load initial data when popup opens
   */
  async loadInitialData() {
    try {
      this.isLoading = true;
      
      // Load extension settings
      await this.errorHandler.wrapAsync(
        () => this.loadExtensionSettings(),
        { type: 'settings_load', context: 'popup_init' }
      );
      
      // Load recent logs
      await this.errorHandler.wrapAsync(
        () => this.loadRecentLogs(),
        { type: 'logs_load', context: 'popup_init' }
      );
      
      // Load statistics
      await this.errorHandler.wrapAsync(
        () => this.loadStatistics(),
        { type: 'statistics_load', context: 'popup_init' }
      );
      
    } catch (error) {
      this.errorHandler.handleError(error, {
        type: 'popup_initialization',
        context: 'popup'
      });
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load extension settings and update UI
   */
  async loadExtensionSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS'
      });

      if (response && response.settings) {
        const settings = response.settings;
        this.updateToggleState(settings.captureEnabled);
      } else {
        throw new Error(response?.error || 'Failed to load settings');
      }
    } catch (error) {
      this.errorHandler.handleChromeApiError(error, 'runtime.sendMessage');
      // Default to enabled state if settings can't be loaded
      this.updateToggleState(true);
    }
  }

  /**
   * Load recent logs (last 10) and display them
   */
  async loadRecentLogs() {
    try {
      console.log('Popup: Requesting recent logs...');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECENT_LOGS',
        data: { limit: 10 }
      });

      console.log('Popup: Received response', response);
      
      if (response && response.logs) {
        console.log('Popup: Displaying', response.logs.length, 'logs');
        this.displayRecentLogs(response.logs);
      } else {
        throw new Error(response?.error || 'Failed to load recent logs');
      }
    } catch (error) {
      console.error('Popup: Error loading logs', error);
      this.errorHandler.handleError(error, {
        type: 'logs_load_error',
        context: 'popup'
      }, false); // Don't show to user, just log
      this.showEmptyLogsMessage();
    }
  }

  /**
   * Load statistics (today's count, active sessions)
   */
  async loadStatistics() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATISTICS'
      });

      if (response && response.statistics) {
        const stats = response.statistics;
        this.updateStatistics(stats.todayCount, stats.sessionCount);
      } else {
        throw new Error(response?.error || 'Failed to load statistics');
      }
    } catch (error) {
      this.errorHandler.handleError(error, {
        type: 'statistics_load_error',
        context: 'popup'
      }, false); // Don't show to user, just log
      this.updateStatistics(0, 0);
    }
  }

  /**
   * Handle enable/disable toggle change
   */
  async handleToggleChange(enabled) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        data: { captureEnabled: enabled }
      });

      if (response && !response.error) {
        this.updateToggleState(enabled);
        this.notificationManager.success(
          `Console logging ${enabled ? 'enabled' : 'disabled'}`,
          { duration: 2000 }
        );
      } else {
        // Revert toggle if update failed
        this.elements.enableToggle.checked = !enabled;
        throw new Error(response?.error || 'Failed to update settings');
      }
    } catch (error) {
      this.errorHandler.handleError(error, {
        type: 'settings_update_error',
        context: 'popup'
      });
      // Revert toggle state
      this.elements.enableToggle.checked = !enabled;
    }
  }

  /**
   * Handle clear today's logs
   */
  async handleClearToday() {
    // Use notification system for confirmation
    this.notificationManager.confirm({
      message: 'Are you sure you want to clear today\'s logs? This action cannot be undone.',
      title: 'Clear Today\'s Logs',
      onConfirm: async () => {
        await this.performClearToday();
      }
    });
  }

  /**
   * Perform the actual clear today operation
   */
  async performClearToday() {
    const loadingId = this.notificationManager.loading('Clearing today\'s logs...');
    
    try {
      this.elements.clearTodayBtn.disabled = true;
      this.elements.clearTodayBtn.textContent = 'Clearing...';

      const response = await chrome.runtime.sendMessage({
        type: 'CLEAR_TODAY_LOGS'
      });

      if (response && !response.error) {
        // Hide loading notification
        this.notificationManager.hide(loadingId);
        
        // Refresh the popup data
        await this.loadRecentLogs();
        await this.loadStatistics();
        
        this.notificationManager.success('Today\'s logs cleared successfully');
      } else {
        throw new Error(response?.error || 'Failed to clear logs');
      }
    } catch (error) {
      this.notificationManager.hide(loadingId);
      this.errorHandler.handleError(error, {
        type: 'clear_logs_error',
        context: 'popup'
      });
    } finally {
      this.elements.clearTodayBtn.disabled = false;
      this.elements.clearTodayBtn.textContent = 'Clear Today';
    }
  }

  /**
   * Handle messages from background script
   */
  handleBackgroundMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'logAdded':
        this.handleNewLog(message.data);
        break;
      case 'settingsUpdated':
        this.handleSettingsUpdate(message.data);
        break;
      case 'statisticsUpdated':
        this.handleStatisticsUpdate(message.data);
        break;
    }
  }

  /**
   * Handle new log entry
   */
  handleNewLog(logData) {
    // Refresh recent logs if popup is visible
    if (!document.hidden) {
      this.loadRecentLogs();
      this.loadStatistics();
    }
  }

  /**
   * Handle settings update from background
   */
  handleSettingsUpdate(settings) {
    this.updateToggleState(settings.captureEnabled);
  }

  /**
   * Handle statistics update from background
   */
  handleStatisticsUpdate(stats) {
    this.updateStatistics(stats.todayCount, stats.sessionCount);
  }

  /**
   * Update toggle state and status text
   */
  updateToggleState(enabled) {
    this.elements.enableToggle.checked = enabled;
    this.elements.statusText.textContent = enabled ? 'Enabled' : 'Disabled';
  }

  /**
   * Display recent logs in the UI
   */
  displayRecentLogs(logs) {
    if (!logs || logs.length === 0) {
      this.showEmptyLogsMessage();
      return;
    }

    const logsHtml = logs.map(log => this.createLogItemHtml(log)).join('');
    this.elements.recentLogsList.innerHTML = logsHtml;
  }

  /**
   * Create HTML for a single log item
   */
  createLogItemHtml(log) {
    const timeAgo = this.formatTimeAgo(log.timestamp);
    const levelClass = `log-${log.level.toLowerCase()}`;
    const truncatedMessage = this.truncateMessage(log.message, 50);

    return `
      <div class="log-item">
        <span class="log-level ${levelClass}">${log.level.toUpperCase()}</span>
        <span class="log-message" title="${this.escapeHtml(log.message)}">${this.escapeHtml(truncatedMessage)}</span>
        <span class="log-time">${timeAgo}</span>
      </div>
    `;
  }

  /**
   * Show empty logs message
   */
  showEmptyLogsMessage() {
    this.elements.recentLogsList.innerHTML = `
      <div class="log-item" style="justify-content: center; color: #9ca3af; font-style: italic;">
        No recent logs found
      </div>
    `;
  }

  /**
   * Update statistics display
   */
  updateStatistics(todayCount, sessionCount) {
    this.elements.todayCount.textContent = todayCount.toLocaleString();
    this.elements.sessionCount.textContent = sessionCount.toLocaleString();
  }

  /**
   * Start auto-refresh for real-time updates
   */
  startAutoRefresh() {
    // Refresh every 5 seconds when popup is visible
    this.refreshInterval = setInterval(() => {
      if (!document.hidden && !this.isLoading) {
        this.loadStatistics();
      }
    }, 5000);

    // Stop refresh when popup is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      } else if (!document.hidden && !this.refreshInterval) {
        this.startAutoRefresh();
      }
    });
  }

  /**
   * Format timestamp as "time ago" string
   */
  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  /**
   * Truncate message to specified length
   */
  truncateMessage(message, maxLength) {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show error message to user
   */
  showError(message) {
    this.notificationManager.error(message);
  }

  /**
   * Show success message to user
   */
  showSuccess(message) {
    this.notificationManager.success(message);
  }

  /**
   * Cleanup when popup is closed
   */
  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup: DOM loaded, initializing popup manager');
  const popupManager = new PopupManager();
  await popupManager.initialize();
  console.log('Popup: Initialization complete');

  // Cleanup on window unload
  window.addEventListener('beforeunload', () => {
    popupManager.cleanup();
  });
});