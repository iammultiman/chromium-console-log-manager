/**
 * Tests for NotificationManager
 * Tests toast notification system functionality
 */

describe('NotificationManager', () => {
  let notificationManager;
  let mockContainer;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '';
    
    // Create notification manager
    notificationManager = new NotificationManager();
    
    // Get the container that was created
    mockContainer = document.getElementById('notification-container');
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    test('should create notification container on initialization', () => {
      expect(mockContainer).toBeTruthy();
      expect(mockContainer.className).toBe('notification-container');
    });

    test('should not create duplicate containers', () => {
      // Create another instance
      new NotificationManager();
      
      const containers = document.querySelectorAll('#notification-container');
      expect(containers.length).toBe(1);
    });
  });

  describe('Basic Notifications', () => {
    test('should show success notification', () => {
      const id = notificationManager.success('Test success message');
      
      expect(id).toBeTruthy();
      
      const notification = document.getElementById(id);
      expect(notification).toBeTruthy();
      expect(notification.classList.contains('success')).toBe(true);
      expect(notification.textContent).toContain('Test success message');
    });

    test('should show error notification', () => {
      const id = notificationManager.error('Test error message');
      
      expect(id).toBeTruthy();
      
      const notification = document.getElementById(id);
      expect(notification).toBeTruthy();
      expect(notification.classList.contains('error')).toBe(true);
      expect(notification.textContent).toContain('Test error message');
    });

    test('should show warning notification', () => {
      const id = notificationManager.warning('Test warning message');
      
      expect(id).toBeTruthy();
      
      const notification = document.getElementById(id);
      expect(notification).toBeTruthy();
      expect(notification.classList.contains('warning')).toBe(true);
      expect(notification.textContent).toContain('Test warning message');
    });

    test('should show info notification', () => {
      const id = notificationManager.info('Test info message');
      
      expect(id).toBeTruthy();
      
      const notification = document.getElementById(id);
      expect(notification).toBeTruthy();
      expect(notification.classList.contains('info')).toBe(true);
      expect(notification.textContent).toContain('Test info message');
    });
  });

  describe('Custom Notifications', () => {
    test('should show notification with custom options', () => {
      const id = notificationManager.show({
        type: 'success',
        title: 'Custom Title',
        message: 'Custom message',
        duration: 10000
      });
      
      const notification = document.getElementById(id);
      expect(notification.textContent).toContain('Custom Title');
      expect(notification.textContent).toContain('Custom message');
    });

    test('should show notification with actions', () => {
      const mockHandler = jest.fn();
      
      const id = notificationManager.show({
        type: 'warning',
        title: 'Action Test',
        message: 'Test message',
        actions: [
          {
            text: 'Test Action',
            handler: mockHandler,
            primary: true
          }
        ]
      });
      
      const notification = document.getElementById(id);
      const actionButton = notification.querySelector('.notification-btn');
      
      expect(actionButton).toBeTruthy();
      expect(actionButton.textContent).toBe('Test Action');
      expect(actionButton.classList.contains('primary')).toBe(true);
      
      // Test action handler
      actionButton.click();
      expect(mockHandler).toHaveBeenCalled();
    });

    test('should show persistent notification with duration 0', () => {
      const id = notificationManager.show({
        type: 'info',
        message: 'Persistent message',
        duration: 0
      });
      
      const notification = document.getElementById(id);
      const progressBar = notification.querySelector('.notification-progress');
      
      expect(progressBar).toBeFalsy(); // No progress bar for persistent notifications
    });
  });

  describe('Notification Management', () => {
    test('should hide notification by ID', () => {
      const id = notificationManager.success('Test message');
      
      let notification = document.getElementById(id);
      expect(notification).toBeTruthy();
      
      notificationManager.hide(id);
      
      // Should be marked for removal (class removed)
      expect(notification.classList.contains('show')).toBe(false);
    });

    test('should hide all notifications', () => {
      const id1 = notificationManager.success('Message 1');
      const id2 = notificationManager.error('Message 2');
      const id3 = notificationManager.warning('Message 3');
      
      expect(document.getElementById(id1)).toBeTruthy();
      expect(document.getElementById(id2)).toBeTruthy();
      expect(document.getElementById(id3)).toBeTruthy();
      
      notificationManager.hideAll();
      
      // All should be marked for removal
      expect(document.getElementById(id1).classList.contains('show')).toBe(false);
      expect(document.getElementById(id2).classList.contains('show')).toBe(false);
      expect(document.getElementById(id3).classList.contains('show')).toBe(false);
    });

    test('should limit maximum notifications', () => {
      // Show more notifications than the limit (5)
      const ids = [];
      for (let i = 0; i < 7; i++) {
        ids.push(notificationManager.info(`Message ${i}`));
      }
      
      // Should only have 5 notifications in the container
      const notifications = mockContainer.querySelectorAll('.notification');
      expect(notifications.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Close Functionality', () => {
    test('should close notification when close button is clicked', () => {
      const id = notificationManager.success('Test message');
      const notification = document.getElementById(id);
      const closeButton = notification.querySelector('.notification-close');
      
      expect(closeButton).toBeTruthy();
      
      closeButton.click();
      
      expect(notification.classList.contains('show')).toBe(false);
    });

    test('should call onClose callback when notification is closed', () => {
      const mockOnClose = jest.fn();
      
      const id = notificationManager.show({
        type: 'info',
        message: 'Test message',
        onClose: mockOnClose
      });
      
      notificationManager.hide(id);
      
      // Wait for animation
      setTimeout(() => {
        expect(mockOnClose).toHaveBeenCalled();
      }, 350);
    });
  });

  describe('Special Notification Types', () => {
    test('should show confirmation notification', () => {
      const mockOnConfirm = jest.fn();
      const mockOnCancel = jest.fn();
      
      const id = notificationManager.confirm({
        message: 'Are you sure?',
        title: 'Confirm Action',
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel
      });
      
      const notification = document.getElementById(id);
      const buttons = notification.querySelectorAll('.notification-btn');
      
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toBe('Cancel');
      expect(buttons[1].textContent).toBe('Confirm');
      expect(buttons[1].classList.contains('primary')).toBe(true);
      
      // Test confirm action
      buttons[1].click();
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    test('should show loading notification', () => {
      const id = notificationManager.loading('Loading data...');
      
      const notification = document.getElementById(id);
      expect(notification.textContent).toContain('Loading...');
      expect(notification.textContent).toContain('Loading data...');
      
      // Loading notifications should be persistent
      const progressBar = notification.querySelector('.notification-progress');
      expect(progressBar).toBeFalsy();
    });
  });

  describe('HTML Escaping', () => {
    test('should escape HTML in messages to prevent XSS', () => {
      const maliciousMessage = '<script>alert("xss")</script>';
      
      const id = notificationManager.success(maliciousMessage);
      const notification = document.getElementById(id);
      
      // Should not contain actual script tag
      expect(notification.querySelector('script')).toBeFalsy();
      // Should contain escaped HTML
      expect(notification.innerHTML).toContain('&lt;script&gt;');
    });

    test('should escape HTML in titles to prevent XSS', () => {
      const maliciousTitle = '<img src=x onerror=alert("xss")>';
      
      const id = notificationManager.show({
        type: 'info',
        title: maliciousTitle,
        message: 'Safe message'
      });
      
      const notification = document.getElementById(id);
      
      // Should not contain actual img tag
      expect(notification.querySelector('img')).toBeFalsy();
      // Should contain escaped HTML
      expect(notification.innerHTML).toContain('&lt;img');
    });
  });

  describe('Auto-hide Functionality', () => {
    test('should auto-hide notification after specified duration', (done) => {
      const id = notificationManager.show({
        type: 'info',
        message: 'Auto-hide test',
        duration: 100 // Very short duration for testing
      });
      
      const notification = document.getElementById(id);
      expect(notification.classList.contains('show')).toBe(true);
      
      setTimeout(() => {
        expect(notification.classList.contains('show')).toBe(false);
        done();
      }, 150);
    });

    test('should not auto-hide persistent notifications', (done) => {
      const id = notificationManager.show({
        type: 'info',
        message: 'Persistent test',
        duration: 0
      });
      
      const notification = document.getElementById(id);
      expect(notification.classList.contains('show')).toBe(true);
      
      setTimeout(() => {
        expect(notification.classList.contains('show')).toBe(true);
        done();
      }, 100);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing container gracefully', () => {
      // Remove container
      mockContainer.remove();
      
      // Should not throw error
      expect(() => {
        notificationManager.show({
          type: 'info',
          message: 'Test message'
        });
      }).not.toThrow();
    });

    test('should handle invalid notification type', () => {
      const id = notificationManager.show({
        type: 'invalid-type',
        message: 'Test message'
      });
      
      const notification = document.getElementById(id);
      // Should default to info type
      expect(notification.classList.contains('info')).toBe(true);
    });
  });
});