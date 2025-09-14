/**
 * Background Script for Console Log Extension
 * Handles message processing, storage coordination, and session management
 */

// Import required classes using importScripts (service worker compatible)
importScripts('../models/StorageManager.js');
importScripts('../models/ExtensionSettings.js');
importScripts('../models/LogEntry.js');
importScripts('../models/KeywordFilters.js');
importScripts('../models/ErrorHandler.js');
importScripts('../models/NotificationManager.js');

// Classes are now available globally (attached to self in service worker context)
console.log('Background: Classes loaded:', {
  StorageManager: typeof StorageManager,
  ExtensionSettings: typeof ExtensionSettings,
  LogEntry: typeof LogEntry,
  KeywordFilters: typeof KeywordFilters,
  ErrorHandler: typeof ErrorHandler,
  NotificationManager: typeof NotificationManager
});


// Initialize storage manager and settings
let storageManager;
let extensionSettings;
let errorHandler;
let isInitialized = false;
let activeSessions = new Map(); // Track active tab sessions
let messageQueue = []; // Queue for batch processing
let processingTimer = null;

/**
 * Initialize the background script
 */
async function initialize() {
  if (isInitialized) {
    return;
  }
  
  try {
    // Initialize error handling (background scripts don't have DOM, so no notification manager)
    errorHandler = new ErrorHandler(null);
    errorHandler.setDebugMode(true); // Enable debug mode for background script
    
    // Initialize storage manager with error handling
    storageManager = new StorageManager();
    await errorHandler.wrapAsync(
      () => storageManager.initializeDatabase(),
      { type: 'database_init', context: 'background_init' }
    );
    
    // Set up error handling for storage manager
    storageManager.setErrorHandler(errorHandler);
    
    // Load extension settings with error handling
    extensionSettings = new ExtensionSettings();
    await errorHandler.wrapAsync(
      () => extensionSettings.load(),
      { type: 'settings_load', context: 'background_init' }
    );
    
    // Initialize keyword filters if they exist in settings
    const settingsData = extensionSettings.toJSON();
    if (settingsData.keywordFilters && typeof KeywordFilters !== 'undefined') {
      extensionSettings.keywordFilters = KeywordFilters.fromJSON(settingsData.keywordFilters);
    } else if (typeof KeywordFilters !== 'undefined') {
      // Initialize empty keyword filters if none exist
      extensionSettings.keywordFilters = new KeywordFilters();
    }
    
    isInitialized = true;
    console.log('Console Log Extension background script initialized');
    
    // Set up periodic cleanup
    schedulePeriodicCleanup();
    
  } catch (error) {
    console.error('Failed to initialize background script:', error);
    throw error;
  }
}

/**
 * Message listener for content script communications
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => {
      console.error('Message handling error:', error);
      sendResponse({ error: error.message });
    });
  
  // Return true to indicate async response
  return true;
});

/**
 * Handle incoming messages from content scripts and UI components
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender information
 * @returns {Promise<Object>} Response object
 */
async function handleMessage(message, sender) {
  try {
    // Ensure background script is initialized
    if (!isInitialized) {
      await errorHandler.wrapAsync(
        () => initialize(),
        { type: 'background_init', context: 'message_handler' }
      );
    }
    
    // Validate message structure
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message format');
    }
    
    const { type, data } = message;
    
    if (!type) {
      throw new Error('Message type is required');
    }
    
    // Handle each message type with error wrapping
    switch (type) {
      case 'LOG_CAPTURED':
        console.log('Background: Received LOG_CAPTURED message', data);
        return await errorHandler.wrapAsync(
          () => processLogMessage(data, sender),
          { type: 'log_processing', context: 'message_handler' },
          { error: 'Failed to process log message' }
        );
        
      case 'GET_SETTINGS':
        return await errorHandler.wrapAsync(
          () => ({ settings: extensionSettings.toJSON() }),
          { type: 'settings_get', context: 'message_handler' },
          { settings: extensionSettings.getDefaults() }
        );
        
      case 'UPDATE_SETTINGS':
        return await errorHandler.wrapAsync(
          () => updateSettings(data),
          { type: 'settings_update', context: 'message_handler' },
          { error: 'Failed to update settings' }
        );
        
      case 'GET_WEBSITE_SETTINGS':
        return await errorHandler.wrapAsync(
          () => getWebsiteSettings(data.domain),
          { type: 'website_settings_get', context: 'message_handler' },
          { settings: {} }
        );
        
      case 'UPDATE_WEBSITE_SETTINGS':
        return await errorHandler.wrapAsync(
          () => updateWebsiteSettings(data.domain, data.settings),
          { type: 'website_settings_update', context: 'message_handler' },
          { error: 'Failed to update website settings' }
        );
        
      case 'REMOVE_WEBSITE_SETTINGS':
        return await errorHandler.wrapAsync(
          () => removeWebsiteSettings(data.domain),
          { type: 'website_settings_remove', context: 'message_handler' },
          { error: 'Failed to remove website settings' }
        );
        
      case 'GET_LOGS':
        return await errorHandler.wrapAsync(
          () => getLogs(data),
          { type: 'logs_get', context: 'message_handler' },
          { logs: [], total: 0 }
        );
        
      case 'GET_LOGS_COUNT':
        return await errorHandler.wrapAsync(
          () => getLogsCount(data),
          { type: 'logs_count', context: 'message_handler' },
          { success: true, count: 0 }
        );
        
      case 'DELETE_LOGS':
        return await errorHandler.wrapAsync(
          () => deleteLogs(data),
          { type: 'logs_delete', context: 'message_handler' },
          { error: 'Failed to delete logs' }
        );
        
      case 'CLEAR_DOMAIN_LOGS':
        return await errorHandler.wrapAsync(
          () => clearDomainLogs(data.domain),
          { type: 'domain_logs_clear', context: 'message_handler' },
          { error: 'Failed to clear domain logs' }
        );
        
      case 'GET_STORAGE_STATUS':
        return await errorHandler.wrapAsync(
          () => getStorageStatus(),
          { type: 'storage_status_get', context: 'message_handler' },
          { usage: 0, quota: 0, status: 'unknown' }
        );
        
      case 'PERFORM_CLEANUP':
        return await errorHandler.wrapAsync(
          () => performCleanup(data),
          { type: 'cleanup_perform', context: 'message_handler' },
          { error: 'Failed to perform cleanup' }
        );
        
      case 'CONTENT_SCRIPT_ERROR':
        return await errorHandler.wrapAsync(
          () => handleContentScriptError(data, sender),
          { type: 'content_script_error', context: 'message_handler' },
          { acknowledged: true }
        );
      
    case 'GET_SESSION_INFO':
      return await getSessionInfo(data.tabId);
      
    case 'SYNC_SETTINGS':
      return await syncSettings();
      
    case 'RESET_SETTINGS':
      return await resetSettings();
      
    case 'GET_RECENT_LOGS':
      return await errorHandler.wrapAsync(
        () => getRecentLogs(data),
        { type: 'recent_logs_get', context: 'message_handler' },
        { logs: [] }
      );
      
    case 'GET_STATISTICS':
      return await errorHandler.wrapAsync(
        () => getStatistics(),
        { type: 'statistics_get', context: 'message_handler' },
        { statistics: { todayCount: 0, sessionCount: 0 } }
      );
      
    case 'CLEAR_TODAY_LOGS':
      return await errorHandler.wrapAsync(
        () => clearTodayLogs(),
        { type: 'clear_today_logs', context: 'message_handler' },
        { error: 'Failed to clear today logs' }
      );
      
    case 'PING':
      return { pong: true, timestamp: Date.now() };
      
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
  } catch (error) {
    // Handle any errors that occur during message processing
    const errorId = errorHandler.handleError(error, {
      type: 'message_handler_error',
      messageType: message?.type,
      context: 'background_message_handler'
    });
    
    return {
      error: error.message,
      errorId,
      timestamp: Date.now()
    };
  }
}

/**
 * Process captured log message from content script
 * @param {Object} logData - Raw log data from content script
 * @param {Object} sender - Message sender information
 * @returns {Promise<Object>} Processing result
 */
async function processLogMessage(logData, sender) {
  try {
    // Validate input data
    if (!logData) {
      throw new Error('Log data is required');
    }
    
    if (!logData.level || !logData.message) {
      throw new Error('Log level and message are required');
    }
    
    // Validate sender and tab information
    if (!sender || !sender.tab || typeof sender.tab.id !== 'number') {
      throw new Error('Invalid sender information - tab ID required');
    }
    
    const tabId = sender.tab.id;
    const url = sender.tab.url || logData.url || 'unknown';
    
    // Validate log level
    const validLevels = ['log', 'error', 'warn', 'info'];
    if (!validLevels.includes(logData.level)) {
      throw new Error(`Invalid log level: ${logData.level}`);
    }
    
    // Create LogEntry instance with validation
    const logEntry = new LogEntry(
      logData.level,
      logData.message,
      logData.args || [],
      url,
      tabId
    );
    
    // Apply global filters
    if (!await shouldCaptureLog(logEntry)) {
      return { captured: false, reason: 'filtered' };
    }
    
    // Update session tracking
    updateSessionTracking(tabId, url, logEntry.sessionId);
    
    // Add to processing queue for batch processing
    messageQueue.push(logEntry.toJSON());
    
    // Schedule batch processing if not already scheduled
    if (!processingTimer) {
      processingTimer = setTimeout(processBatchedLogs, 100); // 100ms batch window
    }
    
    return { captured: true, logId: logEntry.id };
    
  } catch (error) {
    console.error('Error processing log message:', error);
    return { captured: false, error: error.message };
  }
}

/**
 * Process batched log messages for efficient storage
 */
async function processBatchedLogs() {
  if (messageQueue.length === 0) {
    processingTimer = null;
    return;
  }
  
  try {
    const logsToProcess = [...messageQueue];
    messageQueue = [];
    processingTimer = null;
    
    // Save logs in batch
    await storageManager.saveLogs(logsToProcess);
    
    // Check if cleanup is needed
    const storageStatus = await storageManager.checkStorageStatus();
    if (storageStatus.needsCleanup) {
      await performAutomaticCleanup();
    }
    
  } catch (error) {
    console.error('Error processing batched logs:', error);
    // Re-queue failed logs for retry
    messageQueue.unshift(...messageQueue);
  }
}

/**
 * Determine if a log should be captured based on settings and filters
 * @param {LogEntry} logEntry - Log entry to evaluate
 * @returns {Promise<boolean>} True if log should be captured
 */
async function shouldCaptureLog(logEntry) {
  // Check if capture is globally enabled
  if (!extensionSettings.captureEnabled) {
    return false;
  }
  
  // Check if log level is enabled
  if (!extensionSettings.logLevels.includes(logEntry.level)) {
    return false;
  }
  
  // Check domain-specific settings
  if (!extensionSettings.isCaptureEnabledForDomain(logEntry.domain)) {
    return false;
  }
  
  // Apply global keyword filters if configured
  if (extensionSettings.keywordFilters && extensionSettings.keywordFilters.hasActiveFilters()) {
    if (!extensionSettings.keywordFilters.shouldCapture(logEntry.message)) {
      return false;
    }
  }
  
  // Apply website-specific keyword filters if configured
  const websiteSettings = extensionSettings.getWebsiteSettings(logEntry.domain);
  if (websiteSettings && websiteSettings.keywordFilters) {
    const websiteFilters = KeywordFilters.fromJSON(websiteSettings.keywordFilters);
    if (websiteFilters.hasActiveFilters() && !websiteFilters.shouldCapture(logEntry.message)) {
      return false;
    }
  }
  
  // Apply sensitive data filtering if enabled
  if (extensionSettings.sensitiveDataFiltering) {
    if (containsSensitiveData(logEntry.message)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Update session tracking for active tabs
 * @param {number} tabId - Chrome tab ID
 * @param {string} url - Tab URL
 * @param {string} sessionId - Session ID
 */
function updateSessionTracking(tabId, url, sessionId) {
  const domain = extractDomain(url);
  
  // Check if session already exists for this tab
  const existingSession = activeSessions.get(tabId);
  
  if (existingSession && existingSession.domain === domain) {
    // Update existing session activity
    existingSession.lastActivity = Date.now();
  } else {
    // Create new session
    activeSessions.set(tabId, {
      sessionId,
      domain,
      url,
      startTime: Date.now(),
      lastActivity: Date.now(),
      logCount: 0
    });
  }
  
  // Increment log count
  const session = activeSessions.get(tabId);
  session.logCount = (session.logCount || 0) + 1;
}

/**
 * Get session information for a tab
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<Object>} Session information
 */
async function getSessionInfo(tabId) {
  const session = activeSessions.get(tabId);
  if (!session) {
    return { active: false };
  }
  
  // Get log count for this session
  const logs = await storageManager.getLogsBySession(session.sessionId);
  
  return {
    active: true,
    sessionId: session.sessionId,
    domain: session.domain,
    startTime: session.startTime,
    lastActivity: session.lastActivity,
    logCount: logs.length
  };
}

/**
 * Update extension settings
 * @param {Object} newSettings - New settings data
 * @returns {Promise<Object>} Update result
 */
async function updateSettings(newSettings) {
  try {
    // Validate settings before applying
    validateSettings(newSettings);
    
    // Apply settings
    extensionSettings.fromJSON(newSettings);
    
    // Initialize keyword filters if provided
    if (newSettings.keywordFilters) {
      extensionSettings.keywordFilters = KeywordFilters.fromJSON(newSettings.keywordFilters);
    }
    
    // Save to chrome.storage.sync
    await extensionSettings.save();
    
    // Broadcast settings update to all tabs
    broadcastSettingsUpdate();
    
    return { 
      success: true, 
      settings: extensionSettings.toJSON(),
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }
}

/**
 * Update website-specific settings
 * @param {string} domain - Domain name
 * @param {Object} websiteSettings - Website-specific settings
 * @returns {Promise<Object>} Update result
 */
async function updateWebsiteSettings(domain, websiteSettings) {
  try {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Valid domain is required');
    }
    
    // Validate website settings
    validateWebsiteSettings(websiteSettings);
    
    // Update website settings
    extensionSettings.setWebsiteSettings(domain, websiteSettings);
    
    // Save to storage
    await extensionSettings.save();
    
    // Broadcast settings update to relevant tabs
    broadcastWebsiteSettingsUpdate(domain);
    
    return { 
      success: true, 
      domain,
      settings: websiteSettings,
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to update website settings: ${error.message}`);
  }
}

/**
 * Get website-specific settings
 * @param {string} domain - Domain name
 * @returns {Promise<Object>} Website settings
 */
async function getWebsiteSettings(domain) {
  try {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Valid domain is required');
    }
    
    const settings = extensionSettings.getWebsiteSettings(domain);
    return {
      domain,
      settings: settings || getDefaultWebsiteSettings(),
      hasCustomSettings: !!settings
    };
  } catch (error) {
    throw new Error(`Failed to get website settings: ${error.message}`);
  }
}

/**
 * Remove website-specific settings
 * @param {string} domain - Domain name
 * @returns {Promise<Object>} Removal result
 */
async function removeWebsiteSettings(domain) {
  try {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Valid domain is required');
    }
    
    const hadSettings = extensionSettings.getWebsiteSettings(domain) !== null;
    extensionSettings.removeWebsiteSettings(domain);
    
    // Save to storage
    await extensionSettings.save();
    
    // Broadcast settings update to relevant tabs
    broadcastWebsiteSettingsUpdate(domain);
    
    return { 
      success: true, 
      domain,
      hadSettings,
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to remove website settings: ${error.message}`);
  }
}

/**
 * Get logs with filtering and pagination
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Logs and metadata
 */
async function getLogs(options = {}) {
  try {
    const logs = await storageManager.queryLogs(options);
    const totalCount = await storageManager.getLogCount();
    const storageUsage = await storageManager.calculateStorageUsage();
    
    return {
      logs,
      totalCount,
      storageUsage,
      hasMore: logs.length === (options.limit || 1000)
    };
  } catch (error) {
    throw new Error(`Failed to get logs: ${error.message}`);
  }
}

/**
 * Get count of logs matching filter criteria
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Count result
 */
async function getLogsCount(options = {}) {
  try {
    const logs = await storageManager.queryLogs(options);
    return {
      success: true,
      count: logs.length
    };
  } catch (error) {
    throw new Error(`Failed to get logs count: ${error.message}`);
  }
}

/**
 * Delete specific logs by IDs
 * @param {Array} logIds - Array of log IDs to delete
 * @returns {Promise<Object>} Deletion result
 */
async function deleteLogs(logIds) {
  try {
    const deletedCount = await storageManager.deleteLogs(logIds);
    return { deletedCount };
  } catch (error) {
    throw new Error(`Failed to delete logs: ${error.message}`);
  }
}

/**
 * Clear all logs for a specific domain
 * @param {string} domain - Domain to clear logs for
 * @returns {Promise<Object>} Deletion result
 */
async function clearDomainLogs(domain) {
  try {
    const deletedCount = await storageManager.deleteLogsByDomain(domain);
    return { deletedCount, domain };
  } catch (error) {
    throw new Error(`Failed to clear domain logs: ${error.message}`);
  }
}

/**
 * Get current storage status and usage information
 * @returns {Promise<Object>} Storage status
 */
async function getStorageStatus() {
  try {
    const storageStatus = await storageManager.checkStorageStatus();
    const recommendations = await storageManager.getCleanupRecommendations();
    
    return {
      ...storageStatus,
      recommendations
    };
  } catch (error) {
    throw new Error(`Failed to get storage status: ${error.message}`);
  }
}

/**
 * Perform manual cleanup with specified policies
 * @param {Object} cleanupOptions - Cleanup configuration
 * @returns {Promise<Object>} Cleanup results
 */
async function performCleanup(cleanupOptions) {
  try {
    const retentionPolicy = {
      maxAgeMs: cleanupOptions.maxAgeDays ? cleanupOptions.maxAgeDays * 24 * 60 * 60 * 1000 : null,
      maxSizeBytes: cleanupOptions.maxSizeMB ? cleanupOptions.maxSizeMB * 1024 * 1024 : null,
      maxEntries: cleanupOptions.maxEntries || null
    };
    
    const results = await storageManager.performCleanup(retentionPolicy);
    return results;
  } catch (error) {
    throw new Error(`Failed to perform cleanup: ${error.message}`);
  }
}

/**
 * Perform automatic cleanup based on current settings
 */
async function performAutomaticCleanup() {
  try {
    const retentionPolicy = {
      maxAgeMs: extensionSettings.retentionDays * 24 * 60 * 60 * 1000,
      maxSizeBytes: extensionSettings.maxStorageSize * 1024 * 1024,
      maxEntries: null // No entry limit for automatic cleanup
    };
    
    const results = await storageManager.performCleanup(retentionPolicy);
    console.log('Automatic cleanup completed:', results);
  } catch (error) {
    console.error('Automatic cleanup failed:', error);
  }
}

/**
 * Schedule periodic cleanup operations
 */
function schedulePeriodicCleanup() {
  // Run cleanup every hour
  setInterval(async () => {
    try {
      await performAutomaticCleanup();
    } catch (error) {
      console.error('Periodic cleanup failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
}

/**
 * Broadcast settings update to all content scripts
 */
function broadcastSettingsUpdate() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SETTINGS_UPDATED',
        settings: extensionSettings.toJSON(),
        timestamp: Date.now()
      }).catch(() => {
        // Ignore errors for tabs without content scripts
      });
    });
  });
}

/**
 * Broadcast website-specific settings update to relevant tabs
 * @param {string} domain - Domain to update
 */
function broadcastWebsiteSettingsUpdate(domain) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && extractDomain(tab.url) === domain) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'WEBSITE_SETTINGS_UPDATED',
          domain,
          settings: extensionSettings.getWebsiteSettings(domain),
          timestamp: Date.now()
        }).catch(() => {
          // Ignore errors for tabs without content scripts
        });
      }
    });
  });
}

/**
 * Validate extension settings
 * @param {Object} settings - Settings to validate
 * @throws {Error} If settings are invalid
 */
function validateSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new Error('Settings must be an object');
  }
  
  // Validate captureEnabled
  if (settings.captureEnabled !== undefined && typeof settings.captureEnabled !== 'boolean') {
    throw new Error('captureEnabled must be a boolean');
  }
  
  // Validate logLevels
  if (settings.logLevels !== undefined) {
    if (!Array.isArray(settings.logLevels)) {
      throw new Error('logLevels must be an array');
    }
    const validLevels = ['log', 'error', 'warn', 'info'];
    const invalidLevels = settings.logLevels.filter(level => !validLevels.includes(level));
    if (invalidLevels.length > 0) {
      throw new Error(`Invalid log levels: ${invalidLevels.join(', ')}`);
    }
  }
  
  // Validate retentionDays
  if (settings.retentionDays !== undefined) {
    const days = parseInt(settings.retentionDays);
    if (isNaN(days) || days < 1 || days > 365) {
      throw new Error('retentionDays must be a number between 1 and 365');
    }
  }
  
  // Validate maxStorageSize
  if (settings.maxStorageSize !== undefined) {
    const size = parseInt(settings.maxStorageSize);
    if (isNaN(size) || size < 1 || size > 10000) {
      throw new Error('maxStorageSize must be a number between 1 and 10000 MB');
    }
  }
  
  // Validate sensitiveDataFiltering
  if (settings.sensitiveDataFiltering !== undefined && typeof settings.sensitiveDataFiltering !== 'boolean') {
    throw new Error('sensitiveDataFiltering must be a boolean');
  }
  
  // Validate keywordFilters
  if (settings.keywordFilters !== undefined) {
    validateKeywordFilters(settings.keywordFilters);
  }
  
  // Validate websiteSettings
  if (settings.websiteSettings !== undefined) {
    if (typeof settings.websiteSettings !== 'object') {
      throw new Error('websiteSettings must be an object');
    }
    Object.entries(settings.websiteSettings).forEach(([domain, websiteSettings]) => {
      validateWebsiteSettings(websiteSettings, domain);
    });
  }
}

/**
 * Validate keyword filters
 * @param {Object} keywordFilters - Keyword filters to validate
 * @throws {Error} If filters are invalid
 */
function validateKeywordFilters(keywordFilters) {
  if (!keywordFilters || typeof keywordFilters !== 'object') {
    throw new Error('keywordFilters must be an object');
  }
  
  if (keywordFilters.include !== undefined && !Array.isArray(keywordFilters.include)) {
    throw new Error('keywordFilters.include must be an array');
  }
  
  if (keywordFilters.exclude !== undefined && !Array.isArray(keywordFilters.exclude)) {
    throw new Error('keywordFilters.exclude must be an array');
  }
  
  if (keywordFilters.caseSensitive !== undefined && typeof keywordFilters.caseSensitive !== 'boolean') {
    throw new Error('keywordFilters.caseSensitive must be a boolean');
  }
}

/**
 * Validate website-specific settings
 * @param {Object} websiteSettings - Website settings to validate
 * @param {string} domain - Domain name (for error messages)
 * @throws {Error} If settings are invalid
 */
function validateWebsiteSettings(websiteSettings, domain = 'unknown') {
  if (!websiteSettings || typeof websiteSettings !== 'object') {
    throw new Error(`Website settings for ${domain} must be an object`);
  }
  
  if (websiteSettings.enabled !== undefined && typeof websiteSettings.enabled !== 'boolean') {
    throw new Error(`Website settings enabled for ${domain} must be a boolean`);
  }
  
  if (websiteSettings.keywordFilters !== undefined) {
    validateKeywordFilters(websiteSettings.keywordFilters);
  }
  
  if (websiteSettings.logLevels !== undefined) {
    if (!Array.isArray(websiteSettings.logLevels)) {
      throw new Error(`Website settings logLevels for ${domain} must be an array`);
    }
    const validLevels = ['log', 'error', 'warn', 'info'];
    const invalidLevels = websiteSettings.logLevels.filter(level => !validLevels.includes(level));
    if (invalidLevels.length > 0) {
      throw new Error(`Invalid log levels for ${domain}: ${invalidLevels.join(', ')}`);
    }
  }
}

/**
 * Get default website settings
 * @returns {Object} Default website settings
 */
function getDefaultWebsiteSettings() {
  return {
    enabled: true,
    logLevels: ['log', 'error', 'warn', 'info'],
    keywordFilters: {
      include: [],
      exclude: [],
      caseSensitive: false
    }
  };
}

/**
 * Sync settings from chrome.storage.sync
 * @returns {Promise<Object>} Sync result
 */
async function syncSettings() {
  try {
    // Reload settings from storage
    await extensionSettings.load();
    
    // Initialize keyword filters if they exist
    const settingsData = extensionSettings.toJSON();
    if (settingsData.keywordFilters) {
      extensionSettings.keywordFilters = KeywordFilters.fromJSON(settingsData.keywordFilters);
    }
    
    // Broadcast updated settings to all tabs
    broadcastSettingsUpdate();
    
    return { 
      success: true, 
      settings: extensionSettings.toJSON(),
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to sync settings: ${error.message}`);
  }
}

/**
 * Reset settings to defaults
 * @returns {Promise<Object>} Reset result
 */
async function resetSettings() {
  try {
    // Reset to defaults
    extensionSettings.reset();
    
    // Initialize default keyword filters
    if (typeof KeywordFilters !== 'undefined') {
      extensionSettings.keywordFilters = new KeywordFilters();
    }
    
    // Save to storage
    await extensionSettings.save();
    
    // Broadcast updated settings to all tabs
    broadcastSettingsUpdate();
    
    return { 
      success: true, 
      settings: extensionSettings.toJSON(),
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to reset settings: ${error.message}`);
  }
}

/**
 * Check if message contains sensitive data patterns
 * @param {string} message - Message to check
 * @returns {boolean} True if sensitive data detected
 */
function containsSensitiveData(message) {
  const sensitivePatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/, // Credit card
    /\b(?:password|pwd|pass|token|key|secret|auth)\s*[:=]\s*\S+/i, // Credentials
    /\b[A-Za-z0-9]{20,}\b/, // Long tokens/keys
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\bsk_[a-zA-Z0-9_]{24,}\b/, // Stripe secret key
    /\bAKIA[0-9A-Z]{16}\b/, // AWS access key
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(message));
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string} Domain name
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Handle tab events for session management
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up session tracking when tab is closed
  activeSessions.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Update session when tab URL changes
  if (changeInfo.url && activeSessions.has(tabId)) {
    const session = activeSessions.get(tabId);
    const newDomain = extractDomain(changeInfo.url);
    
    // If domain changed, create new session
    if (session.domain !== newDomain) {
      activeSessions.delete(tabId);
    }
  }
});

/**
 * Validate tab ID format
 * @param {*} tabId - Tab ID to validate
 * @returns {boolean} True if valid
 */
function isValidTabId(tabId) {
  return typeof tabId === 'number' && tabId > 0;
}

/**
 * Validate log level
 * @param {string} level - Log level to validate
 * @returns {boolean} True if valid
 */
function isValidLogLevel(level) {
  const validLevels = ['log', 'error', 'warn', 'info'];
  return validLevels.includes(level);
}

/**
 * Get all active sessions
 * @returns {Array} Array of active session objects
 */
function getActiveSessions() {
  return Array.from(activeSessions.entries()).map(([tabId, session]) => ({
    tabId,
    ...session
  }));
}

/**
 * Clean up inactive sessions (older than 1 hour with no activity)
 */
function cleanupInactiveSessions() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [tabId, session] of activeSessions.entries()) {
    if (session.lastActivity < oneHourAgo) {
      activeSessions.delete(tabId);
    }
  }
}

/**
 * Get recent logs for popup display
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Recent logs response
 */
async function getRecentLogs(options = {}) {
  try {
    const limit = options.limit || 10;
    
    // Query recent logs from storage (get more than needed to sort and limit)
    const logs = await storageManager.queryLogs({
      limit: limit * 2, // Get more to ensure we have enough after filtering
      startTime: 0,
      endTime: Date.now()
    });
    
    // Sort by timestamp descending and limit
    const sortedLogs = (logs || [])
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return { logs: sortedLogs };
    
  } catch (error) {
    console.error('Error getting recent logs:', error);
    return { error: error.message };
  }
}

/**
 * Get statistics for popup display
 * @returns {Promise<Object>} Statistics response
 */
async function getStatistics() {
  try {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = todayStart.getTime();
    
    // Get today's logs and count them
    const todayLogs = await storageManager.queryLogs({
      startTime: todayStartTimestamp,
      endTime: now,
      limit: 10000 // Large limit to get all today's logs
    });
    
    const todayCount = (todayLogs || []).length;
    const sessionCount = activeSessions.size;
    
    return {
      statistics: {
        todayCount,
        sessionCount
      }
    };
    
  } catch (error) {
    console.error('Error getting statistics:', error);
    return { error: error.message };
  }
}

/**
 * Clear today's logs
 * @returns {Promise<Object>} Clear operation response
 */
async function clearTodayLogs() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = todayStart.getTime();
    const now = Date.now();
    
    // First, get today's logs to get their IDs
    const todayLogs = await storageManager.queryLogs({
      startTime: todayStartTimestamp,
      endTime: now,
      limit: 10000 // Large limit to get all today's logs
    });
    
    if (!todayLogs || todayLogs.length === 0) {
      return { deleted: 0 };
    }
    
    // Extract IDs and delete logs
    const logIds = todayLogs.map(log => log.id);
    const deletedCount = await storageManager.deleteLogs(logIds);
    
    return { deleted: deletedCount };
    
  } catch (error) {
    console.error('Error clearing today\'s logs:', error);
    return { error: error.message };
  }
}

/**
 * Handle content script errors
 * @param {Object} errorData - Error data from content script
 * @param {Object} sender - Message sender information
 * @returns {Promise<Object>} Response object
 */
async function handleContentScriptError(errorData, sender) {
  try {
    // Log the content script error with context
    const error = new Error(errorData.message);
    error.stack = errorData.stack;
    
    const context = {
      type: 'content_script_error',
      context: errorData.context,
      url: errorData.url,
      sessionId: errorData.sessionId,
      tabId: sender.tab?.id,
      timestamp: errorData.timestamp
    };
    
    // Handle the error through our error handler
    const errorId = errorHandler.handleError(error, context, false); // Don't show to user from background
    
    // Log to console for debugging
    console.error(`Content script error [${errorId}]:`, {
      context: errorData.context,
      message: errorData.message,
      url: errorData.url,
      tabId: sender.tab?.id
    });
    
    // If too many errors from this tab, consider disabling the interceptor
    const tabId = sender.tab?.id;
    if (tabId && isValidTabId(tabId)) {
      const session = activeSessions.get(tabId);
      if (session) {
        session.errorCount = (session.errorCount || 0) + 1;
        session.lastError = Date.now();
        
        // If too many errors, disable interceptor for this tab
        if (session.errorCount > 10) {
          console.warn(`Too many content script errors for tab ${tabId}, suggesting interceptor disable`);
          
          // Send message to content script to disable interceptor
          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'DISABLE_INTERCEPTOR',
              reason: 'too_many_errors'
            });
          } catch (sendError) {
            // Tab might be closed or unresponsive
            console.warn(`Could not send disable message to tab ${tabId}:`, sendError.message);
          }
        }
      }
    }
    
    return {
      acknowledged: true,
      errorId,
      timestamp: Date.now()
    };
    
  } catch (handlingError) {
    console.error('Error handling content script error:', handlingError);
    return {
      acknowledged: false,
      error: handlingError.message
    };
  }
}

/**
 * Export functions for testing
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleMessage,
    processLogMessage,
    shouldCaptureLog,
    updateSessionTracking,
    getSessionInfo,
    updateSettings,
    updateWebsiteSettings,
    getWebsiteSettings,
    removeWebsiteSettings,
    syncSettings,
    resetSettings,
    getLogs,
    deleteLogs,
    clearDomainLogs,
    getStorageStatus,
    performCleanup,
    containsSensitiveData,
    extractDomain,
    isValidTabId,
    isValidLogLevel,
    getActiveSessions,
    cleanupInactiveSessions,
    validateSettings,
    validateKeywordFilters,
    validateWebsiteSettings,
    getDefaultWebsiteSettings,
    broadcastSettingsUpdate,
    broadcastWebsiteSettingsUpdate,
    getRecentLogs,
    getStatistics,
    clearTodayLogs,
    handleContentScriptError,
    initialize
  };
}

// Initialize when background script loads
initialize().catch(error => {
  console.error('Failed to initialize background script:', error);
});

/**
 * Extension uninstall cleanup functionality
 */

// Listen for extension uninstall events
chrome.runtime.onSuspend.addListener(() => {
  // This event fires when the extension is about to be unloaded
  // We can use this to perform cleanup operations
  handleExtensionUnload();
});

// Listen for extension startup to check for uninstall cleanup settings
chrome.runtime.onStartup.addListener(() => {
  checkUninstallCleanupSettings();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default uninstall cleanup preference
    setDefaultUninstallCleanupSettings();
  }
});

/**
 * Handle extension unload (potential uninstall)
 */
async function handleExtensionUnload() {
  try {
    // Check if user wants to retain data on uninstall
    const uninstallSettings = await getUninstallCleanupSettings();
    
    if (uninstallSettings.cleanupOnUninstall) {
      // Perform data cleanup
      await performUninstallCleanup();
      console.log('Extension data cleaned up on uninstall');
    } else {
      // Just log that data is being retained
      console.log('Extension data retained on uninstall per user preference');
    }
  } catch (error) {
    console.error('Error during extension unload cleanup:', error);
  }
}

/**
 * Perform cleanup operations when extension is uninstalled
 */
async function performUninstallCleanup() {
  try {
    // Clear all stored logs
    if (storageManager) {
      await storageManager.clearAllLogs();
    }
    
    // Clear extension settings from chrome.storage.sync
    await new Promise((resolve, reject) => {
      chrome.storage.sync.clear((result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
    
    // Clear local storage
    await new Promise((resolve, reject) => {
      chrome.storage.local.clear((result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
    
    console.log('All extension data cleared successfully');
  } catch (error) {
    console.error('Error during uninstall cleanup:', error);
    throw error;
  }
}

/**
 * Get uninstall cleanup settings
 * @returns {Promise<Object>} Uninstall cleanup settings
 */
async function getUninstallCleanupSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['uninstallCleanupSettings'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        const settings = result.uninstallCleanupSettings || {
          cleanupOnUninstall: true, // Default to cleanup
          confirmationShown: false
        };
        resolve(settings);
      }
    });
  });
}

/**
 * Set uninstall cleanup settings
 * @param {Object} settings - Cleanup settings
 * @returns {Promise<void>}
 */
async function setUninstallCleanupSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ uninstallCleanupSettings: settings }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Set default uninstall cleanup settings on first install
 */
async function setDefaultUninstallCleanupSettings() {
  try {
    const defaultSettings = {
      cleanupOnUninstall: true,
      confirmationShown: false,
      showUninstallDialog: true
    };
    
    await setUninstallCleanupSettings(defaultSettings);
    console.log('Default uninstall cleanup settings configured');
  } catch (error) {
    console.error('Error setting default uninstall cleanup settings:', error);
  }
}

/**
 * Check and handle uninstall cleanup settings on startup
 */
async function checkUninstallCleanupSettings() {
  try {
    const settings = await getUninstallCleanupSettings();
    
    // If this is the first time and user hasn't been asked about cleanup preference
    if (!settings.confirmationShown && settings.showUninstallDialog) {
      // We can't show dialogs from background script, so we'll set a flag
      // that the options page can check and show the dialog
      await setUninstallCleanupSettings({
        ...settings,
        needsUserConfirmation: true
      });
    }
  } catch (error) {
    console.error('Error checking uninstall cleanup settings:', error);
  }
}

/**
 * Update uninstall cleanup preference
 * @param {boolean} cleanupOnUninstall - Whether to cleanup on uninstall
 * @returns {Promise<Object>} Update result
 */
async function updateUninstallCleanupPreference(cleanupOnUninstall) {
  try {
    const currentSettings = await getUninstallCleanupSettings();
    const newSettings = {
      ...currentSettings,
      cleanupOnUninstall,
      confirmationShown: true,
      needsUserConfirmation: false
    };
    
    await setUninstallCleanupSettings(newSettings);
    
    return {
      success: true,
      settings: newSettings,
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to update uninstall cleanup preference: ${error.message}`);
  }
}

/**
 * Get current uninstall cleanup preference for UI
 * @returns {Promise<Object>} Current settings
 */
async function getUninstallCleanupPreference() {
  try {
    const settings = await getUninstallCleanupSettings();
    return {
      cleanupOnUninstall: settings.cleanupOnUninstall,
      needsUserConfirmation: settings.needsUserConfirmation || false,
      confirmationShown: settings.confirmationShown || false
    };
  } catch (error) {
    throw new Error(`Failed to get uninstall cleanup preference: ${error.message}`);
  }
}

/**
 * Manually trigger uninstall cleanup (for testing or user request)
 * @returns {Promise<Object>} Cleanup result
 */
async function manualUninstallCleanup() {
  try {
    await performUninstallCleanup();
    return {
      success: true,
      message: 'All extension data has been cleared',
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to perform manual cleanup: ${error.message}`);
  }
}

// Add new message handlers for uninstall cleanup
const originalHandleMessage = handleMessage;
handleMessage = async function(message, sender) {
  const { type, data } = message;
  
  switch (type) {
    case 'GET_UNINSTALL_CLEANUP_PREFERENCE':
      return await getUninstallCleanupPreference();
      
    case 'UPDATE_UNINSTALL_CLEANUP_PREFERENCE':
      return await updateUninstallCleanupPreference(data.cleanupOnUninstall);
      
    case 'MANUAL_UNINSTALL_CLEANUP':
      return await manualUninstallCleanup();
      
    default:
      // Fall back to original handler
      return await originalHandleMessage(message, sender);
  }
};

/**
 * Show uninstall confirmation dialog (to be called from options page)
 * @returns {Promise<boolean>} User's choice
 */
async function showUninstallConfirmationDialog() {
  // This function would be called from the options page UI
  // since background scripts can't show dialogs directly
  const settings = await getUninstallCleanupSettings();
  
  if (settings.needsUserConfirmation) {
    // Return true to indicate dialog should be shown
    return true;
  }
  
  return false;
}

/**
 * Export uninstall cleanup functions for testing
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ...module.exports,
    handleExtensionUnload,
    performUninstallCleanup,
    getUninstallCleanupSettings,
    setUninstallCleanupSettings,
    updateUninstallCleanupPreference,
    getUninstallCleanupPreference,
    manualUninstallCleanup,
    showUninstallConfirmationDialog
  };
}
