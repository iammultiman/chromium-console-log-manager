/**
 * NotificationManager - Handles user notifications and feedback
 * Provides toast notifications, error displays, and success messages
 */
class NotificationManager {
  constructor() {
    this.notifications = new Map();
    this.notificationId = 0;
    this.defaultDuration = 5000; // 5 seconds
    this.maxNotifications = 5;
    
    // Initialize notification container
    this.initializeContainer();
  }

  /**
   * Initialize the notification container in the DOM
   */
  initializeContainer() {
    // Check if container already exists
    if (document.getElementById('notification-container')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    container.innerHTML = `
      <style>
        .notification-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          max-width: 400px;
          pointer-events: none;
        }
        
        .notification {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          margin-bottom: 10px;
          padding: 16px;
          pointer-events: auto;
          transform: translateX(100%);
          transition: all 0.3s ease;
          border-left: 4px solid #007bff;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          max-width: 100%;
          word-wrap: break-word;
        }
        
        .notification.show {
          transform: translateX(0);
        }
        
        .notification.success {
          border-left-color: #28a745;
        }
        
        .notification.warning {
          border-left-color: #ffc107;
        }
        
        .notification.error {
          border-left-color: #dc3545;
        }
        
        .notification.info {
          border-left-color: #17a2b8;
        }
        
        .notification-icon {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          margin-top: 2px;
        }
        
        .notification-content {
          flex: 1;
          min-width: 0;
        }
        
        .notification-title {
          font-weight: 600;
          margin-bottom: 4px;
          color: #333;
          font-size: 14px;
        }
        
        .notification-message {
          color: #666;
          font-size: 13px;
          line-height: 1.4;
        }
        
        .notification-actions {
          margin-top: 8px;
          display: flex;
          gap: 8px;
        }
        
        .notification-btn {
          background: none;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .notification-btn:hover {
          background-color: #f8f9fa;
        }
        
        .notification-btn.primary {
          background-color: #007bff;
          color: white;
          border-color: #007bff;
        }
        
        .notification-btn.primary:hover {
          background-color: #0056b3;
        }
        
        .notification-close {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #999;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .notification-close:hover {
          color: #666;
        }
        
        .notification-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2px;
          background-color: rgba(0, 0, 0, 0.1);
          transition: width linear;
        }
        
        .notification.success .notification-progress {
          background-color: #28a745;
        }
        
        .notification.warning .notification-progress {
          background-color: #ffc107;
        }
        
        .notification.error .notification-progress {
          background-color: #dc3545;
        }
        
        .notification.info .notification-progress {
          background-color: #17a2b8;
        }
      </style>
    `;
    
    document.body.appendChild(container);
  }

  /**
   * Show a notification
   * @param {Object} options - Notification options
   * @param {string} options.type - Type: 'success', 'error', 'warning', 'info'
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {number} [options.duration] - Duration in ms (0 for persistent)
   * @param {Array} [options.actions] - Array of action buttons
   * @param {Function} [options.onClose] - Callback when notification is closed
   * @returns {string} Notification ID
   */
  show(options) {
    const {
      type = 'info',
      title,
      message,
      duration = this.defaultDuration,
      actions = [],
      onClose
    } = options;

    const id = `notification-${++this.notificationId}`;
    const container = document.getElementById('notification-container');
    
    if (!container) {
      console.error('Notification container not found');
      return null;
    }

    // Remove oldest notification if we have too many
    if (this.notifications.size >= this.maxNotifications) {
      const oldestId = this.notifications.keys().next().value;
      this.hide(oldestId);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.id = id;
    notification.className = `notification ${type}`;
    
    const icon = this.getIcon(type);
    const actionsHtml = actions.length > 0 ? `
      <div class="notification-actions">
        ${actions.map((action, index) => `
          <button class="notification-btn ${action.primary ? 'primary' : ''}" 
                  data-action="${index}">
            ${action.text}
          </button>
        `).join('')}
      </div>
    ` : '';

    notification.innerHTML = `
      ${icon}
      <div class="notification-content">
        ${title ? `<div class="notification-title">${this.escapeHtml(title)}</div>` : ''}
        <div class="notification-message">${this.escapeHtml(message)}</div>
        ${actionsHtml}
      </div>
      <button class="notification-close" aria-label="Close notification">&times;</button>
      ${duration > 0 ? '<div class="notification-progress"></div>' : ''}
    `;

    // Add event listeners
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.hide(id));

    // Handle action buttons
    actions.forEach((action, index) => {
      const btn = notification.querySelector(`[data-action="${index}"]`);
      if (btn && action.handler) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          action.handler();
          if (action.closeOnClick !== false) {
            this.hide(id);
          }
        });
      }
    });

    // Add to container and show
    container.appendChild(notification);
    
    // Store notification data
    this.notifications.set(id, {
      element: notification,
      onClose,
      timeout: null
    });

    // Trigger animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Set auto-hide timer
    if (duration > 0) {
      const progressBar = notification.querySelector('.notification-progress');
      if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.style.transition = `width ${duration}ms linear`;
        requestAnimationFrame(() => {
          progressBar.style.width = '0%';
        });
      }

      const timeout = setTimeout(() => {
        this.hide(id);
      }, duration);

      this.notifications.get(id).timeout = timeout;
    }

    return id;
  }

  /**
   * Hide a notification
   * @param {string} id - Notification ID
   */
  hide(id) {
    const notificationData = this.notifications.get(id);
    if (!notificationData) return;

    const { element, onClose, timeout } = notificationData;

    // Clear timeout
    if (timeout) {
      clearTimeout(timeout);
    }

    // Animate out
    element.classList.remove('show');
    
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.notifications.delete(id);
      
      // Call onClose callback
      if (onClose) {
        onClose();
      }
    }, 300);
  }

  /**
   * Hide all notifications
   */
  hideAll() {
    const ids = Array.from(this.notifications.keys());
    ids.forEach(id => this.hide(id));
  }

  /**
   * Show success notification
   * @param {string} message - Success message
   * @param {Object} [options] - Additional options
   */
  success(message, options = {}) {
    return this.show({
      type: 'success',
      title: options.title || 'Success',
      message,
      ...options
    });
  }

  /**
   * Show error notification
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   */
  error(message, options = {}) {
    return this.show({
      type: 'error',
      title: options.title || 'Error',
      message,
      duration: options.duration || 8000, // Longer duration for errors
      ...options
    });
  }

  /**
   * Show warning notification
   * @param {string} message - Warning message
   * @param {Object} [options] - Additional options
   */
  warning(message, options = {}) {
    return this.show({
      type: 'warning',
      title: options.title || 'Warning',
      message,
      ...options
    });
  }

  /**
   * Show info notification
   * @param {string} message - Info message
   * @param {Object} [options] - Additional options
   */
  info(message, options = {}) {
    return this.show({
      type: 'info',
      title: options.title || 'Information',
      message,
      ...options
    });
  }

  /**
   * Get icon HTML for notification type
   * @param {string} type - Notification type
   * @returns {string} Icon HTML
   */
  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    return `<div class="notification-icon">${icons[type] || icons.info}</div>`;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show a confirmation dialog using notifications
   * @param {Object} options - Confirmation options
   * @param {string} options.message - Confirmation message
   * @param {string} [options.title] - Confirmation title
   * @param {Function} options.onConfirm - Callback for confirm action
   * @param {Function} [options.onCancel] - Callback for cancel action
   * @returns {string} Notification ID
   */
  confirm(options) {
    const {
      message,
      title = 'Confirm Action',
      onConfirm,
      onCancel
    } = options;

    return this.show({
      type: 'warning',
      title,
      message,
      duration: 0, // Persistent until user action
      actions: [
        {
          text: 'Cancel',
          handler: () => {
            if (onCancel) onCancel();
          }
        },
        {
          text: 'Confirm',
          primary: true,
          handler: () => {
            if (onConfirm) onConfirm();
          }
        }
      ]
    });
  }

  /**
   * Show a loading notification
   * @param {string} message - Loading message
   * @param {Object} [options] - Additional options
   * @returns {string} Notification ID
   */
  loading(message, options = {}) {
    return this.show({
      type: 'info',
      title: options.title || 'Loading...',
      message,
      duration: 0, // Persistent until manually hidden
      ...options
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationManager;
} else if (typeof window !== 'undefined') {
  window.NotificationManager = NotificationManager;
} else if (typeof self !== 'undefined') {
  self.NotificationManager = NotificationManager;
}

// ES6 export - this will cause syntax errors in non-module contexts
// We'll handle this by creating separate module files for the background script
