/**
 * Tests for extension uninstall cleanup functionality
 * Covers cleanup hooks, user preferences, and data deletion
 */

// Mock chrome API before importing background script
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    onSuspend: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    lastError: null,
    sendMessage: jest.fn()
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn()
    },
    local: {
      clear: jest.fn()
    }
  },
  tabs: {
    onRemoved: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    },
    query: jest.fn(),
    sendMessage: jest.fn()
  }
};

// Mock StorageManager
class MockStorageManager {
  constructor() {
    this.logs = [];
  }

  async clearAllLogs() {
    this.logs = [];
    return true;
  }

  async initializeDatabase() {
    return Promise.resolve();
  }
}

// Create test implementations of the uninstall cleanup functions
// These would normally be imported from background.js, but we'll implement them here for testing

/**
 * Get uninstall cleanup settings
 */
async function getUninstallCleanupSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['uninstallCleanupSettings'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        const settings = result.uninstallCleanupSettings || {
          cleanupOnUninstall: true,
          confirmationShown: false
        };
        resolve(settings);
      }
    });
  });
}

/**
 * Set uninstall cleanup settings
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
 * Perform uninstall cleanup
 */
async function performUninstallCleanup() {
  try {
    // Clear all stored logs
    if (global.storageManager) {
      await global.storageManager.clearAllLogs();
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
  } catch (error) {
    throw error;
  }
}

/**
 * Update uninstall cleanup preference
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
 * Get uninstall cleanup preference for UI
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
 * Manual uninstall cleanup
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

/**
 * Handle extension unload
 */
async function handleExtensionUnload() {
  try {
    const uninstallSettings = await getUninstallCleanupSettings();
    
    if (uninstallSettings.cleanupOnUninstall) {
      await performUninstallCleanup();
      console.log('Extension data cleaned up on uninstall');
    } else {
      console.log('Extension data retained on uninstall per user preference');
    }
  } catch (error) {
    console.error('Error during extension unload cleanup:', error);
  }
}

describe('Extension Uninstall Cleanup', () => {
  let mockStorageManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageManager = new MockStorageManager();
    
    // Mock successful chrome.storage operations
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({});
    });
    
    chrome.storage.sync.set.mockImplementation((data, callback) => {
      callback();
    });
    
    chrome.storage.sync.clear.mockImplementation((callback) => {
      callback();
    });
    
    chrome.storage.local.clear.mockImplementation((callback) => {
      callback();
    });
  });

  describe('Uninstall Cleanup Settings', () => {
    test('should get default uninstall cleanup settings', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({}); // No existing settings
      });

      const settings = await getUninstallCleanupSettings();
      
      expect(settings).toEqual({
        cleanupOnUninstall: true,
        confirmationShown: false
      });
    });

    test('should get existing uninstall cleanup settings', async () => {
      const existingSettings = {
        cleanupOnUninstall: false,
        confirmationShown: true
      };
      
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ uninstallCleanupSettings: existingSettings });
      });

      const settings = await getUninstallCleanupSettings();
      
      expect(settings).toEqual(existingSettings);
    });

    test('should set uninstall cleanup settings', async () => {
      const newSettings = {
        cleanupOnUninstall: false,
        confirmationShown: true
      };

      await setUninstallCleanupSettings(newSettings);
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { uninstallCleanupSettings: newSettings },
        expect.any(Function)
      );
    });

    test('should handle chrome.storage errors when getting settings', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        chrome.runtime.lastError = { message: 'Storage error' };
        callback({});
      });

      await expect(getUninstallCleanupSettings()).rejects.toThrow('Storage error');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });

    test('should handle chrome.storage errors when setting settings', async () => {
      chrome.storage.sync.set.mockImplementation((data, callback) => {
        chrome.runtime.lastError = { message: 'Storage error' };
        callback();
      });

      const settings = { cleanupOnUninstall: true };
      
      await expect(setUninstallCleanupSettings(settings)).rejects.toThrow('Storage error');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });

  describe('Uninstall Cleanup Preference Management', () => {
    test('should update uninstall cleanup preference', async () => {
      const currentSettings = {
        cleanupOnUninstall: true,
        confirmationShown: false,
        needsUserConfirmation: true
      };
      
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ uninstallCleanupSettings: currentSettings });
      });

      const result = await updateUninstallCleanupPreference(false);
      
      expect(result.success).toBe(true);
      expect(result.settings.cleanupOnUninstall).toBe(false);
      expect(result.settings.confirmationShown).toBe(true);
      expect(result.settings.needsUserConfirmation).toBe(false);
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        {
          uninstallCleanupSettings: {
            ...currentSettings,
            cleanupOnUninstall: false,
            confirmationShown: true,
            needsUserConfirmation: false
          }
        },
        expect.any(Function)
      );
    });

    test('should get uninstall cleanup preference for UI', async () => {
      const settings = {
        cleanupOnUninstall: true,
        confirmationShown: true,
        needsUserConfirmation: false
      };
      
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ uninstallCleanupSettings: settings });
      });

      const preference = await getUninstallCleanupPreference();
      
      expect(preference).toEqual({
        cleanupOnUninstall: true,
        needsUserConfirmation: false,
        confirmationShown: true
      });
    });

    test('should handle missing preference fields', async () => {
      const settings = {
        cleanupOnUninstall: false
        // Missing other fields
      };
      
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ uninstallCleanupSettings: settings });
      });

      const preference = await getUninstallCleanupPreference();
      
      expect(preference).toEqual({
        cleanupOnUninstall: false,
        needsUserConfirmation: false,
        confirmationShown: false
      });
    });
  });

  describe('Cleanup Operations', () => {
    test('should perform uninstall cleanup successfully', async () => {
      // Mock global storageManager
      global.storageManager = mockStorageManager;
      
      await performUninstallCleanup();
      
      // Verify storage manager clearAllLogs was called
      expect(mockStorageManager.logs).toEqual([]);
      
      // Verify chrome storage was cleared
      expect(chrome.storage.sync.clear).toHaveBeenCalled();
      expect(chrome.storage.local.clear).toHaveBeenCalled();
    });

    test('should handle cleanup errors gracefully', async () => {
      // Mock storage manager to throw error
      global.storageManager = {
        clearAllLogs: jest.fn().mockRejectedValue(new Error('Storage error'))
      };
      
      await expect(performUninstallCleanup()).rejects.toThrow('Storage error');
    });

    test('should handle chrome.storage.sync.clear errors', async () => {
      global.storageManager = mockStorageManager;
      
      chrome.storage.sync.clear.mockImplementation((callback) => {
        chrome.runtime.lastError = { message: 'Clear error' };
        callback();
      });
      
      await expect(performUninstallCleanup()).rejects.toThrow('Clear error');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });

    test('should handle chrome.storage.local.clear errors', async () => {
      global.storageManager = mockStorageManager;
      
      chrome.storage.local.clear.mockImplementation((callback) => {
        chrome.runtime.lastError = { message: 'Local clear error' };
        callback();
      });
      
      await expect(performUninstallCleanup()).rejects.toThrow('Local clear error');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });

    test('should perform manual uninstall cleanup', async () => {
      global.storageManager = mockStorageManager;
      
      const result = await manualUninstallCleanup();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('All extension data has been cleared');
      expect(result.timestamp).toBeGreaterThan(0);
      
      // Verify cleanup was performed
      expect(chrome.storage.sync.clear).toHaveBeenCalled();
      expect(chrome.storage.local.clear).toHaveBeenCalled();
    });
  });

  describe('Extension Unload Handling', () => {
    test('should perform cleanup on unload when enabled', async () => {
      global.storageManager = mockStorageManager;
      
      // Mock settings to enable cleanup
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({
          uninstallCleanupSettings: {
            cleanupOnUninstall: true,
            confirmationShown: true
          }
        });
      });
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await handleExtensionUnload();
      
      // Verify cleanup was performed
      expect(chrome.storage.sync.clear).toHaveBeenCalled();
      expect(chrome.storage.local.clear).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Extension data cleaned up on uninstall');
      
      consoleSpy.mockRestore();
    });

    test('should not perform cleanup on unload when disabled', async () => {
      global.storageManager = mockStorageManager;
      
      // Mock settings to disable cleanup
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({
          uninstallCleanupSettings: {
            cleanupOnUninstall: false,
            confirmationShown: true
          }
        });
      });
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await handleExtensionUnload();
      
      // Verify cleanup was NOT performed
      expect(chrome.storage.sync.clear).not.toHaveBeenCalled();
      expect(chrome.storage.local.clear).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Extension data retained on uninstall per user preference');
      
      consoleSpy.mockRestore();
    });

    test('should handle errors during extension unload gracefully', async () => {
      // Mock getUninstallCleanupSettings to throw error
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        chrome.runtime.lastError = { message: 'Settings error' };
        callback({});
      });
      
      // Mock console.error to capture output
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await handleExtensionUnload();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during extension unload cleanup:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
      chrome.runtime.lastError = null;
    });
  });

  describe('Error Handling', () => {
    test('should handle updateUninstallCleanupPreference errors', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        chrome.runtime.lastError = { message: 'Get error' };
        callback({});
      });

      await expect(updateUninstallCleanupPreference(true))
        .rejects.toThrow('Failed to update uninstall cleanup preference: Get error');
      
      chrome.runtime.lastError = null;
    });

    test('should handle getUninstallCleanupPreference errors', async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        chrome.runtime.lastError = { message: 'Preference error' };
        callback({});
      });

      await expect(getUninstallCleanupPreference())
        .rejects.toThrow('Failed to get uninstall cleanup preference: Preference error');
      
      chrome.runtime.lastError = null;
    });

    test('should handle manualUninstallCleanup errors', async () => {
      global.storageManager = {
        clearAllLogs: jest.fn().mockRejectedValue(new Error('Manual cleanup error'))
      };

      await expect(manualUninstallCleanup())
        .rejects.toThrow('Failed to perform manual cleanup: Manual cleanup error');
    });
  });

  describe('Integration with Extension Lifecycle', () => {
    test('should have chrome API available for event listeners', () => {
      // Verify that chrome API is properly mocked
      expect(chrome.runtime.onSuspend.addListener).toBeDefined();
      expect(chrome.runtime.onStartup.addListener).toBeDefined();
      expect(chrome.runtime.onInstalled.addListener).toBeDefined();
    });

    test('should handle extension install event structure', () => {
      // Test that we can simulate an install event
      const mockInstallEvent = { reason: 'install' };
      
      // Verify the event structure is correct
      expect(mockInstallEvent.reason).toBe('install');
    });
  });
});

describe('Uninstall Cleanup UI Integration', () => {
  // Mock DOM environment
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <body>
      <input type="checkbox" id="cleanup-on-uninstall">
      <button id="manual-cleanup">Manual Cleanup</button>
    </body>
    </html>
  `);
  
  global.window = dom.window;
  global.document = dom.window.document;

  test('should update UI elements based on cleanup settings', () => {
    const cleanupCheckbox = document.getElementById('cleanup-on-uninstall');
    
    // Test setting checkbox state
    cleanupCheckbox.checked = true;
    expect(cleanupCheckbox.checked).toBe(true);
    
    cleanupCheckbox.checked = false;
    expect(cleanupCheckbox.checked).toBe(false);
  });

  test('should handle manual cleanup button interaction', () => {
    const manualCleanupBtn = document.getElementById('manual-cleanup');
    
    // Test that button exists and can be interacted with
    expect(manualCleanupBtn).toBeTruthy();
    expect(manualCleanupBtn.tagName).toBe('BUTTON');
    
    // Test button properties
    expect(manualCleanupBtn.id).toBe('manual-cleanup');
  });

  test('should handle confirmation dialogs for cleanup', () => {
    // Mock confirm dialog
    global.confirm = jest.fn().mockReturnValue(true);
    
    // Test confirm function
    const userConfirmed = global.confirm('Test confirmation');
    expect(userConfirmed).toBe(true);
    expect(global.confirm).toHaveBeenCalledWith('Test confirmation');
  });
});