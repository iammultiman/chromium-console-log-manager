# Console Log Extension

A comprehensive Chrome extension for developers that captures, organizes, and manages console logs from web pages. Never lose important debugging information again with persistent storage, advanced search capabilities, and organized session management.

## 🚀 Features

### Core Functionality
- **Automatic Log Capture**: Captures all console.log, console.error, console.warn, and console.info messages
- **Session Organization**: Groups logs by website and browser session for easy navigation
- **Persistent Storage**: Stores logs locally with configurable retention policies
- **Advanced Search**: Full-text search across all captured logs with filtering options
- **Multiple Export Formats**: Export logs in JSON, CSV, or plain text formats

### Advanced Features
- **Keyword Filtering**: Include/exclude logs based on custom keywords
- **Website-Specific Settings**: Configure capture behavior per domain
- **Sensitive Data Protection**: Optional filtering of API keys, passwords, and tokens
- **Storage Management**: Automatic cleanup with configurable size and age limits
- **Real-time Interface**: Live updates in popup and options pages

## 📦 Installation

### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store page](https://chrome.google.com/webstore) (link coming soon)
2. Click "Add to Chrome"
3. Confirm the installation in the popup dialog
4. The extension icon will appear in your Chrome toolbar

### Development Installation
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `console-log-extension` directory
5. The extension will be loaded and ready for use

## 🎯 Quick Start

### Basic Usage
1. **Enable Capture**: Click the extension icon and ensure capture is enabled (green status)
2. **Browse Websites**: Navigate to any website - logs will be captured automatically
3. **View Logs**: Click the extension icon to see recent logs, or click "Open Full Interface" for advanced features
4. **Search & Filter**: Use the search box and filters in the options page to find specific logs

### First-Time Setup
1. Click the extension icon and select "Options" or "Open Full Interface"
2. Configure your preferences:
   - Set retention policy (default: 30 days)
   - Choose which log levels to capture
   - Set up keyword filters if needed
3. Start browsing - your console logs are now being captured!

## 📖 User Guide

### Popup Interface
The popup provides quick access to:
- **Recent Logs**: Last 10 captured log entries
- **Enable/Disable Toggle**: Turn log capture on/off
- **Status Indicator**: Shows current capture status
- **Quick Access**: Link to full options page

### Options Page
Access the full interface by clicking "Options" in the popup or right-clicking the extension icon and selecting "Options".

#### Log Browser
- **Search**: Enter text to search across all log messages
- **Filters**: Filter by log level, date range, or website
- **Session View**: Expand/collapse sessions to organize logs
- **Syntax Highlighting**: Color-coded log levels for easy identification

#### Settings Configuration
- **Capture Settings**: Choose which log levels to capture
- **Storage Settings**: Configure retention policies and storage limits
- **Website Settings**: Enable/disable capture for specific domains
- **Keyword Filters**: Set up inclusion/exclusion keywords

#### Export Functionality
- **Format Selection**: Choose JSON, CSV, or plain text
- **Filtered Export**: Export only currently filtered logs
- **Security Warnings**: Alerts for potential sensitive data in exports

### Keyboard Shortcuts
- **Ctrl+Shift+L**: Open options page (when extension popup is focused)
- **Escape**: Close popup or modal dialogs

## ⚙️ Configuration

### Storage Settings
- **Retention Days**: How long to keep logs (1-365 days)
- **Maximum Storage**: Storage limit in MB (10-500 MB)
- **Auto-cleanup**: Automatic removal of old logs

### Capture Settings
- **Log Levels**: Choose which types to capture (log, error, warn, info)
- **Website Filtering**: Enable/disable per domain
- **Keyword Filtering**: Include/exclude based on content

### Security Settings
- **Sensitive Data Detection**: Automatically filter common sensitive patterns
- **Export Warnings**: Alert before exporting potentially sensitive data
- **Local Storage Only**: All data stays on your device

## 🔒 Privacy & Security

### Data Storage
- **Local Only**: All logs are stored locally on your device using Chrome's secure storage APIs
- **No External Transmission**: Log data never leaves your browser
- **Secure APIs**: Uses Chrome's encrypted storage mechanisms

### Sensitive Data Protection
- **Pattern Detection**: Automatically identifies potential API keys, passwords, and tokens
- **Optional Filtering**: Choose to exclude logs containing sensitive patterns
- **Export Warnings**: Alerts before exporting data that may contain sensitive information

### Permissions
The extension requires minimal permissions:
- **Storage**: To save logs and settings locally
- **Tabs**: To identify which website generated each log
- **ActiveTab**: To inject console capture script
- **Host Permissions**: To capture logs from all websites

## 🛠️ Developer Documentation

### Project Structure
```
console-log-extension/
├── manifest.json              # Extension manifest (Manifest V3)
├── background/
│   └── background.js         # Service worker for log processing
├── content/
│   └── content.js           # Console interception and capture
├── popup/
│   ├── popup.html           # Extension popup interface
│   ├── popup.css            # Popup styling
│   └── popup.js             # Popup functionality
├── options/
│   ├── options.html         # Full options page
│   ├── options.css          # Options page styling
│   └── options.js           # Options page functionality
├── models/
│   ├── LogEntry.js          # Log data model
│   ├── StorageManager.js    # Storage operations
│   ├── FilterCriteria.js    # Search and filter logic
│   ├── ExtensionSettings.js # Settings management
│   └── ExportManager.js     # Export functionality
├── icons/
│   ├── icon16.png           # 16x16 toolbar icon
│   ├── icon32.png           # 32x32 management icon
│   ├── icon48.png           # 48x48 store icon
│   └── icon128.png          # 128x128 store icon
└── tests/                   # Comprehensive test suite
```

### Architecture Overview
- **Content Script**: Intercepts console methods and captures log data
- **Background Script**: Processes logs, manages storage, and coordinates between components
- **Storage Manager**: Handles IndexedDB operations and data lifecycle
- **User Interface**: Popup for quick access, options page for full functionality

### API Documentation

#### LogEntry Model
```javascript
class LogEntry {
  constructor(level, message, args, url, tabId)
  // Properties: id, timestamp, level, message, args, url, domain, tabId, sessionId
}
```

#### StorageManager
```javascript
class StorageManager {
  async saveLogs(logArray)
  async queryLogs(filters)
  async cleanupOldLogs()
  async exportLogs(format, filters)
}
```

#### FilterCriteria
```javascript
class FilterCriteria {
  constructor()
  matches(logEntry)
  // Properties: textSearch, levels, dateRange, domains, sessionIds
}
```

### Building and Testing
```bash
# Install dependencies
npm install

# Run tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

### Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Run the test suite (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Capturing Logs
- **Check Status**: Ensure capture is enabled in the popup
- **Verify Permissions**: Make sure the extension has necessary permissions
- **Reload Extension**: Try disabling and re-enabling the extension
- **Check Website Settings**: Verify the website isn't disabled in settings

#### Storage Issues
- **Clear Old Data**: Use the cleanup tools in the options page
- **Check Storage Quota**: Verify you haven't exceeded Chrome's storage limits
- **Reset Settings**: Try resetting to default settings if issues persist

#### Performance Issues
- **Reduce Retention**: Lower the retention period for logs
- **Limit Log Levels**: Capture only necessary log levels (e.g., errors only)
- **Use Keyword Filters**: Filter out noisy logs with exclusion keywords

#### Export Problems
- **Check File Size**: Large exports may take time or fail
- **Try Different Format**: Some formats handle large datasets better
- **Filter First**: Export smaller, filtered datasets

### Error Messages

#### "Storage quota exceeded"
- **Solution**: Reduce retention period or manually clear old logs
- **Prevention**: Set up automatic cleanup with smaller limits

#### "Failed to capture logs"
- **Solution**: Reload the page and check extension permissions
- **Check**: Ensure the website allows content script injection

#### "Export failed"
- **Solution**: Try exporting smaller datasets or different format
- **Alternative**: Use filtered export to reduce data size

### Getting Help
- **Check FAQ**: Review common questions below
- **Report Issues**: Use the GitHub issues page for bug reports
- **Feature Requests**: Submit enhancement requests via GitHub

## ❓ FAQ

### General Questions

**Q: Does this extension slow down websites?**
A: The extension has minimal performance impact. It only intercepts console methods and doesn't modify page functionality.

**Q: Can I use this extension on any website?**
A: Yes, the extension works on all websites. You can disable it for specific sites if needed.

**Q: How much storage does the extension use?**
A: Storage usage depends on log volume. The extension provides tools to monitor and manage storage usage.

### Privacy Questions

**Q: Is my data sent to external servers?**
A: No, all data is stored locally on your device using Chrome's secure storage APIs.

**Q: Can other extensions access my logs?**
A: No, the data is isolated to this extension only and cannot be accessed by other extensions.

**Q: What happens to my data if I uninstall the extension?**
A: You'll be prompted to choose whether to keep or delete your stored logs during uninstallation.

### Technical Questions

**Q: Does this work with React/Angular/Vue applications?**
A: Yes, the extension captures console logs from any JavaScript application or framework.

**Q: Can I export logs programmatically?**
A: Currently, exports are manual through the UI. Programmatic export may be added in future versions.

**Q: Does this capture logs from service workers?**
A: Currently, only main thread console logs are captured. Service worker support may be added later.

## 📋 Changelog

### Version 1.0.0 (Current)
- Initial release
- Basic log capture and storage
- Search and filtering functionality
- Export in multiple formats
- Website-specific settings
- Keyword filtering
- Sensitive data protection
- Comprehensive test suite

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

If you find this extension helpful, please:
- ⭐ Star the repository
- 🐛 Report bugs via GitHub issues
- 💡 Suggest features via GitHub discussions
- 📝 Contribute improvements via pull requests

## 🔗 Links

- [Chrome Web Store](https://chrome.google.com/webstore) (coming soon)
- [GitHub Repository](https://github.com/your-username/console-log-extension)
- [Issue Tracker](https://github.com/your-username/console-log-extension/issues)
- [Documentation](https://github.com/your-username/console-log-extension/wiki)