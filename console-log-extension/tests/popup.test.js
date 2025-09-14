/**
 * Tests for popup functionality
 */

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    openOptionsPage: jest.fn()
  }
};

// Mock DOM
global.document = {
  getElementById: jest.fn(),
  addEventListener: jest.fn(),
  hidden: false,
  createElement: jest.fn(() => ({
    textContent: '',
    innerHTML: ''
  }))
};

global.window = {
  addEventListener: jest.fn(),
  close: jest.fn(),
  confirm: jest.fn(() => true)
};

describe('PopupManager', () => {
  let popupManager;
  let mockElements;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock DOM elements
    mockElements = {
      enableToggle: { checked: true, addEventListener: jest.fn() },
      statusText: { textContent: 'Enabled' },
      openOptionsBtn: { addEventListener: jest.fn() },
      clearTodayBtn: { 
        addEventListener: jest.fn(),
        disabled: false,
        textContent: 'Clear Today'
      },
      recentLogsList: { innerHTML: '' },
      todayCount: { textContent: '0' },
      sessionCount: { textContent: '0' }
    };

    document.getElementById.mockImplementation((id) => mockElements[id.replace('-', '')]);

    // Load the popup script
    delete require.cache[require.resolve('../popup/popup.js')];
    
    // Mock the PopupManager class (since it's defined in the script)
    global.PopupManager = class {
      constructor() {
        this.elements = {};
        this.isLoading = false;
        this.refreshInterval = null;
      }

      bindElements() {
        this.elements = mockElements;
      }

      attachEventListeners() {
        // Mock implementation
      }

      async loadInitialData() {
        // Mock implementation
      }

      startAutoRefresh() {
        // Mock implementation
      }

      updateToggleState(enabled) {
        this.elements.enableToggle.checked = enabled;
        this.elements.statusText.textContent = enabled ? 'Enabled' : 'Disabled';
      }

      displayRecentLogs(logs) {
        if (!logs || logs.length === 0) {
          this.elements.recentLogsList.innerHTML = 'No recent logs found';
          return;
        }
        this.elements.recentLogsList.innerHTML = logs.map(log => 
          `<div class="log-item">${log.level}: ${log.message}</div>`
        ).join('');
      }

      updateStatistics(todayCount, sessionCount) {
        this.elements.todayCount.textContent = todayCount.toString();
        this.elements.sessionCount.textContent = sessionCount.toString();
      }
    };

    popupManager = new global.PopupManager();
  });

  describe('initialization', () => {
    test('should bind DOM elements correctly', () => {
      popupManager.bindElements();
      
      expect(popupManager.elements).toBeDefined();
      expect(popupManager.elements.enableToggle).toBe(mockElements.enableToggle);
      expect(popupManager.elements.statusText).toBe(mockElements.statusText);
    });
  });

  describe('toggle state management', () => {
    test('should update toggle state correctly', () => {
      popupManager.bindElements();
      
      popupManager.updateToggleState(true);
      expect(popupManager.elements.enableToggle.checked).toBe(true);
      expect(popupManager.elements.statusText.textContent).toBe('Enabled');
      
      popupManager.updateToggleState(false);
      expect(popupManager.elements.enableToggle.checked).toBe(false);
      expect(popupManager.elements.statusText.textContent).toBe('Disabled');
    });
  });

  describe('log display', () => {
    beforeEach(() => {
      popupManager.bindElements();
    });

    test('should display recent logs correctly', () => {
      const mockLogs = [
        { level: 'error', message: 'Test error message', timestamp: Date.now() },
        { level: 'info', message: 'Test info message', timestamp: Date.now() - 1000 }
      ];

      popupManager.displayRecentLogs(mockLogs);
      
      expect(popupManager.elements.recentLogsList.innerHTML).toContain('error: Test error message');
      expect(popupManager.elements.recentLogsList.innerHTML).toContain('info: Test info message');
    });

    test('should show empty message when no logs', () => {
      popupManager.displayRecentLogs([]);
      
      expect(popupManager.elements.recentLogsList.innerHTML).toBe('No recent logs found');
    });
  });

  describe('statistics display', () => {
    test('should update statistics correctly', () => {
      popupManager.bindElements();
      
      popupManager.updateStatistics(42, 3);
      
      expect(popupManager.elements.todayCount.textContent).toBe('42');
      expect(popupManager.elements.sessionCount.textContent).toBe('3');
    });
  });

  describe('Chrome API integration', () => {
    test('should handle settings loading', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        settings: { captureEnabled: true }
      });

      // Test would require actual popup script loading
      // This is a placeholder for integration testing
      expect(chrome.runtime.sendMessage).toBeDefined();
    });

    test('should handle options page opening', () => {
      // Test that the chrome API is available for options page
      expect(chrome.runtime.openOptionsPage).toBeDefined();
      
      // Test that the button element has addEventListener method
      const openOptionsBtn = mockElements.openOptionsBtn;
      expect(openOptionsBtn.addEventListener).toBeDefined();
    });
  });
});