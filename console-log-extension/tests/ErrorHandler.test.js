/**
 * Tests for ErrorHandler
 * Tests comprehensive error handling functionality
 */

describe('ErrorHandler', () => {
  let errorHandler;
  let mockNotificationManager;

  beforeEach(() => {
    // Mock NotificationManager
    mockNotificationManager = {
      error: jest.fn(),
      warning: jest.fn(),
      success: jest.fn(),
      info: jest.fn(),
      confirm: jest.fn(),
      loading: jest.fn(),
      hide: jest.fn()
    };

    // Set up DOM
    document.body.innerHTML = '';
    
    // Create error handler
    errorHandler = new ErrorHandler(mockNotificationManager);
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    test('should initialize with notification manager', () => {
      expect(errorHandler.notificationManager).toBe(mockNotificationManager);
      expect(errorHandler.errorLog).toEqual([]);
      expect(errorHandler.debugMode).toBe(false);
    });

    test('should set up global error handling', () => {
      // Test that global error handlers are set up
      const originalAddEventListener = window.addEventListener;
      const mockAddEventListener = jest.fn();
      window.addEventListener = mockAddEventListener;

      new ErrorHandler(mockNotificationManager);

      expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function));

      window.addEventListener = originalAddEventListener;
    });
  });

  describe('Basic Error Handling', () => {
    test('should handle Error objects', () => {
      const testError = new Error('Test error message');
      const errorId = errorHandler.handleError(testError);

      expect(errorId).toBeTruthy();
      expect(errorHandler.errorLog.length).toBe(1);
      
      const loggedError = errorHandler.errorLog[0];
      expect(loggedError.message).toBe('Test error message');
      expect(loggedError.stack).toBeTruthy();
      expect(loggedError.type).toBe('unknown');
    });

    test('should handle string errors', () => {
      const errorId = errorHandler.handleError('String error message');

      expect(errorId).toBeTruthy();
      expect(errorHandler.errorLog.length).toBe(1);
      
      const loggedError = errorHandler.errorLog[0];
      expect(loggedError.message).toBe('String error message');
      expect(loggedError.stack).toBeNull();
    });

    test('should handle errors with context', () => {
      const testError = new Error('Context test error');
      const context = {
        type: 'storage_error',
        operation: 'save',
        context: 'test'
      };

      const errorId = errorHandler.handleError(testError, context);

      const loggedError = errorHandler.errorLog[0];
      expect(loggedError.type).toBe('storage_error');
      expect(loggedError.context.operation).toBe('save');
    });

    test('should determine error severity correctly', () => {
      // Critical error
      const criticalError = new Error('Extension context invalidated');
      errorHandler.handleError(criticalError, { type: 'chrome_api_error' });
      expect(errorHandler.errorLog[0].severity).toBe('critical');

      // High severity error
      const highError = new Error('Storage quota exceeded');
      errorHandler.handleError(highError, { type: 'storage_error' });
      expect(errorHandler.errorLog[1].severity).toBe('high');

      // Medium severity error
      const mediumError = new Error('Validation failed');
      errorHandler.handleError(mediumError, { type: 'validation_error' });
      expect(errorHandler.errorLog[2].severity).toBe('medium');

      // Low severity error
      const lowError = new Error('Minor issue');
      errorHandler.handleError(lowError, { type: 'minor_error' });
      expect(errorHandler.errorLog[3].severity).toBe('low');
    });
  });

  describe('Storage Error Handling', () => {
    test('should handle quota exceeded errors', () => {
      const quotaError = new Error('QuotaExceededError');
      quotaError.name = 'QuotaExceededError';

      errorHandler.handleStorageError(quotaError, 'saveLogs');

      expect(mockNotificationManager.warning).toHaveBeenCalledWith(
        expect.stringContaining('Storage quota exceeded'),
        expect.objectContaining({
          title: 'Storage Full',
          actions: expect.any(Array)
        })
      );
    });

    test('should handle storage corruption errors', () => {
      const corruptionError = new Error('Data corruption detected');
      corruptionError.name = 'DataError';

      errorHandler.handleStorageError(corruptionError, 'loadLogs');

      expect(mockNotificationManager.error).toHaveBeenCalledWith(
        expect.stringContaining('Storage corruption detected'),
        expect.objectContaining({
          title: 'Data Corruption',
          duration: 0,
          actions: expect.any(Array)
        })
      );
    });

    test('should handle generic storage errors', () => {
      const genericError = new Error('Generic storage error');

      errorHandler.handleStorageError(genericError, 'updateSettings');

      expect(mockNotificationManager.warning).toHaveBeenCalledWith(
        expect.stringContaining('Storage operation "updateSettings" failed'),
        expect.objectContaining({
          title: 'Storage Issue',
          actions: expect.any(Array)
        })
      );
    });

    test('should return fallback value on storage error', () => {
      const error = new Error('Storage error');
      const fallbackValue = { default: 'data' };

      const result = errorHandler.handleStorageError(error, 'loadData', fallbackValue);

      expect(result).toBe(fallbackValue);
    });
  });

  describe('Network Error Handling', () => {
    test('should handle network errors', () => {
      const networkError = new Error('Network request failed');

      errorHandler.handleNetworkError(networkError, 'fetchData');

      expect(mockNotificationManager.warning).toHaveBeenCalledWith(
        expect.stringContaining('Network operation "fetchData" failed'),
        expect.objectContaining({
          title: 'Network Error',
          actions: expect.any(Array)
        })
      );
    });
  });

  describe('Chrome API Error Handling', () => {
    test('should handle extension context invalidated error', () => {
      const contextError = new Error('Extension context invalidated');

      errorHandler.handleChromeApiError(contextError, 'runtime.sendMessage');

      expect(mockNotificationManager.error).toHaveBeenCalledWith(
        expect.stringContaining('Extension needs to be reloaded'),
        expect.objectContaining({
          title: 'Extension Error',
          duration: 0
        })
      );
    });

    test('should handle permission errors', () => {
      const permissionError = new Error('Missing required permissions');

      errorHandler.handleChromeApiError(permissionError, 'storage.local');

      expect(mockNotificationManager.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing required permissions'),
        expect.objectContaining({
          title: 'Permission Error'
        })
      );
    });

    test('should handle generic Chrome API errors', () => {
      const apiError = new Error('Chrome API failed');

      errorHandler.handleChromeApiError(apiError, 'tabs.query');

      expect(mockNotificationManager.error).toHaveBeenCalledWith(
        expect.stringContaining('Chrome API "tabs.query" failed'),
        expect.objectContaining({
          title: 'Extension API Error'
        })
      );
    });
  });

  describe('Async Operation Wrapping', () => {
    test('should wrap successful async operations', async () => {
      const successfulOperation = jest.fn().mockResolvedValue('success');

      const result = await errorHandler.wrapAsync(successfulOperation);

      expect(result).toBe('success');
      expect(successfulOperation).toHaveBeenCalled();
      expect(errorHandler.errorLog.length).toBe(0);
    });

    test('should wrap failing async operations', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Async error'));
      const fallbackValue = 'fallback';

      const result = await errorHandler.wrapAsync(
        failingOperation,
        { type: 'test_error' },
        fallbackValue
      );

      expect(result).toBe(fallbackValue);
      expect(failingOperation).toHaveBeenCalled();
      expect(errorHandler.errorLog.length).toBe(1);
      expect(errorHandler.errorLog[0].message).toBe('Async error');
    });
  });

  describe('Sync Operation Wrapping', () => {
    test('should wrap successful sync operations', () => {
      const successfulOperation = jest.fn().mockReturnValue('success');

      const result = errorHandler.wrapSync(successfulOperation);

      expect(result).toBe('success');
      expect(successfulOperation).toHaveBeenCalled();
      expect(errorHandler.errorLog.length).toBe(0);
    });

    test('should wrap failing sync operations', () => {
      const failingOperation = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      const fallbackValue = 'fallback';

      const result = errorHandler.wrapSync(
        failingOperation,
        { type: 'test_error' },
        fallbackValue
      );

      expect(result).toBe(fallbackValue);
      expect(failingOperation).toHaveBeenCalled();
      expect(errorHandler.errorLog.length).toBe(1);
      expect(errorHandler.errorLog[0].message).toBe('Sync error');
    });
  });

  describe('Error Logging', () => {
    test('should maintain error log size limit', () => {
      // Set a small limit for testing
      errorHandler.maxErrorLogSize = 3;

      // Add more errors than the limit
      for (let i = 0; i < 5; i++) {
        errorHandler.handleError(new Error(`Error ${i}`));
      }

      expect(errorHandler.errorLog.length).toBe(3);
      // Should keep the most recent errors
      expect(errorHandler.errorLog[0].message).toBe('Error 2');
      expect(errorHandler.errorLog[2].message).toBe('Error 4');
    });

    test('should generate unique error IDs', () => {
      const id1 = errorHandler.handleError(new Error('Error 1'));
      const id2 = errorHandler.handleError(new Error('Error 2'));

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^err_\d+_[a-z0-9]+$/);
    });
  });

  describe('User-Friendly Messages', () => {
    test('should provide user-friendly messages for different error types', () => {
      const testCases = [
        {
          context: { type: 'storage_error' },
          expectedMessage: 'Unable to save or load data'
        },
        {
          context: { type: 'network_error' },
          expectedMessage: 'Network connection failed'
        },
        {
          context: { type: 'chrome_api_error' },
          expectedMessage: 'Extension API error occurred'
        },
        {
          context: { type: 'validation_error' },
          expectedMessage: 'Invalid data detected'
        },
        {
          context: { type: 'parsing_error' },
          expectedMessage: 'Unable to process data format'
        },
        {
          context: { type: 'unknown_error' },
          expectedMessage: 'An unexpected error occurred'
        }
      ];

      testCases.forEach(({ context, expectedMessage }) => {
        const errorEntry = {
          message: 'Test error',
          context,
          severity: 'high'
        };

        const friendlyMessage = errorHandler.getUserFriendlyMessage(errorEntry);
        expect(friendlyMessage).toContain(expectedMessage);
      });
    });
  });

  describe('Error Statistics', () => {
    test('should provide error statistics', () => {
      // Add various errors
      errorHandler.handleError(new Error('Error 1'), { type: 'storage_error' });
      errorHandler.handleError(new Error('Error 2'), { type: 'storage_error' });
      errorHandler.handleError(new Error('Error 3'), { type: 'network_error' });

      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.storage_error).toBe(2);
      expect(stats.byType.network_error).toBe(1);
      expect(stats.recent.length).toBe(3);
    });

    test('should clear error log', () => {
      errorHandler.handleError(new Error('Error 1'));
      errorHandler.handleError(new Error('Error 2'));

      expect(errorHandler.errorLog.length).toBe(2);

      errorHandler.clearErrorLog();

      expect(errorHandler.errorLog.length).toBe(0);
    });
  });

  describe('Debug Mode', () => {
    test('should enable debug mode', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      errorHandler.setDebugMode(true);
      errorHandler.handleError(new Error('Debug test error'));

      expect(consoleSpy).toHaveBeenCalledWith('Extension Error:', expect.any(Object));

      consoleSpy.mockRestore();
    });

    test('should not log to console when debug mode is disabled', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      errorHandler.setDebugMode(false);
      errorHandler.handleError(new Error('No debug test error'));

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Error Detection Utilities', () => {
    test('should detect quota exceeded errors', () => {
      const quotaError1 = new Error('Storage quota exceeded');
      quotaError1.name = 'QuotaExceededError';

      const quotaError2 = new Error('Not enough storage space');

      const normalError = new Error('Normal error');

      expect(errorHandler.isQuotaExceededError(quotaError1)).toBe(true);
      expect(errorHandler.isQuotaExceededError(quotaError2)).toBe(true);
      expect(errorHandler.isQuotaExceededError(normalError)).toBe(false);
    });

    test('should detect corruption errors', () => {
      const corruptionError1 = new Error('Data is corrupt');
      const corruptionError2 = new Error('Invalid data format');
      corruptionError2.name = 'DataError';

      const normalError = new Error('Normal error');

      expect(errorHandler.isCorruptionError(corruptionError1)).toBe(true);
      expect(errorHandler.isCorruptionError(corruptionError2)).toBe(true);
      expect(errorHandler.isCorruptionError(normalError)).toBe(false);
    });
  });
});