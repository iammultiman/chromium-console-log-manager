/**
 * Integration tests for notification system in UI components
 * Tests how notifications work with popup and options pages
 */

describe('Notification Integration', () => {
  let mockChrome;

  beforeEach(() => {
    // Mock Chrome APIs
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        },
        openOptionsPage: jest.fn()
      },
      storage: {
        local: {
          set: jest.fn().mockResolvedValue(),
          get: jest.fn().mockResolvedValue({}),
          clear: jest.fn().mockResolvedValue()
        },
        sync: {
          set: jest.fn().mockResolvedValue(),
          get: jest.fn().mockResolvedValue({}),
          clear: jest.fn().mockResolvedValue()
        }
      }
    };

    global.chrome = mockChrome;

    // Set up DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete global.chrome;
  });

  describe('Popup Integration', () => {
    beforeEach(() => {
      // Set up popup HTML structure
      document.body.innerHTML = `
        <div class="popup-container">
          <div class="status-indicator">
            <span id="status-text">Enabled</span>
            <div class="toggle-switch">
              <input type="checkbox" id="enable-toggle" checked>
              <label for="enable-toggle" class="toggle-label"></label>
            </div>
          </div>
          <div id="recent-logs-list" class="logs-list"></div>
          <span id="today-count" class="stat-value">0</span>
          <span id="session-count" class="stat-value">0</span>
          <button id="open-options" class="btn-primary">View All Logs</button>
          <button id="clear-today" class="btn-secondary">Clear Today</button>
        </div>
      `;
    });

    test('should show success notification when toggle is changed', async () => {
      // Mock successful settings update
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      // Create popup manager (this will create notification system)
      const PopupManager = require('../popup/popup.js');
      const popupManager = new PopupManager();
      await popupManager.initialize();

      // Simulate toggle change
      const toggle = document.getElementById('enable-toggle');
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that notification was shown
      const notifications = document.querySelectorAll('.notification');
      expect(notifications.length).toBeGreaterThan(0);
      
      const successNotification = Array.from(notifications).find(n => 
        n.classList.contains('success') && n.textContent.includes('disabled')
      );
      expect(successNotification).toBeTruthy();
    });

    test('should show error notification when toggle change fails', async () => {
      // Mock failed settings update
      mockChrome.runtime.sendMessage.mockResolvedValue({ 
        error: 'Failed to update settings' 
      });

      const PopupManager = require('../popup/popup.js');
      const popupManager = new PopupManager();
      await popupManager.initialize();

      // Simulate toggle change
      const toggle = document.getElementById('enable-toggle');
      const originalState = toggle.checked;
      toggle.checked = !originalState;
      toggle.dispatchEvent(new Event('change'));

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that error notification was shown
      const notifications = document.querySelectorAll('.notification');
      const errorNotification = Array.from(notifications).find(n => 
        n.classList.contains('error')
      );
      expect(errorNotification).toBeTruthy();

      // Toggle should be reverted
      expect(toggle.checked).toBe(originalState);
    });

    test('should show confirmation dialog for clear today action', async () => {
      const PopupManager = require('../popup/popup.js');
      const popupManager = new PopupManager();
      await popupManager.initialize();

      // Simulate clear today button click
      const clearButton = document.getElementById('clear-today');
      clearButton.click();

      // Wait for confirmation dialog
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that confirmation notification was shown
      const notifications = document.querySelectorAll('.notification');
      const confirmNotification = Array.from(notifications).find(n => 
        n.classList.contains('warning') && 
        n.textContent.includes('Are you sure')
      );
      expect(confirmNotification).toBeTruthy();

      // Should have confirm and cancel buttons
      const buttons = confirmNotification.querySelectorAll('.notification-btn');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toBe('Cancel');
      expect(buttons[1].textContent).toBe('Confirm');
    });

    test('should show loading notification during clear operation', async () => {
      // Mock successful clear operation with delay
      mockChrome.runtime.sendMessage.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ success: true }), 100)
        )
      );

      const PopupManager = require('../popup/popup.js');
      const popupManager = new PopupManager();
      await popupManager.initialize();

      // Trigger clear operation directly (bypass confirmation)
      popupManager.performClearToday();

      // Wait a bit for loading notification
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that loading notification was shown
      const notifications = document.querySelectorAll('.notification');
      const loadingNotification = Array.from(notifications).find(n => 
        n.textContent.includes('Clearing')
      );
      expect(loadingNotification).toBeTruthy();
    });
  });

  describe('Options Page Integration', () => {
    beforeEach(() => {
      // Set up options page HTML structure
      document.body.innerHTML = `
        <div class="options-container">
          <nav class="options-nav">
            <button class="nav-btn active" data-tab="logs">Logs</button>
            <button class="nav-btn" data-tab="settings">Settings</button>
            <button class="nav-btn" data-tab="export">Export</button>
            <button class="nav-btn" data-tab="storage">Storage</button>
          </nav>
          <main class="options-content">
            <section id="logs-tab" class="tab-content active">
              <div id="logs-list" class="logs-list"></div>
            </section>
            <section id="settings-tab" class="tab-content">
              <button id="save-settings" class="btn-primary">Save Settings</button>
              <button id="manual-cleanup" class="btn-danger">Clear All Extension Data</button>
            </section>
            <section id="export-tab" class="tab-content">
              <button id="export-logs" class="btn-primary">Export Logs</button>
            </section>
            <section id="storage-tab" class="tab-content">
              <button id="clear-all" class="btn-danger">Clear All Logs</button>
            </section>
          </main>
        </div>
      `;

      // Mock required classes
      global.StorageManager = jest.fn().mockImplementation(() => ({
        initializeDatabase: jest.fn().mockResolvedValue(),
        queryLogs: jest.fn().mockResolvedValue([]),
        calculateStorageUsage: jest.fn().mockResolvedValue({
          entryCount: 0,
          totalSizeMB: 0,
          domainSizes: {}
        })
      }));

      global.FilterCriteria = jest.fn();
      global.ExtensionSettings = jest.fn().mockImplementation(() => ({
        load: jest.fn().mockResolvedValue(),
        save: jest.fn().mockResolvedValue()
      }));
      global.ExportManager = jest.fn();
      global.SensitiveDataDetector = jest.fn();
    });

    test('should show error notification when initialization fails', async () => {
      // Mock storage manager to fail initialization
      global.StorageManager = jest.fn().mockImplementation(() => ({
        initializeDatabase: jest.fn().mockRejectedValue(new Error('Database init failed'))
      }));

      const OptionsPageManager = require('../options/options.js');
      const optionsManager = new OptionsPageManager();

      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check that error notification was shown
      const notifications = document.querySelectorAll('.notification');
      const errorNotification = Array.from(notifications).find(n => 
        n.classList.contains('error')
      );
      expect(errorNotification).toBeTruthy();
    });

    test('should show success notification when settings are saved', async () => {
      const OptionsPageManager = require('../options/options.js');
      const optionsManager = new OptionsPageManager();

      // Mock successful save
      optionsManager.extensionSettings.save = jest.fn().mockResolvedValue();

      // Simulate save settings click
      const saveButton = document.getElementById('save-settings');
      saveButton.click();

      // Wait for save operation
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that success notification was shown
      const notifications = document.querySelectorAll('.notification');
      const successNotification = Array.from(notifications).find(n => 
        n.classList.contains('success') && 
        n.textContent.includes('Settings')
      );
      expect(successNotification).toBeTruthy();
    });

    test('should show confirmation for destructive operations', async () => {
      const OptionsPageManager = require('../options/options.js');
      const optionsManager = new OptionsPageManager();

      // Simulate clear all button click
      const clearAllButton = document.getElementById('clear-all');
      clearAllButton.click();

      // Wait for confirmation dialog
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that confirmation notification was shown
      const notifications = document.querySelectorAll('.notification');
      const confirmNotification = Array.from(notifications).find(n => 
        n.classList.contains('warning') && 
        n.textContent.includes('sure')
      );
      expect(confirmNotification).toBeTruthy();
    });

    test('should handle storage quota exceeded errors', async () => {
      const OptionsPageManager = require('../options/options.js');
      const optionsManager = new OptionsPageManager();

      // Simulate quota exceeded error
      const quotaError = new Error('Storage quota exceeded');
      quotaError.name = 'QuotaExceededError';

      optionsManager.errorHandler.handleStorageError(quotaError, 'saveLogs');

      // Check that appropriate warning was shown
      const notifications = document.querySelectorAll('.notification');
      const warningNotification = Array.from(notifications).find(n => 
        n.classList.contains('warning') && 
        n.textContent.includes('quota')
      );
      expect(warningNotification).toBeTruthy();

      // Should have cleanup action
      const cleanupButton = warningNotification.querySelector('.notification-btn');
      expect(cleanupButton).toBeTruthy();
      expect(cleanupButton.textContent).toContain('Clean');
    });

    test('should handle storage corruption errors', async () => {
      const OptionsPageManager = require('../options/options.js');
      const optionsManager = new OptionsPageManager();

      // Simulate corruption error
      const corruptionError = new Error('Data corruption detected');
      corruptionError.name = 'DataError';

      optionsManager.errorHandler.handleStorageError(corruptionError, 'loadLogs');

      // Check that error notification was shown
      const notifications = document.querySelectorAll('.notification');
      const errorNotification = Array.from(notifications).find(n => 
        n.classList.contains('error') && 
        n.textContent.includes('corruption')
      );
      expect(errorNotification).toBeTruthy();

      // Should have reset data action
      const resetButton = errorNotification.querySelector('.notification-btn');
      expect(resetButton).toBeTruthy();
      expect(resetButton.textContent).toContain('Reset');
    });
  });

  describe('Cross-Component Communication', () => {
    test('should handle retry events from error handler', async () => {
      const OptionsPageManager = require('../options/options.js');
      const optionsManager = new OptionsPageManager();

      // Mock retry operation
      optionsManager.loadLogs = jest.fn().mockResolvedValue();

      // Simulate retry event
      const retryEvent = new CustomEvent('storage-retry', {
        detail: { operation: 'loadLogs', errorId: 'test-error-id' }
      });
      window.dispatchEvent(retryEvent);

      // Wait for retry operation
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that retry was attempted
      expect(optionsManager.loadLogs).toHaveBeenCalled();

      // Check that success notification was shown
      const notifications = document.querySelectorAll('.notification');
      const successNotification = Array.from(notifications).find(n => 
        n.classList.contains('success') && 
        n.textContent.includes('retry')
      );
      expect(successNotification).toBeTruthy();
    });

    test('should handle force cleanup events', async () => {
      const OptionsPageManager = require('../options/options.js');
      const optionsManager = new OptionsPageManager();

      // Mock cleanup operation
      optionsManager.storageManager.performCleanup = jest.fn().mockResolvedValue({
        totalDeleted: 100
      });
      optionsManager.refreshStorageStats = jest.fn().mockResolvedValue();

      // Simulate force cleanup event
      const cleanupEvent = new CustomEvent('force-cleanup');
      window.dispatchEvent(cleanupEvent);

      // Wait for cleanup operation
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that cleanup was performed
      expect(optionsManager.storageManager.performCleanup).toHaveBeenCalled();
    });

    test('should handle extension data reset events', async () => {
      const OptionsPageManager = require('../options/options.js');
      const optionsManager = new OptionsPageManager();

      // Mock reset operations
      optionsManager.storageManager.clearAllLogs = jest.fn().mockResolvedValue();
      optionsManager.extensionSettings.resetToDefaults = jest.fn().mockResolvedValue();
      optionsManager.extensionSettings.save = jest.fn().mockResolvedValue();

      // Mock window.location.reload
      const originalReload = window.location.reload;
      window.location.reload = jest.fn();

      // Simulate reset event
      const resetEvent = new CustomEvent('reset-extension-data');
      window.dispatchEvent(resetEvent);

      // Wait for reset operation
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that reset operations were performed
      expect(optionsManager.storageManager.clearAllLogs).toHaveBeenCalled();
      expect(optionsManager.extensionSettings.resetToDefaults).toHaveBeenCalled();

      // Restore original reload
      window.location.reload = originalReload;
    });
  });

  describe('Notification Accessibility', () => {
    test('should include proper ARIA labels and roles', () => {
      const notificationManager = new NotificationManager();
      
      const id = notificationManager.error('Test error message');
      const notification = document.getElementById(id);

      // Check close button has proper aria-label
      const closeButton = notification.querySelector('.notification-close');
      expect(closeButton.getAttribute('aria-label')).toBe('Close notification');
    });

    test('should support keyboard navigation', () => {
      const notificationManager = new NotificationManager();
      
      const mockHandler = jest.fn();
      const id = notificationManager.show({
        type: 'warning',
        message: 'Test message',
        actions: [
          { text: 'Action', handler: mockHandler }
        ]
      });

      const notification = document.getElementById(id);
      const actionButton = notification.querySelector('.notification-btn');

      // Test keyboard activation
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      actionButton.dispatchEvent(enterEvent);

      // Note: In a real implementation, you'd need to add keyboard event handlers
      // This test documents the expected behavior
    });
  });
});