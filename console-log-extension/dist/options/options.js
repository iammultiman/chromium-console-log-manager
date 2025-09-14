/**
 * Options page script for Console Log Extension
 * Handles log browsing, search, filtering, settings management, and export functionality
 */

// Import models (these would be loaded via script tags in the HTML)
// For now, we'll assume they're available globally

class OptionsPageManager {
  constructor() {
    // Check if required models are loaded
    if (!this.checkRequiredModels()) {
      console.error('Required models not loaded. Make sure to include model scripts in HTML.');
      return;
    }

    // Initialize notification and error handling first
    this.notificationManager = new NotificationManager();
    this.errorHandler = new ErrorHandler(this.notificationManager);
    
    this.storageManager = new StorageManager();
    this.currentFilter = new FilterCriteria();
    this.extensionSettings = new ExtensionSettings();
    this.exportManager = new ExportManager(null); // Will use background script for data access
    this.currentLogs = [];
    this.currentPage = 1;
    this.logsPerPage = 50;
    this.totalLogs = 0;
    this.isLoading = false;
    this.syntaxHighlighting = true;
    
    // Set up error handling for storage operations
    this.setupErrorHandling();
    
    this.initializeEventListeners();
    this.initializeBulkOperations();
    this.loadInitialData();
  }

  /**
   * Check if all required models are loaded
   */
  checkRequiredModels() {
    const requiredModels = [
      'LogEntry', 'FilterCriteria', 'StorageManager', 'ExtensionSettings',
      'KeywordFilters', 'ExportManager', 'SensitiveDataDetector',
      'NotificationManager', 'ErrorHandler'
    ];

    const missingModels = requiredModels.filter(model => typeof window[model] === 'undefined');
    
    if (missingModels.length > 0) {
      console.error('Missing required models:', missingModels);
      console.log('Available models:', Object.keys(window).filter(key => 
        requiredModels.includes(key) && typeof window[key] === 'function'
      ));
      return false;
    }
    
    console.log('All required models loaded successfully');
    return true;
  }

  /**
   * Set up error handling for storage and other operations
   */
  setupErrorHandling() {
    // Listen for storage retry events
    window.addEventListener('storage-retry', (event) => {
      this.errorHandler.wrapAsync(
        () => this.handleStorageRetry(event.detail),
        { type: 'storage_retry', context: 'options_page' }
      );
    });

    // Listen for force cleanup events
    window.addEventListener('force-cleanup', () => {
      this.errorHandler.wrapAsync(
        () => this.performForceCleanup(),
        { type: 'force_cleanup', context: 'options_page' }
      );
    });

    // Listen for storage settings events
    window.addEventListener('open-storage-settings', () => {
      this.errorHandler.wrapSync(
        () => this.switchToStorageTab(),
        { type: 'ui_navigation', context: 'options_page' }
      );
    });

    // Listen for extension data reset events
    window.addEventListener('reset-extension-data', () => {
      this.resetExtensionData();
    });
  }

  /**
   * Initialize all event listeners for the options page
   */
  initializeEventListeners() {
    // Tab navigation
    this.initializeTabNavigation();
    
    // Log browsing and search
    this.initializeLogBrowsing();
    
    // Settings management
    this.initializeSettingsManagement();
    
    // Export functionality
    this.initializeExportFunctionality();
    
    // Storage management
    this.initializeStorageManagement();
  }

  /**
   * Initialize tab navigation functionality
   */
  initializeTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const targetTab = e.target.dataset.tab;
        
        // Remove active class from all nav buttons and tab contents
        navButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(tab => tab.classList.remove('active'));
        
        // Add active class to clicked button and corresponding tab
        e.target.classList.add('active');
        document.getElementById(targetTab + '-tab').classList.add('active');
        
        // Load tab-specific data
        this.onTabChange(targetTab);
      });
    });
  }

  /**
   * Initialize log browsing and search functionality
   */
  initializeLogBrowsing() {
    // Search functionality
    const searchInput = document.getElementById('log-search');
    const searchBtn = document.getElementById('search-btn');
    const clearSearchBtn = document.getElementById('clear-search');
    
    searchBtn.addEventListener('click', () => this.performSearch());
    clearSearchBtn.addEventListener('click', () => this.clearSearch());
    
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });
    
    // Filter controls
    const applyFiltersBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters');
    
    applyFiltersBtn.addEventListener('click', () => this.applyFilters());
    clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    
    // View controls
    const showTimestamps = document.getElementById('show-timestamps');
    const showDomains = document.getElementById('show-domains');
    const syntaxHighlighting = document.getElementById('syntax-highlighting');
    const sortBy = document.getElementById('sort-by');
    
    showTimestamps.addEventListener('change', () => this.updateLogDisplay());
    showDomains.addEventListener('change', () => this.updateLogDisplay());
    syntaxHighlighting.addEventListener('change', (e) => {
      this.syntaxHighlighting = e.target.checked;
      this.updateLogDisplay();
    });
    sortBy.addEventListener('change', () => this.sortAndDisplayLogs());
    
    // Pagination
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    prevPageBtn.addEventListener('click', () => this.previousPage());
    nextPageBtn.addEventListener('click', () => this.nextPage());
  }

  /**
   * Initialize settings management functionality
   */
  initializeSettingsManagement() {
    const saveSettingsBtn = document.getElementById('save-settings');
    const resetSettingsBtn = document.getElementById('reset-settings');
    const manualCleanupBtn = document.getElementById('manual-cleanup');
    
    saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    resetSettingsBtn.addEventListener('click', () => this.resetSettings());
    manualCleanupBtn.addEventListener('click', () => this.performManualCleanup());
    
    // Website-specific settings
    const addWebsiteBtn = document.getElementById('add-website-setting');
    addWebsiteBtn.addEventListener('click', () => this.addWebsiteSetting());
    
    // Uninstall cleanup settings
    const cleanupOnUninstallCheckbox = document.getElementById('cleanup-on-uninstall');
    cleanupOnUninstallCheckbox.addEventListener('change', () => this.updateUninstallCleanupPreference());
    
    // Display settings
    const hideExtensionLogsCheckbox = document.getElementById('hide-extension-logs');
    const logsPerPageSelect = document.getElementById('logs-per-page');
    
    if (hideExtensionLogsCheckbox) {
      hideExtensionLogsCheckbox.addEventListener('change', () => this.loadLogs());
    }
    
    if (logsPerPageSelect) {
      logsPerPageSelect.addEventListener('change', (e) => {
        this.logsPerPage = parseInt(e.target.value) || 50;
        this.currentPage = 1; // Reset to first page
        this.loadLogs();
      });
    }
  }

  /**
   * Initialize export functionality
   */
  initializeExportFunctionality() {
    const exportLogsBtn = document.getElementById('export-logs');
    const previewExportBtn = document.getElementById('preview-export');
    const copyExportBtn = document.getElementById('copy-export');
    
    exportLogsBtn.addEventListener('click', () => this.exportLogs());
    previewExportBtn.addEventListener('click', () => this.previewExport());
    copyExportBtn.addEventListener('click', () => this.copyExportToClipboard());
    
    // Export scope radio button handlers
    const exportScopeRadios = document.querySelectorAll('input[name="export-scope"]');
    exportScopeRadios.forEach(radio => {
      radio.addEventListener('change', () => this.updateExportScope());
    });
    
    // Export format radio button handlers
    const exportFormatRadios = document.querySelectorAll('input[name="export-format"]');
    exportFormatRadios.forEach(radio => {
      radio.addEventListener('change', () => this.updateExportPreview());
    });
  }

  /**
   * Initialize storage management functionality
   */
  initializeStorageManagement() {
    const refreshStatsBtn = document.getElementById('refresh-storage-stats');
    const clearAllBtn = document.getElementById('clear-all');
    const cleanupByAgeBtn = document.getElementById('cleanup-by-age');
    const cleanupByDomainBtn = document.getElementById('cleanup-by-domain');
    const cleanupBySessionBtn = document.getElementById('cleanup-by-session');
    const exportStorageReportBtn = document.getElementById('export-storage-report');
    
    refreshStatsBtn.addEventListener('click', () => this.refreshStorageStats());
    clearAllBtn.addEventListener('click', () => this.clearAllLogs());
    cleanupByAgeBtn.addEventListener('click', () => this.cleanupByAge());
    cleanupByDomainBtn.addEventListener('click', () => this.cleanupByDomain());
    cleanupBySessionBtn.addEventListener('click', () => this.cleanupBySession());
    exportStorageReportBtn.addEventListener('click', () => this.exportStorageReport());
  }

  /**
   * Load initial data when page loads
   */
  async loadInitialData() {
    try {
      await this.safeAsyncOperation(
        () => Promise.resolve(), // Database initialization handled by background script
        { type: 'database_init', context: 'options_init' }
      );
      
      await this.safeAsyncOperation(
        () => this.loadLogs(),
        { type: 'logs_load', context: 'options_init' }
      );
      
      await this.safeAsyncOperation(
        () => this.populateFilterOptions(),
        { type: 'filter_options_load', context: 'options_init' }
      );
      
      await this.safeAsyncOperation(
        () => this.loadSettings(),
        { type: 'settings_load', context: 'options_init' }
      );
      
      await this.safeAsyncOperation(
        () => this.refreshStorageStats(),
        { type: 'storage_stats_load', context: 'options_init' }
      );
      
    } catch (error) {
      this.errorHandler.handleError(error, {
        type: 'options_initialization',
        context: 'options_page'
      });
    }
  }

  /**
   * Handle tab change events
   */
  async onTabChange(tabName) {
    switch (tabName) {
      case 'logs':
        await this.loadLogs();
        break;
      case 'storage':
        await this.refreshStorageStats();
        break;
      case 'settings':
        await this.loadSettings();
        break;
    }
  }

  /**
   * Load and display logs based on current filter criteria
   */
  async loadLogs() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.showLoading(true);
    
    try {
      // Calculate offset for pagination
      const offset = (this.currentPage - 1) * this.logsPerPage;
      
      // Build query options from current filter
      const queryOptions = {
        levels: this.currentFilter.levels.length > 0 ? this.currentFilter.levels : ['log', 'error', 'warn', 'info'],
        domains: this.currentFilter.domains.length > 0 ? this.currentFilter.domains : [],
        startTime: this.currentFilter.dateRange.start || 0,
        endTime: this.currentFilter.dateRange.end || Date.now(),
        limit: this.logsPerPage,
        offset: offset
      };
      
      // Query logs from storage via background script
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LOGS',
        data: queryOptions
      });
      
      let logs = [];
      if (response && response.logs) {
        logs = response.logs;
      } else if (response && Array.isArray(response)) {
        logs = response; // Direct array response
      } else {
        console.warn('Unexpected response format:', response);
      }
      
      // Apply text search filter (done in memory for better performance with highlighting)
      if (this.currentFilter.textSearch) {
        logs = logs.filter(log => this.currentFilter.matchesTextSearch(log.message));
      }
      
      // Apply session filter
      if (this.currentFilter.sessionIds.length > 0) {
        logs = logs.filter(log => this.currentFilter.sessionIds.includes(log.sessionId));
      }
      
      // Apply extension log filter if enabled
      const hideExtensionLogs = document.getElementById('hide-extension-logs')?.checked || false;
      if (hideExtensionLogs) {
        logs = logs.filter(log => !this.isExtensionLog(log));
      }
      
      this.currentLogs = logs;
      this.totalLogs = await this.getTotalFilteredLogCount();
      
      this.sortAndDisplayLogs();
      this.updatePagination();
      
    } catch (error) {
      console.error('Failed to load logs:', error);
      this.showError('Failed to load logs. Please try again.');
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  /**
   * Get total count of logs matching current filter
   */
  async getTotalFilteredLogCount() {
    try {
      // For simplicity, we'll get all matching logs and count them
      // In a production app, you'd want a more efficient counting method
      const queryOptions = {
        levels: this.currentFilter.levels.length > 0 ? this.currentFilter.levels : ['log', 'error', 'warn', 'info'],
        domains: this.currentFilter.domains.length > 0 ? this.currentFilter.domains : [],
        startTime: this.currentFilter.dateRange.start || 0,
        endTime: this.currentFilter.dateRange.end || Date.now(),
        limit: 10000, // Large limit to get all matching logs
        offset: 0
      };
      
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LOGS_COUNT',
        data: queryOptions
      });
      
      if (response && response.success) {
        return response.count || 0;
      } else {
        // Fallback: get logs and count them
        const logsResponse = await chrome.runtime.sendMessage({
          type: 'GET_LOGS',
          data: queryOptions
        });
        
        let logs = [];
        if (logsResponse && logsResponse.success && logsResponse.logs) {
          logs = logsResponse.logs;
        }
        
        // Apply additional filters
        if (this.currentFilter.textSearch) {
          logs = logs.filter(log => this.currentFilter.matchesTextSearch(log.message));
        }
        
        if (this.currentFilter.sessionIds.length > 0) {
          logs = logs.filter(log => this.currentFilter.sessionIds.includes(log.sessionId));
        }
        
        return logs.length;
      }
    } catch (error) {
      console.error('Failed to get total log count:', error);
      return 0;
    }
  }

  /**
   * Sort logs based on current sort criteria and display them
   */
  sortAndDisplayLogs() {
    const sortBy = document.getElementById('sort-by').value;
    
    const sortedLogs = [...this.currentLogs].sort((a, b) => {
      switch (sortBy) {
        case 'timestamp-desc':
          return b.timestamp - a.timestamp;
        case 'timestamp-asc':
          return a.timestamp - b.timestamp;
        case 'level':
          const levelOrder = { error: 0, warn: 1, info: 2, log: 3 };
          return (levelOrder[a.level] || 4) - (levelOrder[b.level] || 4);
        case 'domain':
          return a.domain.localeCompare(b.domain);
        default:
          return b.timestamp - a.timestamp;
      }
    });
    
    this.displayLogs(sortedLogs);
  }

  /**
   * Display logs in the UI with proper formatting and highlighting
   */
  displayLogs(logs) {
    const logsList = document.getElementById('logs-list');
    const showTimestamps = document.getElementById('show-timestamps').checked;
    const showDomains = document.getElementById('show-domains').checked;
    
    if (logs.length === 0) {
      logsList.innerHTML = '<div class="no-logs">No logs found matching your criteria.</div>';
      return;
    }
    
    const logsHTML = logs.map(log => this.renderLogEntry(log, showTimestamps, showDomains)).join('');
    logsList.innerHTML = logsHTML;
  }

  /**
   * Render a single log entry with proper formatting
   */
  renderLogEntry(log, showTimestamps, showDomains) {
    const timestamp = showTimestamps ? new Date(log.timestamp).toLocaleString() : '';
    const domain = showDomains ? log.domain : '';
    const levelClass = `log-${log.level}`;
    
    // Apply syntax highlighting if enabled
    let message = this.escapeHtml(log.message);
    if (this.syntaxHighlighting) {
      message = this.applySyntaxHighlighting(message);
    }
    
    // Highlight search terms
    if (this.currentFilter.textSearch) {
      message = this.highlightSearchTerms(message, this.currentFilter.textSearch);
    }
    
    return `
      <div class="log-entry" data-log-id="${log.id}">
        <div class="log-header">
          <input type="checkbox" class="log-select-checkbox" onchange="optionsManager.updateBulkSelectionCount()">
          <span class="log-level ${levelClass}">${log.level.toUpperCase()}</span>
          ${showDomains ? `<span class="log-domain">${domain}</span>` : ''}
          ${showTimestamps ? `<span class="log-timestamp">${timestamp}</span>` : ''}
          <span class="log-session" title="Session: ${log.sessionId}">Session</span>
        </div>
        <div class="log-message">${message}</div>
      </div>
    `;
  }

  /**
   * Apply basic syntax highlighting to log messages
   */
  applySyntaxHighlighting(message) {
    // Basic syntax highlighting for common patterns
    return message
      .replace(/(".*?")/g, '<span class="syntax-string">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="syntax-number">$1</span>')
      .replace(/\b(true|false|null|undefined)\b/g, '<span class="syntax-keyword">$1</span>')
      .replace(/(https?:\/\/[^\s]+)/g, '<span class="syntax-url">$1</span>')
      .replace(/\b(ERROR|WARN|INFO|DEBUG)\b/g, '<span class="syntax-level">$1</span>');
  }

  /**
   * Highlight search terms in log messages
   */
  highlightSearchTerms(message, searchTerm) {
    if (!searchTerm) return message;
    
    const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
    return message.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Perform search based on current search input
   */
  async performSearch() {
    const searchInput = document.getElementById('log-search');
    const searchTerm = searchInput.value.trim();
    
    this.currentFilter.setTextSearch(searchTerm);
    this.currentPage = 1; // Reset to first page
    await this.loadLogs();
  }

  /**
   * Clear search and reload all logs
   */
  async clearSearch() {
    const searchInput = document.getElementById('log-search');
    searchInput.value = '';
    
    this.currentFilter.setTextSearch('');
    this.currentPage = 1;
    await this.loadLogs();
  }

  /**
   * Apply filters based on current filter form values
   */
  async applyFilters() {
    // Get filter values from form
    const levelFilter = document.getElementById('level-filter').value;
    const domainFilter = document.getElementById('domain-filter').value;
    const sessionFilter = document.getElementById('session-filter').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    
    // Update filter criteria
    if (levelFilter) {
      this.currentFilter.setLevels([levelFilter]);
    } else {
      this.currentFilter.setLevels(['log', 'error', 'warn', 'info']);
    }
    
    if (domainFilter) {
      this.currentFilter.setDomains([domainFilter]);
    } else {
      this.currentFilter.setDomains([]);
    }
    
    if (sessionFilter) {
      this.currentFilter.setSessionIds([sessionFilter]);
    } else {
      this.currentFilter.setSessionIds([]);
    }
    
    // Set date range
    const startDate = dateFrom ? new Date(dateFrom).getTime() : null;
    const endDate = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;
    this.currentFilter.setDateRange(startDate, endDate);
    
    this.currentPage = 1; // Reset to first page
    await this.loadLogs();
  }

  /**
   * Clear all filters and reload logs
   */
  async clearFilters() {
    // Reset filter form
    document.getElementById('level-filter').value = '';
    document.getElementById('domain-filter').value = '';
    document.getElementById('session-filter').value = '';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    
    // Reset filter criteria
    this.currentFilter.reset();
    this.currentPage = 1;
    await this.loadLogs();
  }

  /**
   * Populate filter dropdown options with available domains and sessions
   */
  async populateFilterOptions() {
    try {
      // Get all logs to extract unique domains and sessions
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LOGS',
        data: { limit: 10000 }
      });
      
      let allLogs = [];
      if (response && response.logs) {
        allLogs = response.logs;
      } else if (response && Array.isArray(response)) {
        allLogs = response;
      }
      
      // Extract unique domains
      const domains = [...new Set(allLogs.map(log => log.domain))].sort();
      const domainSelect = document.getElementById('domain-filter');
      
      // Clear existing options (except "All Domains")
      while (domainSelect.children.length > 1) {
        domainSelect.removeChild(domainSelect.lastChild);
      }
      
      // Add domain options
      domains.forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainSelect.appendChild(option);
      });
      
      // Extract unique sessions (limit to recent sessions)
      const recentLogs = allLogs.slice(0, 1000); // Last 1000 logs
      const sessions = [...new Set(recentLogs.map(log => log.sessionId))].sort();
      const sessionSelect = document.getElementById('session-filter');
      
      // Clear existing options (except "All Sessions")
      while (sessionSelect.children.length > 1) {
        sessionSelect.removeChild(sessionSelect.lastChild);
      }
      
      // Add session options (show domain and timestamp for clarity)
      sessions.forEach(sessionId => {
        const sessionLogs = recentLogs.filter(log => log.sessionId === sessionId);
        const firstLog = sessionLogs[0];
        const sessionStart = new Date(firstLog.timestamp).toLocaleString();
        
        const option = document.createElement('option');
        option.value = sessionId;
        option.textContent = `${firstLog.domain} - ${sessionStart}`;
        sessionSelect.appendChild(option);
      });
      
    } catch (error) {
      console.error('Failed to populate filter options:', error);
    }
  }

  /**
   * Update pagination controls
   */
  updatePagination() {
    const totalPages = Math.ceil(this.totalLogs / this.logsPerPage);
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    prevBtn.disabled = this.currentPage <= 1;
    nextBtn.disabled = this.currentPage >= totalPages;
    
    pageInfo.textContent = `Page ${this.currentPage} of ${totalPages} (${this.totalLogs} logs)`;
  }

  /**
   * Navigate to previous page
   */
  async previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      await this.loadLogs();
    }
  }

  /**
   * Navigate to next page
   */
  async nextPage() {
    const totalPages = Math.ceil(this.totalLogs / this.logsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      await this.loadLogs();
    }
  }

  /**
   * Update log display based on view settings
   */
  updateLogDisplay() {
    this.displayLogs(this.currentLogs);
  }

  /**
   * Show/hide loading indicator
   */
  showLoading(show) {
    const logsList = document.getElementById('logs-list');
    if (show) {
      logsList.innerHTML = '<div class="loading">Loading logs...</div>';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const logsList = document.getElementById('logs-list');
    logsList.innerHTML = `<div class="error">Error: ${message}</div>`;
  }

  /**
   * Load settings from storage and populate the settings form
   */
  async loadSettings() {
    try {
      this.extensionSettings = new ExtensionSettings();
      await this.extensionSettings.load();
      
      // If no keyword filters exist, create default instance
      if (!this.extensionSettings.keywordFilters) {
        this.extensionSettings.setKeywordFilters(new KeywordFilters());
      }
      
      this.populateSettingsForm();
      this.populateWebsiteSettingsList();
      
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showSettingsError('Failed to load settings. Using defaults.');
    }
  }
  
  /**
   * Populate the settings form with current values
   */
  populateSettingsForm() {
    // General settings
    document.getElementById('capture-enabled').checked = this.extensionSettings.captureEnabled;
    document.getElementById('max-logs-per-session').value = this.extensionSettings.maxLogsPerSession || 1000;
    
    // Log levels
    const logLevelCheckboxes = document.querySelectorAll('input[name="log-levels"]');
    logLevelCheckboxes.forEach(checkbox => {
      checkbox.checked = this.extensionSettings.logLevels.includes(checkbox.value);
    });
    
    // Storage settings
    document.getElementById('retention-days').value = this.extensionSettings.retentionDays;
    document.getElementById('max-storage').value = this.extensionSettings.maxStorageSize;
    
    // Keyword filters
    const keywordFilters = this.extensionSettings.keywordFilters;
    if (keywordFilters) {
      document.getElementById('include-keywords').value = keywordFilters.include.join(', ');
      document.getElementById('exclude-keywords').value = keywordFilters.exclude.join(', ');
      document.getElementById('case-sensitive').checked = keywordFilters.caseSensitive;
    }
    
    // Security settings
    document.getElementById('sensitive-data-filtering').checked = this.extensionSettings.sensitiveDataFiltering;
    
    // Load uninstall cleanup settings
    this.loadUninstallCleanupSettings();
  }
  
  /**
   * Save settings from the form to storage
   */
  async saveSettings() {
    try {
      this.showSettingsSaving(true);
      
      // Collect form data
      const formData = this.collectSettingsFormData();
      
      // Validate settings
      const validation = this.validateSettings(formData);
      if (!validation.valid) {
        this.showSettingsError(validation.message);
        return;
      }
      
      // Update settings object
      this.updateSettingsFromForm(formData);
      
      // Save to storage
      await this.extensionSettings.save();
      
      // Notify background script of settings change
      await this.notifySettingsChange();
      
      this.showSettingsSuccess('Settings saved successfully!');
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showSettingsError('Failed to save settings. Please try again.');
    } finally {
      this.showSettingsSaving(false);
    }
  }
  
  /**
   * Collect data from the settings form
   */
  collectSettingsFormData() {
    // General settings
    const captureEnabled = document.getElementById('capture-enabled').checked;
    const maxLogsPerSession = parseInt(document.getElementById('max-logs-per-session').value) || 1000;
    
    // Log levels
    const logLevels = Array.from(document.querySelectorAll('input[name="log-levels"]:checked'))
      .map(checkbox => checkbox.value);
    
    // Storage settings
    const retentionDays = parseInt(document.getElementById('retention-days').value) || 30;
    const maxStorageSize = parseInt(document.getElementById('max-storage').value) || 100;
    
    // Keyword filters
    const includeKeywords = document.getElementById('include-keywords').value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    const excludeKeywords = document.getElementById('exclude-keywords').value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    const caseSensitive = document.getElementById('case-sensitive').checked;
    
    // Security settings
    const sensitiveDataFiltering = document.getElementById('sensitive-data-filtering').checked;
    
    return {
      captureEnabled,
      maxLogsPerSession,
      logLevels,
      retentionDays,
      maxStorageSize,
      includeKeywords,
      excludeKeywords,
      caseSensitive,
      sensitiveDataFiltering
    };
  }
  
  /**
   * Validate settings form data
   */
  validateSettings(formData) {
    // Validate retention days
    if (formData.retentionDays < 1 || formData.retentionDays > 365) {
      return { valid: false, message: 'Retention days must be between 1 and 365.' };
    }
    
    // Validate max storage size
    if (formData.maxStorageSize < 10 || formData.maxStorageSize > 1000) {
      return { valid: false, message: 'Maximum storage size must be between 10 and 1000 MB.' };
    }
    
    // Validate max logs per session
    if (formData.maxLogsPerSession < 100 || formData.maxLogsPerSession > 10000) {
      return { valid: false, message: 'Maximum logs per session must be between 100 and 10,000.' };
    }
    
    // Validate at least one log level is selected
    if (formData.logLevels.length === 0) {
      return { valid: false, message: 'At least one log level must be selected.' };
    }
    
    return { valid: true };
  }
  
  /**
   * Update settings object from form data
   */
  updateSettingsFromForm(formData) {
    this.extensionSettings
      .setCaptureEnabled(formData.captureEnabled)
      .setLogLevels(formData.logLevels)
      .setRetentionDays(formData.retentionDays)
      .setMaxStorageSize(formData.maxStorageSize)
      .setSensitiveDataFiltering(formData.sensitiveDataFiltering);
    
    // Update max logs per session (custom property)
    this.extensionSettings.maxLogsPerSession = formData.maxLogsPerSession;
    
    // Update keyword filters
    if (this.extensionSettings.keywordFilters) {
      this.extensionSettings.keywordFilters
        .setIncludeKeywords(formData.includeKeywords)
        .setExcludeKeywords(formData.excludeKeywords)
        .setCaseSensitive(formData.caseSensitive);
    }
  }
  
  /**
   * Reset settings to defaults
   */
  async resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      return;
    }
    
    try {
      this.showSettingsSaving(true);
      
      // Reset to defaults
      this.extensionSettings.reset();
      this.extensionSettings.setKeywordFilters(new KeywordFilters());
      
      // Save defaults
      await this.extensionSettings.save();
      
      // Update form
      this.populateSettingsForm();
      this.populateWebsiteSettingsList();
      
      // Notify background script
      await this.notifySettingsChange();
      
      this.showSettingsSuccess('Settings reset to defaults successfully!');
      
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showSettingsError('Failed to reset settings. Please try again.');
    } finally {
      this.showSettingsSaving(false);
    }
  }
  
  /**
   * Add website-specific setting
   */
  async addWebsiteSetting() {
    const domainInput = document.getElementById('website-domain');
    const domain = domainInput.value.trim();
    
    if (!domain) {
      this.showSettingsError('Please enter a domain name.');
      return;
    }
    
    // Validate domain format
    if (!this.isValidDomain(domain)) {
      this.showSettingsError('Please enter a valid domain name (e.g., example.com).');
      return;
    }
    
    // Check if domain already exists
    if (this.extensionSettings.getWebsiteSettings(domain)) {
      this.showSettingsError('Settings for this domain already exist.');
      return;
    }
    
    try {
      // Add default website settings
      const defaultWebsiteSettings = {
        enabled: true,
        customLogLevels: null, // null means use global settings
        customKeywordFilters: null // null means use global settings
      };
      
      this.extensionSettings.setWebsiteSettings(domain, defaultWebsiteSettings);
      
      // Save settings
      await this.extensionSettings.save();
      
      // Clear input and refresh list
      domainInput.value = '';
      this.populateWebsiteSettingsList();
      
      this.showSettingsSuccess(`Settings added for ${domain}`);
      
    } catch (error) {
      console.error('Failed to add website setting:', error);
      this.showSettingsError('Failed to add website setting. Please try again.');
    }
  }
  
  /**
   * Remove website-specific setting
   */
  async removeWebsiteSetting(domain) {
    if (!confirm(`Are you sure you want to remove settings for ${domain}?`)) {
      return;
    }
    
    try {
      this.extensionSettings.removeWebsiteSettings(domain);
      await this.extensionSettings.save();
      
      this.populateWebsiteSettingsList();
      this.showSettingsSuccess(`Settings removed for ${domain}`);
      
    } catch (error) {
      console.error('Failed to remove website setting:', error);
      this.showSettingsError('Failed to remove website setting. Please try again.');
    }
  }
  
  /**
   * Toggle website-specific setting enabled state
   */
  async toggleWebsiteSetting(domain) {
    try {
      const settings = this.extensionSettings.getWebsiteSettings(domain);
      if (settings) {
        settings.enabled = !settings.enabled;
        this.extensionSettings.setWebsiteSettings(domain, settings);
        await this.extensionSettings.save();
        
        this.populateWebsiteSettingsList();
        await this.notifySettingsChange();
      }
    } catch (error) {
      console.error('Failed to toggle website setting:', error);
      this.showSettingsError('Failed to update website setting.');
    }
  }
  
  /**
   * Populate the website settings list
   */
  populateWebsiteSettingsList() {
    const listContainer = document.getElementById('website-settings-list');
    
    if (this.extensionSettings.websiteSettings.size === 0) {
      listContainer.innerHTML = '<p class="no-website-settings">No website-specific settings configured.</p>';
      return;
    }
    
    const settingsHTML = Array.from(this.extensionSettings.websiteSettings.entries())
      .map(([domain, settings]) => this.renderWebsiteSetting(domain, settings))
      .join('');
    
    listContainer.innerHTML = settingsHTML;
    
    // Add event listeners for website setting controls
    this.attachWebsiteSettingListeners();
  }
  
  /**
   * Render a single website setting item
   */
  renderWebsiteSetting(domain, settings) {
    const enabledClass = settings.enabled ? 'enabled' : 'disabled';
    const enabledText = settings.enabled ? 'Enabled' : 'Disabled';
    
    return `
      <div class="website-setting-item ${enabledClass}">
        <div class="website-setting-info">
          <span class="website-setting-domain">${this.escapeHtml(domain)}</span>
          <span class="website-setting-status">${enabledText}</span>
        </div>
        <div class="website-setting-controls">
          <button class="btn-secondary toggle-website-setting" data-domain="${domain}">
            ${settings.enabled ? 'Disable' : 'Enable'}
          </button>
          <button class="btn-danger remove-website-setting" data-domain="${domain}">
            Remove
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Attach event listeners for website setting controls
   */
  attachWebsiteSettingListeners() {
    // Toggle buttons
    document.querySelectorAll('.toggle-website-setting').forEach(button => {
      button.addEventListener('click', (e) => {
        const domain = e.target.dataset.domain;
        this.toggleWebsiteSetting(domain);
      });
    });
    
    // Remove buttons
    document.querySelectorAll('.remove-website-setting').forEach(button => {
      button.addEventListener('click', (e) => {
        const domain = e.target.dataset.domain;
        this.removeWebsiteSetting(domain);
      });
    });
  }
  
  /**
   * Validate domain format
   */
  isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }
  
  /**
   * Notify background script of settings changes
   */
  async notifySettingsChange() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'SETTINGS_CHANGED',
          settings: this.extensionSettings.toJSON()
        });
      }
    } catch (error) {
      console.warn('Failed to notify background script of settings change:', error);
    }
  }
  
  /**
   * Show settings saving state
   */
  showSettingsSaving(saving) {
    const saveBtn = document.getElementById('save-settings');
    if (saving) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    } else {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    }
  }
  
  /**
   * Show settings success message
   */
  showSettingsSuccess(message) {
    this.showSettingsMessage(message, 'success');
  }
  
  /**
   * Show settings error message
   */
  showSettingsError(message) {
    this.showSettingsMessage(message, 'error');
  }
  
  /**
   * Show settings message with specified type
   */
  showSettingsMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.settings-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `settings-message settings-message-${type}`;
    messageDiv.textContent = message;
    
    // Insert after settings actions
    const settingsActions = document.querySelector('.settings-actions');
    settingsActions.parentNode.insertBefore(messageDiv, settingsActions.nextSibling);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }
  


  /**
   * Export logs based on current settings
   */
  async exportLogs() {
    try {
      this.showExportLoading(true);
      
      const exportFormat = this.getSelectedExportFormat();
      const filterCriteria = this.getExportFilterCriteria();
      const excludeSensitive = document.getElementById('exclude-sensitive-data').checked;
      
      // Validate export parameters
      const validation = this.exportManager.validateExportParameters(filterCriteria);
      if (!validation.isValid) {
        this.showExportError(validation.errors.join(', '));
        return;
      }
      
      // Show warnings if any
      if (validation.warnings.length > 0) {
        const proceed = confirm(`Warning: ${validation.warnings.join(', ')}\n\nDo you want to continue?`);
        if (!proceed) return;
      }
      
      // Validate for sensitive data if filtering is enabled
      if (excludeSensitive) {
        const exportValidation = await this.exportManager.validateExportRequest(filterCriteria, { 
          format: exportFormat,
          excludeSensitive: true 
        });
        
        if (exportValidation.scanResults.hasSensitiveData) {
          const proceed = confirm(
            `Warning: ${exportValidation.scanResults.sensitiveEntries} log entries contain potentially sensitive data.\n\n` +
            `These entries will be excluded from the export. Continue?`
          );
          if (!proceed) return;
        }
      }
      
      // Perform export
      let exportResult;
      switch (exportFormat) {
        case 'json':
          exportResult = await this.exportManager.exportToJSON(filterCriteria);
          break;
        case 'csv':
          exportResult = await this.exportManager.exportToCSV(filterCriteria);
          break;
        case 'txt':
          exportResult = await this.exportManager.exportToText(filterCriteria);
          break;
        default:
          throw new Error('Invalid export format selected');
      }
      
      // Show security warnings if sensitive data detected
      if (exportResult.validation.scanResults.hasSensitiveData && !excludeSensitive) {
        const proceed = confirm(
          `Security Warning: The export contains ${exportResult.validation.scanResults.sensitiveEntries} entries with potentially sensitive data.\n\n` +
          `This may include API keys, passwords, or tokens. Are you sure you want to export this data?`
        );
        if (!proceed) return;
      }
      
      // Download the file
      this.downloadExportFile(exportResult);
      
      this.showExportSuccess(`Export completed successfully! ${exportResult.filename} has been downloaded.`);
      
    } catch (error) {
      console.error('Export failed:', error);
      this.showExportError(`Export failed: ${error.message}`);
    } finally {
      this.showExportLoading(false);
    }
  }
  
  /**
   * Preview export data
   */
  async previewExport() {
    try {
      this.showExportLoading(true);
      
      const exportFormat = this.getSelectedExportFormat();
      const filterCriteria = this.getExportFilterCriteria();
      const excludeSensitive = document.getElementById('exclude-sensitive-data').checked;
      
      // Create secure preview
      const preview = await this.exportManager.createSecurePreview(filterCriteria, 10);
      
      // Generate preview content based on format
      let previewContent;
      switch (exportFormat) {
        case 'json':
          previewContent = this.generateJSONPreview(preview.logs);
          break;
        case 'csv':
          previewContent = this.generateCSVPreview(preview.logs);
          break;
        case 'txt':
          previewContent = this.generateTextPreview(preview.logs);
          break;
        default:
          previewContent = 'Invalid format selected';
      }
      
      // Display preview with security summary
      this.displayExportPreview(previewContent, preview.securitySummary, preview.hasRedactions);
      
    } catch (error) {
      console.error('Preview failed:', error);
      this.showExportError(`Preview failed: ${error.message}`);
    } finally {
      this.showExportLoading(false);
    }
  }
  
  /**
   * Copy export data to clipboard
   */
  async copyExportToClipboard() {
    try {
      this.showExportLoading(true);
      
      const exportFormat = this.getSelectedExportFormat();
      const filterCriteria = this.getExportFilterCriteria();
      
      // Limit clipboard export to prevent memory issues
      const limitedCriteria = { ...filterCriteria, limit: 1000 };
      
      let exportResult;
      switch (exportFormat) {
        case 'json':
          exportResult = await this.exportManager.exportToJSON(limitedCriteria);
          break;
        case 'csv':
          exportResult = await this.exportManager.exportToCSV(limitedCriteria);
          break;
        case 'txt':
          exportResult = await this.exportManager.exportToText(limitedCriteria);
          break;
        default:
          throw new Error('Invalid export format selected');
      }
      
      // Copy to clipboard
      await navigator.clipboard.writeText(exportResult.data);
      
      this.showExportSuccess('Export data copied to clipboard successfully!');
      
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      this.showExportError(`Copy to clipboard failed: ${error.message}`);
    } finally {
      this.showExportLoading(false);
    }
  }
  
  /**
   * Get selected export format
   */
  getSelectedExportFormat() {
    const formatRadio = document.querySelector('input[name="export-format"]:checked');
    return formatRadio ? formatRadio.value : 'json';
  }
  
  /**
   * Get export filter criteria based on selected scope
   */
  getExportFilterCriteria() {
    const scopeRadio = document.querySelector('input[name="export-scope"]:checked');
    const scope = scopeRadio ? scopeRadio.value : 'current-filters';
    
    switch (scope) {
      case 'current-filters':
        return {
          textSearch: this.currentFilter.textSearch,
          levels: this.currentFilter.levels,
          domains: this.currentFilter.domains,
          startTime: this.currentFilter.dateRange.start,
          endTime: this.currentFilter.dateRange.end,
          limit: 50000 // Large limit for export
        };
        
      case 'all':
        return {
          limit: 50000 // Large limit for export
        };
        
      case 'custom':
        const dateFrom = document.getElementById('export-date-from').value;
        const dateTo = document.getElementById('export-date-to').value;
        
        return {
          startTime: dateFrom ? new Date(dateFrom).getTime() : 0,
          endTime: dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Date.now(),
          limit: 50000
        };
        
      default:
        return { limit: 50000 };
    }
  }
  
  /**
   * Update export scope UI based on selection
   */
  updateExportScope() {
    const scopeRadio = document.querySelector('input[name="export-scope"]:checked');
    const customDateRange = document.querySelector('.custom-date-range');
    
    if (scopeRadio && scopeRadio.value === 'custom') {
      customDateRange.style.display = 'block';
    } else {
      customDateRange.style.display = 'none';
    }
  }
  
  /**
   * Update export preview when format changes
   */
  async updateExportPreview() {
    // Clear current preview
    const previewContent = document.getElementById('export-preview-content');
    previewContent.innerHTML = '<p class="preview-placeholder">Click "Preview" to see export sample</p>';
  }
  
  /**
   * Generate JSON preview
   */
  generateJSONPreview(logs) {
    const sampleData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalEntries: logs.length,
        format: 'JSON',
        version: '1.0'
      },
      logs: logs.slice(0, 3) // Show first 3 entries
    };
    
    return JSON.stringify(sampleData, null, 2);
  }
  
  /**
   * Generate CSV preview
   */
  generateCSVPreview(logs) {
    const headers = ['ID', 'Timestamp', 'Date/Time', 'Level', 'Message', 'URL', 'Domain'];
    const rows = logs.slice(0, 3).map(log => [
      log.id,
      log.timestamp,
      new Date(log.timestamp).toISOString(),
      log.level,
      log.message.substring(0, 50) + '...',
      log.url,
      log.domain
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  /**
   * Generate text preview
   */
  generateTextPreview(logs) {
    const header = `Console Log Export\nGenerated: ${new Date().toISOString()}\nTotal Entries: ${logs.length}\n\n`;
    const logLines = logs.slice(0, 3).map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      return `[${timestamp}] [${log.level.toUpperCase()}] [${log.domain}] ${log.message}`;
    });
    
    return header + logLines.join('\n');
  }
  
  /**
   * Display export preview with security information
   */
  displayExportPreview(content, securitySummary, hasRedactions) {
    const previewContent = document.getElementById('export-preview-content');
    
    let html = `<pre class="export-preview-text">${this.escapeHtml(content)}</pre>`;
    
    if (hasRedactions) {
      html += `<div class="security-warning">
        <strong>Security Notice:</strong> Some data has been redacted in this preview due to potential sensitive content.
      </div>`;
    }
    
    if (securitySummary && securitySummary.hasSensitiveData) {
      html += `<div class="security-summary">
        <h4>Security Summary:</h4>
        <ul>
          <li>Potentially sensitive entries: ${securitySummary.sensitiveEntries}</li>
          <li>Common patterns detected: ${securitySummary.patterns.join(', ')}</li>
        </ul>
      </div>`;
    }
    
    previewContent.innerHTML = html;
  }
  
  /**
   * Download export file
   */
  downloadExportFile(exportResult) {
    const blob = new Blob([exportResult.data], { type: exportResult.mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * Show export loading state
   */
  showExportLoading(show) {
    const exportBtn = document.getElementById('export-logs');
    const previewBtn = document.getElementById('preview-export');
    const copyBtn = document.getElementById('copy-export');
    
    if (show) {
      exportBtn.disabled = true;
      previewBtn.disabled = true;
      copyBtn.disabled = true;
      exportBtn.textContent = 'Exporting...';
    } else {
      exportBtn.disabled = false;
      previewBtn.disabled = false;
      copyBtn.disabled = false;
      exportBtn.textContent = 'Export Logs';
    }
  }
  
  /**
   * Show export success message
   */
  showExportSuccess(message) {
    this.showExportMessage(message, 'success');
  }
  
  /**
   * Show export error message
   */
  showExportError(message) {
    this.showExportMessage(message, 'error');
  }
  
  /**
   * Show export message with specified type
   */
  showExportMessage(message, type) {
    // Create or update message element
    let messageEl = document.getElementById('export-message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.id = 'export-message';
      messageEl.className = 'export-message';
      
      const exportSection = document.querySelector('.export-section');
      exportSection.insertBefore(messageEl, exportSection.firstChild);
    }
    
    messageEl.className = `export-message ${type}`;
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 5000);
  }

  /**
   * Refresh storage statistics and update the UI
   */
  async refreshStorageStats() {
    try {
      this.showStorageLoading(true);
      
      // Get storage usage information
      const usage = await this.storageManager.calculateStorageUsage();
      const quota = await this.storageManager.getStorageQuota();
      const status = await this.storageManager.checkStorageStatus();
      
      // Update storage stats display
      this.updateStorageStatsDisplay(usage, quota, status);
      
      // Update domain breakdown
      await this.updateDomainStorageBreakdown(usage.domainSizes);
      
      // Update cleanup dropdowns
      await this.updateCleanupDropdowns();
      
      this.showStorageMessage('Storage statistics refreshed successfully', 'success');
      
    } catch (error) {
      console.error('Failed to refresh storage stats:', error);
      this.showStorageMessage('Failed to refresh storage statistics', 'error');
    } finally {
      this.showStorageLoading(false);
    }
  }

  /**
   * Update storage statistics display in the UI
   */
  updateStorageStatsDisplay(usage, quota, status) {
    // Update stat cards
    document.getElementById('total-logs-count').textContent = usage.entryCount.toLocaleString();
    document.getElementById('storage-used').textContent = `${usage.totalSizeMB} MB`;
    
    // Find oldest log
    if (usage.entryCount > 0) {
      this.storageManager.queryLogs({ limit: 1, offset: 0 }).then(logs => {
        if (logs.length > 0) {
          const oldestDate = new Date(logs[0].timestamp).toLocaleDateString();
          document.getElementById('oldest-log').textContent = oldestDate;
        }
      });
    } else {
      document.getElementById('oldest-log').textContent = 'N/A';
    }
    
    // Count active sessions (sessions from last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.storageManager.queryLogs({ startTime: oneDayAgo, limit: 10000 }).then(recentLogs => {
      const activeSessions = new Set(recentLogs.map(log => log.sessionId)).size;
      document.getElementById('active-sessions').textContent = activeSessions;
    });
    
    // Update storage warning if needed
    this.updateStorageWarning(quota, status);
  }

  /**
   * Update storage warning based on quota status
   */
  updateStorageWarning(quota, status) {
    const storageSection = document.querySelector('.storage-section');
    
    // Remove existing warnings
    const existingWarning = storageSection.querySelector('.storage-warning');
    if (existingWarning) {
      existingWarning.remove();
    }
    
    // Add warning if needed
    if (status.warningLevel !== 'normal') {
      const warningDiv = document.createElement('div');
      warningDiv.className = `storage-warning ${status.warningLevel}`;
      
      let message = '';
      if (status.warningLevel === 'critical') {
        message = `⚠️ Critical: Browser storage is ${quota.usagePercentage}% full. Cleanup recommended.`;
      } else if (status.warningLevel === 'warning') {
        message = `⚠️ Warning: Browser storage is ${quota.usagePercentage}% full. Consider cleanup.`;
      }
      
      warningDiv.innerHTML = `
        <p>${message}</p>
        <button class="btn-primary" onclick="optionsManager.performAutomaticCleanup()">
          Perform Automatic Cleanup
        </button>
      `;
      
      storageSection.insertBefore(warningDiv, storageSection.firstChild);
    }
  }

  /**
   * Update domain storage breakdown display
   */
  async updateDomainStorageBreakdown(domainSizes) {
    const domainList = document.getElementById('domain-storage-list');
    
    if (Object.keys(domainSizes).length === 0) {
      domainList.innerHTML = '<div class="no-domains">No domains found</div>';
      return;
    }
    
    // Sort domains by storage size (descending)
    const sortedDomains = Object.entries(domainSizes)
      .sort(([,a], [,b]) => b.size - a.size);
    
    const domainHTML = sortedDomains.map(([domain, data]) => {
      const sizeMB = Math.round((data.size / (1024 * 1024)) * 100) / 100;
      return `
        <div class="domain-storage-item">
          <div class="domain-name">${domain}</div>
          <div class="domain-stats">
            <span>${data.count} logs</span>
            <span>${sizeMB} MB</span>
          </div>
        </div>
      `;
    }).join('');
    
    domainList.innerHTML = domainHTML;
  }

  /**
   * Update cleanup dropdown options with current domains and sessions
   */
  async updateCleanupDropdowns() {
    try {
      // Update domain cleanup dropdown
      const domainSelect = document.getElementById('cleanup-domain-select');
      const sessionSelect = document.getElementById('cleanup-session-select');
      
      // Get all logs to extract domains and sessions
      const allLogs = await this.storageManager.queryLogs({ limit: 10000 });
      
      // Update domain dropdown
      const domains = [...new Set(allLogs.map(log => log.domain))].sort();
      
      // Clear existing options (except first option)
      while (domainSelect.children.length > 1) {
        domainSelect.removeChild(domainSelect.lastChild);
      }
      
      domains.forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainSelect.appendChild(option);
      });
      
      // Update session dropdown (recent sessions only)
      const recentLogs = allLogs.slice(0, 1000);
      const sessions = [...new Set(recentLogs.map(log => log.sessionId))].sort();
      
      // Clear existing options (except first option)
      while (sessionSelect.children.length > 1) {
        sessionSelect.removeChild(sessionSelect.lastChild);
      }
      
      sessions.forEach(sessionId => {
        const sessionLogs = recentLogs.filter(log => log.sessionId === sessionId);
        const firstLog = sessionLogs[0];
        const sessionStart = new Date(firstLog.timestamp).toLocaleString();
        
        const option = document.createElement('option');
        option.value = sessionId;
        option.textContent = `${firstLog.domain} - ${sessionStart} (${sessionLogs.length} logs)`;
        sessionSelect.appendChild(option);
      });
      
    } catch (error) {
      console.error('Failed to update cleanup dropdowns:', error);
    }
  }

  /**
   * Clear all logs with confirmation
   */
  async clearAllLogs() {
    const confirmed = confirm(
      'Are you sure you want to delete ALL console logs? This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    try {
      this.showStorageLoading(true);
      
      const success = await this.storageManager.clearAllLogs();
      
      if (success) {
        this.showStorageMessage('All logs cleared successfully', 'success');
        await this.refreshStorageStats();
        
        // Refresh logs tab if it's active
        if (document.querySelector('.nav-btn[data-tab="logs"]').classList.contains('active')) {
          await this.loadLogs();
        }
      } else {
        this.showStorageMessage('Failed to clear logs', 'error');
      }
      
    } catch (error) {
      console.error('Failed to clear all logs:', error);
      this.showStorageMessage('Failed to clear logs: ' + error.message, 'error');
    } finally {
      this.showStorageLoading(false);
    }
  }

  /**
   * Clean up logs by age
   */
  async cleanupByAge() {
    const ageSelect = document.getElementById('cleanup-older-than');
    const days = parseInt(ageSelect.value);
    
    const confirmed = confirm(
      `Are you sure you want to delete all logs older than ${days} days? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      this.showStorageLoading(true);
      
      const maxAgeMs = days * 24 * 60 * 60 * 1000;
      const deletedCount = await this.storageManager.cleanupByAge(maxAgeMs);
      
      this.showStorageMessage(
        `Cleanup completed. ${deletedCount} log entries deleted.`,
        'success'
      );
      
      await this.refreshStorageStats();
      
      // Refresh logs tab if it's active
      if (document.querySelector('.nav-btn[data-tab="logs"]').classList.contains('active')) {
        await this.loadLogs();
      }
      
    } catch (error) {
      console.error('Failed to cleanup by age:', error);
      this.showStorageMessage('Failed to cleanup logs: ' + error.message, 'error');
    } finally {
      this.showStorageLoading(false);
    }
  }

  /**
   * Clean up logs by domain
   */
  async cleanupByDomain() {
    const domainSelect = document.getElementById('cleanup-domain-select');
    const domain = domainSelect.value;
    
    if (!domain) {
      this.showStorageMessage('Please select a domain to clean up', 'error');
      return;
    }
    
    const confirmed = confirm(
      `Are you sure you want to delete all logs for domain "${domain}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      this.showStorageLoading(true);
      
      const deletedCount = await this.storageManager.deleteLogsByDomain(domain);
      
      this.showStorageMessage(
        `Cleanup completed. ${deletedCount} log entries deleted for domain "${domain}".`,
        'success'
      );
      
      await this.refreshStorageStats();
      
      // Refresh logs tab if it's active
      if (document.querySelector('.nav-btn[data-tab="logs"]').classList.contains('active')) {
        await this.loadLogs();
      }
      
    } catch (error) {
      console.error('Failed to cleanup by domain:', error);
      this.showStorageMessage('Failed to cleanup logs: ' + error.message, 'error');
    } finally {
      this.showStorageLoading(false);
    }
  }

  /**
   * Clean up logs by session
   */
  async cleanupBySession() {
    const sessionSelect = document.getElementById('cleanup-session-select');
    const sessionId = sessionSelect.value;
    
    if (!sessionId) {
      this.showStorageMessage('Please select a session to clean up', 'error');
      return;
    }
    
    const sessionText = sessionSelect.options[sessionSelect.selectedIndex].text;
    const confirmed = confirm(
      `Are you sure you want to delete all logs for session "${sessionText}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      this.showStorageLoading(true);
      
      // Get logs for this session and delete them
      const sessionLogs = await this.storageManager.getLogsBySession(sessionId);
      const logIds = sessionLogs.map(log => log.id);
      const deletedCount = await this.storageManager.deleteLogs(logIds);
      
      this.showStorageMessage(
        `Cleanup completed. ${deletedCount} log entries deleted for selected session.`,
        'success'
      );
      
      await this.refreshStorageStats();
      
      // Refresh logs tab if it's active
      if (document.querySelector('.nav-btn[data-tab="logs"]').classList.contains('active')) {
        await this.loadLogs();
      }
      
    } catch (error) {
      console.error('Failed to cleanup by session:', error);
      this.showStorageMessage('Failed to cleanup logs: ' + error.message, 'error');
    } finally {
      this.showStorageLoading(false);
    }
  }

  /**
   * Perform automatic cleanup based on current settings
   */
  async performAutomaticCleanup() {
    try {
      this.showStorageLoading(true);
      
      // Get current settings for retention policy
      await this.extensionSettings.load();
      
      const retentionPolicy = {
        maxAgeMs: this.extensionSettings.retentionDays * 24 * 60 * 60 * 1000,
        maxSizeBytes: this.extensionSettings.maxStorageSize * 1024 * 1024,
        maxEntries: null // We'll use a reasonable default
      };
      
      const results = await this.storageManager.performCleanup(retentionPolicy);
      
      const totalDeleted = results.totalDeleted;
      let message = `Automatic cleanup completed. ${totalDeleted} log entries deleted.`;
      
      if (results.deletedByAge > 0) {
        message += ` (${results.deletedByAge} by age)`;
      }
      if (results.deletedBySize > 0) {
        message += ` (${results.deletedBySize} by size)`;
      }
      
      this.showStorageMessage(message, 'success');
      
      await this.refreshStorageStats();
      
      // Refresh logs tab if it's active
      if (document.querySelector('.nav-btn[data-tab="logs"]').classList.contains('active')) {
        await this.loadLogs();
      }
      
    } catch (error) {
      console.error('Failed to perform automatic cleanup:', error);
      this.showStorageMessage('Failed to perform automatic cleanup: ' + error.message, 'error');
    } finally {
      this.showStorageLoading(false);
    }
  }

  /**
   * Export storage report
   */
  async exportStorageReport() {
    try {
      this.showStorageLoading(true);
      
      const usage = await this.storageManager.calculateStorageUsage();
      const quota = await this.storageManager.getStorageQuota();
      const recommendations = await this.storageManager.getCleanupRecommendations();
      
      const report = {
        generatedAt: new Date().toISOString(),
        storageUsage: usage,
        browserQuota: quota,
        cleanupRecommendations: recommendations,
        domainBreakdown: Object.entries(usage.domainSizes).map(([domain, data]) => ({
          domain,
          logCount: data.count,
          sizeMB: Math.round((data.size / (1024 * 1024)) * 100) / 100
        })).sort((a, b) => b.sizeMB - a.sizeMB)
      };
      
      const reportJSON = JSON.stringify(report, null, 2);
      const blob = new Blob([reportJSON], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `console-log-storage-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showStorageMessage('Storage report exported successfully', 'success');
      
    } catch (error) {
      console.error('Failed to export storage report:', error);
      this.showStorageMessage('Failed to export storage report: ' + error.message, 'error');
    } finally {
      this.showStorageLoading(false);
    }
  }

  /**
   * Show storage loading state
   */
  showStorageLoading(show) {
    const storageSection = document.querySelector('.storage-section');
    
    if (show) {
      // Add loading overlay
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'storage-loading-overlay';
      loadingDiv.innerHTML = '<div class="loading">Updating storage information...</div>';
      storageSection.appendChild(loadingDiv);
    } else {
      // Remove loading overlay
      const loadingOverlay = storageSection.querySelector('.storage-loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.remove();
      }
    }
  }

  /**
   * Show storage management message
   */
  showStorageMessage(message, type) {
    const storageSection = document.querySelector('.storage-section');
    
    // Remove existing messages
    const existingMessage = storageSection.querySelector('.storage-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `storage-message storage-message-${type}`;
    messageDiv.textContent = message;
    
    // Insert at the top of the storage section
    storageSection.insertBefore(messageDiv, storageSection.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }

  /**
   * Add bulk operations interface for log management
   */
  async initializeBulkOperations() {
    // Add bulk selection functionality to logs display
    const logsTab = document.getElementById('logs-tab');
    
    // Add bulk operations toolbar
    const bulkToolbar = document.createElement('div');
    bulkToolbar.className = 'bulk-operations-toolbar';
    bulkToolbar.style.display = 'none';
    bulkToolbar.innerHTML = `
      <div class="bulk-operations-info">
        <span id="selected-count">0</span> logs selected
      </div>
      <div class="bulk-operations-actions">
        <button id="bulk-delete" class="btn-danger">Delete Selected</button>
        <button id="bulk-export" class="btn-secondary">Export Selected</button>
        <button id="bulk-clear-selection" class="btn-secondary">Clear Selection</button>
      </div>
    `;
    
    // Insert toolbar before logs display
    const logsDisplay = logsTab.querySelector('.logs-display');
    logsTab.insertBefore(bulkToolbar, logsDisplay);
    
    // Add event listeners for bulk operations
    document.getElementById('bulk-delete').addEventListener('click', () => this.bulkDeleteLogs());
    document.getElementById('bulk-export').addEventListener('click', () => this.bulkExportLogs());
    document.getElementById('bulk-clear-selection').addEventListener('click', () => this.clearBulkSelection());
    
    // Add select all checkbox to logs controls
    const logsControls = logsTab.querySelector('.logs-controls');
    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'bulk-select-controls';
    selectAllDiv.innerHTML = `
      <label class="bulk-select-all">
        <input type="checkbox" id="select-all-logs">
        Select all visible logs
      </label>
    `;
    logsControls.appendChild(selectAllDiv);
    
    document.getElementById('select-all-logs').addEventListener('change', (e) => {
      this.toggleSelectAllLogs(e.target.checked);
    });
  }

  /**
   * Toggle selection of all visible logs
   */
  toggleSelectAllLogs(selectAll) {
    const logEntries = document.querySelectorAll('.log-entry');
    const selectedCount = document.getElementById('selected-count');
    const bulkToolbar = document.querySelector('.bulk-operations-toolbar');
    
    logEntries.forEach(entry => {
      const checkbox = entry.querySelector('.log-select-checkbox');
      if (checkbox) {
        checkbox.checked = selectAll;
      } else if (selectAll) {
        // Add checkbox if it doesn't exist
        this.addLogSelectionCheckbox(entry);
      }
    });
    
    const count = selectAll ? logEntries.length : 0;
    selectedCount.textContent = count;
    bulkToolbar.style.display = count > 0 ? 'flex' : 'none';
  }

  /**
   * Add selection checkbox to a log entry
   */
  addLogSelectionCheckbox(logEntry) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'log-select-checkbox';
    checkbox.addEventListener('change', () => this.updateBulkSelectionCount());
    
    const logHeader = logEntry.querySelector('.log-header');
    logHeader.insertBefore(checkbox, logHeader.firstChild);
  }

  /**
   * Update bulk selection count and toolbar visibility
   */
  updateBulkSelectionCount() {
    const selectedCheckboxes = document.querySelectorAll('.log-select-checkbox:checked');
    const selectedCount = document.getElementById('selected-count');
    const bulkToolbar = document.querySelector('.bulk-operations-toolbar');
    const selectAllCheckbox = document.getElementById('select-all-logs');
    
    const count = selectedCheckboxes.length;
    selectedCount.textContent = count;
    bulkToolbar.style.display = count > 0 ? 'flex' : 'none';
    
    // Update select all checkbox state
    const totalCheckboxes = document.querySelectorAll('.log-select-checkbox');
    if (count === 0) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = false;
    } else if (count === totalCheckboxes.length) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = true;
    } else {
      selectAllCheckbox.indeterminate = true;
    }
  }

  /**
   * Delete selected logs in bulk
   */
  async bulkDeleteLogs() {
    const selectedCheckboxes = document.querySelectorAll('.log-select-checkbox:checked');
    const count = selectedCheckboxes.length;
    
    if (count === 0) return;
    
    const confirmed = confirm(
      `Are you sure you want to delete ${count} selected log entries? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      this.showLoading(true);
      
      // Get log IDs from selected entries
      const logIds = Array.from(selectedCheckboxes).map(checkbox => {
        const logEntry = checkbox.closest('.log-entry');
        return logEntry.dataset.logId;
      });
      
      const deletedCount = await this.storageManager.deleteLogs(logIds);
      
      this.showStorageMessage(
        `Bulk delete completed. ${deletedCount} log entries deleted.`,
        'success'
      );
      
      // Refresh displays
      await this.loadLogs();
      await this.refreshStorageStats();
      
      // Clear selection
      this.clearBulkSelection();
      
    } catch (error) {
      console.error('Failed to bulk delete logs:', error);
      this.showError('Failed to delete selected logs: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Export selected logs in bulk
   */
  async bulkExportLogs() {
    const selectedCheckboxes = document.querySelectorAll('.log-select-checkbox:checked');
    const count = selectedCheckboxes.length;
    
    if (count === 0) return;
    
    try {
      // Get log IDs from selected entries
      const logIds = Array.from(selectedCheckboxes).map(checkbox => {
        const logEntry = checkbox.closest('.log-entry');
        return logEntry.dataset.logId;
      });
      
      // Get the actual log entries
      const selectedLogs = [];
      for (const logId of logIds) {
        const log = await this.storageManager.getLog(logId);
        if (log) {
          selectedLogs.push(log);
        }
      }
      
      // Export as JSON (could be enhanced to support other formats)
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalEntries: selectedLogs.length,
          format: 'JSON',
          exportType: 'bulk_selection',
          version: '1.0'
        },
        logs: selectedLogs
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `console-logs-bulk-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showStorageMessage(`${count} selected logs exported successfully`, 'success');
      
    } catch (error) {
      console.error('Failed to bulk export logs:', error);
      this.showError('Failed to export selected logs: ' + error.message);
    }
  }

  /**
   * Clear bulk selection
   */
  clearBulkSelection() {
    const checkboxes = document.querySelectorAll('.log-select-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-logs');
    const bulkToolbar = document.querySelector('.bulk-operations-toolbar');
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    bulkToolbar.style.display = 'none';
    
    document.getElementById('selected-count').textContent = '0';
  }
  /**
   * Load uninstall cleanup settings
   */
  async loadUninstallCleanupSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_UNINSTALL_CLEANUP_PREFERENCE'
      });
      
      if (response && !response.error) {
        document.getElementById('cleanup-on-uninstall').checked = response.cleanupOnUninstall;
        
        // Show confirmation dialog if needed
        if (response.needsUserConfirmation) {
          this.showUninstallCleanupConfirmationDialog();
        }
      }
    } catch (error) {
      console.error('Failed to load uninstall cleanup settings:', error);
    }
  }

  /**
   * Update uninstall cleanup preference
   */
  async updateUninstallCleanupPreference() {
    try {
      const cleanupOnUninstall = document.getElementById('cleanup-on-uninstall').checked;
      
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_UNINSTALL_CLEANUP_PREFERENCE',
        data: { cleanupOnUninstall }
      });
      
      if (response && response.success) {
        this.showSettingsSuccess('Uninstall cleanup preference updated successfully');
      } else {
        this.showSettingsError('Failed to update uninstall cleanup preference');
      }
    } catch (error) {
      console.error('Failed to update uninstall cleanup preference:', error);
      this.showSettingsError('Failed to update uninstall cleanup preference');
    }
  }

  /**
   * Perform manual cleanup of all extension data
   */
  async performManualCleanup() {
    const confirmed = confirm(
      'Are you sure you want to delete ALL extension data?\n\n' +
      'This will permanently delete:\n' +
      '• All stored console logs\n' +
      '• All extension settings\n' +
      '• All website-specific configurations\n\n' +
      'This action cannot be undone!'
    );
    
    if (!confirmed) return;
    
    // Double confirmation for such a destructive action
    const doubleConfirmed = confirm(
      'This is your final warning!\n\n' +
      'Clicking OK will PERMANENTLY DELETE all extension data.\n' +
      'Are you absolutely sure you want to continue?'
    );
    
    if (!doubleConfirmed) return;
    
    try {
      this.showSettingsSaving(true);
      
      const response = await chrome.runtime.sendMessage({
        type: 'MANUAL_UNINSTALL_CLEANUP'
      });
      
      if (response && response.success) {
        this.showSettingsSuccess('All extension data has been cleared successfully');
        
        // Reload the page after a short delay to show fresh state
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        this.showSettingsError('Failed to clear extension data');
      }
    } catch (error) {
      console.error('Failed to perform manual cleanup:', error);
      this.showSettingsError('Failed to clear extension data: ' + error.message);
    } finally {
      this.showSettingsSaving(false);
    }
  }

  /**
   * Show uninstall cleanup confirmation dialog
   */
  showUninstallCleanupConfirmationDialog() {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.className = 'uninstall-cleanup-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h3>Data Cleanup Preference</h3>
          <p>What should happen to your console logs and settings if you uninstall this extension?</p>
          
          <div class="cleanup-options">
            <label class="cleanup-option-item">
              <input type="radio" name="cleanup-choice" value="cleanup" checked>
              <div class="option-content">
                <strong>Delete all data (Recommended)</strong>
                <small>All console logs and settings will be permanently removed when you uninstall the extension. This protects your privacy.</small>
              </div>
            </label>
            
            <label class="cleanup-option-item">
              <input type="radio" name="cleanup-choice" value="keep">
              <div class="option-content">
                <strong>Keep data</strong>
                <small>Console logs and settings will remain on your computer even after uninstalling. You can access them if you reinstall the extension later.</small>
              </div>
            </label>
          </div>
          
          <div class="modal-actions">
            <button id="confirm-cleanup-choice" class="btn-primary">Save Preference</button>
            <button id="cancel-cleanup-choice" class="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('confirm-cleanup-choice').addEventListener('click', () => {
      const selectedChoice = document.querySelector('input[name="cleanup-choice"]:checked').value;
      const cleanupOnUninstall = selectedChoice === 'cleanup';
      
      // Update the checkbox
      document.getElementById('cleanup-on-uninstall').checked = cleanupOnUninstall;
      
      // Save the preference
      this.updateUninstallCleanupPreference().then(() => {
        document.body.removeChild(modal);
      });
    });
    
    document.getElementById('cancel-cleanup-choice').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    // Close on overlay click
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.body.removeChild(modal);
      }
    });
  }

  /**
   * Handle storage retry events
   */
  async handleStorageRetry(detail) {
    const { operation, errorId } = detail;
    
    try {
      switch (operation) {
        case 'loadLogs':
          await this.loadLogs();
          this.notificationManager.success('Logs loaded successfully after retry');
          break;
        case 'saveSettings':
          await this.saveSettings();
          this.notificationManager.success('Settings saved successfully after retry');
          break;
        case 'exportLogs':
          await this.exportLogs();
          this.notificationManager.success('Export completed successfully after retry');
          break;
        default:
          this.notificationManager.info('Retry operation completed');
      }
    } catch (error) {
      this.errorHandler.handleError(error, {
        type: 'retry_failed',
        operation,
        originalErrorId: errorId
      });
    }
  }

  /**
   * Perform force cleanup when storage is full
   */
  async performForceCleanup() {
    const loadingId = this.notificationManager.loading('Performing emergency cleanup...');
    
    try {
      // Perform aggressive cleanup
      const retentionPolicy = {
        maxAgeMs: 7 * 24 * 60 * 60 * 1000, // Keep only 7 days
        maxSizeBytes: 50 * 1024 * 1024, // Limit to 50MB
        maxEntries: 1000 // Keep max 1000 entries
      };
      
      const results = await this.storageManager.performCleanup(retentionPolicy);
      
      this.notificationManager.hide(loadingId);
      this.notificationManager.success(
        `Emergency cleanup completed. ${results.totalDeleted} entries removed.`,
        { duration: 8000 }
      );
      
      // Refresh all displays
      await this.refreshStorageStats();
      if (document.querySelector('.nav-btn[data-tab="logs"]').classList.contains('active')) {
        await this.loadLogs();
      }
      
    } catch (error) {
      this.notificationManager.hide(loadingId);
      this.errorHandler.handleError(error, {
        type: 'force_cleanup_error',
        context: 'storage_management'
      });
    }
  }

  /**
   * Switch to storage tab
   */
  switchToStorageTab() {
    const storageTab = document.querySelector('.nav-btn[data-tab="storage"]');
    if (storageTab) {
      storageTab.click();
    }
  }

  /**
   * Reset all extension data
   */
  async resetExtensionData() {
    const loadingId = this.notificationManager.loading('Resetting extension data...');
    
    try {
      // Clear all logs
      await this.storageManager.clearAllLogs();
      
      // Reset settings to defaults
      await this.extensionSettings.resetToDefaults();
      await this.extensionSettings.save();
      
      // Clear Chrome storage
      if (chrome.storage) {
        await chrome.storage.local.clear();
        await chrome.storage.sync.clear();
      }
      
      this.notificationManager.hide(loadingId);
      this.notificationManager.success(
        'Extension data has been reset. Please refresh the page.',
        { duration: 0 }
      );
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      this.notificationManager.hide(loadingId);
      this.errorHandler.handleError(error, {
        type: 'reset_data_error',
        context: 'data_management'
      });
    }
  }

  /**
   * Override existing error/success methods to use notification system
   */
  showError(message) {
    this.notificationManager.error(message);
  }

  showSuccess(message) {
    this.notificationManager.success(message);
  }

  showSettingsError(message) {
    this.notificationManager.error(message, { title: 'Settings Error' });
  }

  showSettingsSuccess(message) {
    this.notificationManager.success(message, { title: 'Settings Updated' });
  }

  showExportError(message) {
    this.notificationManager.error(message, { title: 'Export Error' });
  }

  showExportSuccess(message) {
    this.notificationManager.success(message, { title: 'Export Complete' });
  }

  showStorageError(message) {
    this.notificationManager.error(message, { title: 'Storage Error' });
  }

  showStorageSuccess(message) {
    this.notificationManager.success(message, { title: 'Storage Operation Complete' });
  }

  /**
   * Check if a log entry is from the extension itself
   * @param {Object} log - Log entry to check
   * @returns {boolean} True if log is from extension
   */
  isExtensionLog(log) {
    // Check if message contains extension-specific patterns
    const extensionPatterns = [
      /Console Log Extension/i,
      /Extension Error Details/i,
      /Background:/i,
      /Popup:/i,
      /Content script/i,
      /Options page/i,
      /console\.log.*Extension/i,
      /chrome-extension:/i
    ];
    
    // Check message content
    if (extensionPatterns.some(pattern => pattern.test(log.message))) {
      return true;
    }
    
    // Check if URL is extension URL
    if (log.url && log.url.includes('chrome-extension://')) {
      return true;
    }
    
    // Check if domain indicates extension context
    if (log.domain && (log.domain === 'chrome-extension' || log.domain.includes('extension'))) {
      return true;
    }
    
    return false;
  }

  /**
   * Enhanced error handling for async operations
   */
  async safeAsyncOperation(operation, context, fallbackValue = null) {
    return await this.errorHandler.wrapAsync(operation, context, fallbackValue);
  }

  /**
   * Enhanced error handling for sync operations
   */
  safeSyncOperation(operation, context, fallbackValue = null) {
    return this.errorHandler.wrapSync(operation, context, fallbackValue);
  }
}

// Initialize the options page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Console Log Extension options page loaded');
  
  // Check if required models are available
  if (typeof StorageManager === 'undefined' || 
      typeof FilterCriteria === 'undefined' || 
      typeof ExtensionSettings === 'undefined' || 
      typeof KeywordFilters === 'undefined' ||
      typeof ExportManager === 'undefined' ||
      typeof SensitiveDataDetector === 'undefined') {
    console.error('Required models not loaded. Make sure to include model scripts in HTML.');
    return;
  }

  // Create and initialize the options manager
  window.optionsManager = new OptionsPageManager();
});
