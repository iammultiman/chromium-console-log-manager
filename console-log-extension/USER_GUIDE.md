# Console Log Extension - User Guide

Welcome to the Console Log Extension! This comprehensive guide will help you get the most out of this powerful debugging tool.

## Table of Contents
- [Getting Started](#getting-started)
- [Basic Usage](#basic-usage)
- [Advanced Features](#advanced-features)
- [Settings & Configuration](#settings--configuration)
- [Export & Sharing](#export--sharing)
- [Tips & Best Practices](#tips--best-practices)
- [Troubleshooting](#troubleshooting)

## Getting Started

### What is the Console Log Extension?

The Console Log Extension is a Chrome extension designed for developers who need to capture, organize, and analyze console logs from web pages. Unlike the built-in Chrome DevTools, this extension:

- **Persists logs** across page reloads and browser sessions
- **Organizes logs** by website and session for easy navigation
- **Provides advanced search** and filtering capabilities
- **Offers multiple export formats** for sharing and analysis
- **Works automatically** without keeping DevTools open

### Installation

1. **From Chrome Web Store** (Recommended)
   - Visit the Chrome Web Store
   - Search for "Console Log Extension"
   - Click "Add to Chrome"
   - Confirm installation

2. **Manual Installation** (Development)
   - Download the extension files
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension folder

### First Launch

After installation, you'll see the extension icon in your Chrome toolbar. Click it to:
1. **Enable log capture** (should be on by default)
2. **Access the options page** for full functionality
3. **View recent logs** in the popup interface

## Basic Usage

### Capturing Logs

The extension automatically captures console logs from all websites. No setup required!

**Supported Log Types:**
- `console.log()` - General information (blue)
- `console.error()` - Error messages (red)
- `console.warn()` - Warning messages (yellow)
- `console.info()` - Information messages (green)

**What Gets Captured:**
- Log message content
- Timestamp
- Log level (error, warn, info, log)
- Source website/URL
- Browser session information

### Viewing Logs

#### Quick View (Popup)
Click the extension icon to see:
- **Recent logs** (last 10 entries)
- **Current status** (enabled/disabled)
- **Quick controls** (enable/disable toggle)
- **Link to full interface**

#### Full Interface (Options Page)
Access via popup → "Open Full Interface" or right-click icon → "Options"

**Features:**
- **Complete log history** with pagination
- **Advanced search and filtering**
- **Session organization** by website
- **Export functionality**
- **Settings configuration**

### Basic Navigation

**In the Options Page:**
- **Search Box**: Enter text to search across all logs
- **Filter Buttons**: Click log levels to show/hide (Error, Warn, Info, Log)
- **Date Picker**: Filter logs by date range
- **Website Filter**: Show logs from specific domains only
- **Session Groups**: Expand/collapse to organize by browsing session

## Advanced Features

### Search & Filtering

#### Text Search
- **Basic Search**: Enter any text to find matching log messages
- **Case Sensitivity**: Toggle case-sensitive matching in settings
- **Partial Matches**: Searches within log message content

#### Advanced Filters
- **Log Level**: Show only errors, warnings, info, or general logs
- **Date Range**: Filter by specific time periods
- **Website/Domain**: Focus on logs from particular sites
- **Session**: View logs from specific browsing sessions

#### Combining Filters
All filters work together. For example:
- Search for "API" + Error level + Last 24 hours
- Find all warnings from "example.com" in the current session

### Session Management

**What is a Session?**
A session represents a period of activity on a specific website. New sessions are created when:
- You visit a website for the first time
- You reload a page after being away
- You open a new tab for the same website

**Session Features:**
- **Automatic Organization**: Logs are grouped by session
- **Session Info**: View start time, duration, and log count
- **Session Filtering**: Focus on specific browsing sessions
- **Session Cleanup**: Delete logs from specific sessions

### Keyword Filtering

Set up automatic filtering based on keywords:

#### Inclusion Keywords
- **Purpose**: Only capture logs containing these words
- **Example**: Set "error", "warning" to capture only important logs
- **Use Case**: Reduce noise in busy applications

#### Exclusion Keywords
- **Purpose**: Ignore logs containing these words
- **Example**: Exclude "debug", "trace" to filter out development logs
- **Use Case**: Hide verbose logging from third-party libraries

#### Configuration
1. Go to Options → Settings → Keyword Filters
2. Add inclusion keywords (capture only these)
3. Add exclusion keywords (ignore these)
4. Choose case-sensitive or case-insensitive matching

## Settings & Configuration

### General Settings

#### Capture Settings
- **Enable/Disable**: Turn log capture on/off globally
- **Log Levels**: Choose which types to capture (error, warn, info, log)
- **Auto-start**: Whether to start capturing on browser startup

#### Storage Settings
- **Retention Period**: How long to keep logs (1-365 days)
- **Storage Limit**: Maximum storage space (10-500 MB)
- **Auto-cleanup**: Automatically remove old logs when limits are reached

### Website-Specific Settings

Configure capture behavior for individual websites:

1. **Access**: Options → Settings → Website Settings
2. **Add Website**: Enter domain name (e.g., "example.com")
3. **Configure**:
   - Enable/disable capture for this site
   - Set custom log levels
   - Apply specific keyword filters
   - Set custom retention periods

### Security Settings

#### Sensitive Data Protection
- **Auto-detection**: Automatically identify potential sensitive data
- **Common Patterns**: API keys, passwords, tokens, credit card numbers
- **Filtering Options**: 
  - Warn before capturing
  - Automatically exclude
  - Mark as sensitive for export warnings

#### Privacy Controls
- **Local Storage Only**: All data stays on your device
- **No External Transmission**: Logs never leave your browser
- **Secure Storage**: Uses Chrome's encrypted storage APIs

## Export & Sharing

### Export Formats

#### JSON Format
- **Best for**: Programmatic analysis, backup
- **Contains**: Full metadata, timestamps, session info
- **Use case**: Import into other tools, detailed analysis

#### CSV Format
- **Best for**: Spreadsheet analysis, reporting
- **Contains**: Essential log data in tabular format
- **Use case**: Excel analysis, sharing with non-technical team members

#### Plain Text Format
- **Best for**: Simple sharing, documentation
- **Contains**: Human-readable log messages with timestamps
- **Use case**: Bug reports, email sharing, documentation

### Export Process

1. **Filter First** (Optional): Use search and filters to narrow down logs
2. **Choose Format**: Select JSON, CSV, or Plain Text
3. **Security Check**: Review warnings about potential sensitive data
4. **Download**: File is saved to your Downloads folder

### Export Options

- **Filtered Export**: Export only currently visible/filtered logs
- **Full Export**: Export all stored logs
- **Date Range Export**: Export logs from specific time periods
- **Website Export**: Export logs from specific domains only

### Security Warnings

The extension will warn you if exported data might contain:
- API keys or tokens
- Password-like strings
- Credit card numbers
- Other potentially sensitive patterns

**Best Practices:**
- Review export content before sharing
- Use filtered exports to limit data exposure
- Consider redacting sensitive information manually

## Tips & Best Practices

### Optimizing Performance

#### For Heavy Logging Applications
- **Use Keyword Filters**: Exclude noisy debug logs
- **Limit Log Levels**: Capture only errors and warnings
- **Shorter Retention**: Reduce storage period for busy sites
- **Regular Cleanup**: Manually clear old logs periodically

#### For Better Organization
- **Descriptive Sessions**: Each tab/reload creates a new session
- **Website Settings**: Configure per-site capture preferences
- **Regular Exports**: Backup important logs before cleanup

### Effective Debugging Workflows

#### Bug Investigation
1. **Reproduce Issue**: Navigate to problematic page
2. **Filter by Error Level**: Focus on errors and warnings
3. **Search for Keywords**: Look for specific error messages
4. **Export Evidence**: Save relevant logs for bug reports

#### Performance Analysis
1. **Capture Full Session**: Enable all log levels
2. **Filter by Time Range**: Focus on specific time periods
3. **Search for Performance Keywords**: "slow", "timeout", "performance"
4. **Export for Analysis**: Use CSV format for spreadsheet analysis

#### Development Workflow
1. **Enable for Development Sites**: Use website-specific settings
2. **Use Keyword Inclusion**: Focus on your application's logs
3. **Regular Review**: Check logs after each development session
4. **Export for Team**: Share relevant logs with team members

### Storage Management

#### Monitoring Usage
- **Check Storage**: Options → Settings → Storage Usage
- **Set Appropriate Limits**: Balance retention vs. storage space
- **Monitor Warnings**: Pay attention to storage limit notifications

#### Cleanup Strategies
- **Automatic Cleanup**: Let the extension manage old logs
- **Manual Cleanup**: Regularly clear logs from specific sites
- **Selective Deletion**: Remove logs from specific sessions
- **Export Before Cleanup**: Backup important logs first

## Troubleshooting

### Common Issues

#### Extension Not Capturing Logs

**Symptoms**: No logs appearing in the extension

**Solutions**:
1. **Check Status**: Ensure capture is enabled in popup
2. **Verify Website Settings**: Check if site is disabled
3. **Reload Page**: Refresh the page to reinject content script
4. **Check Permissions**: Ensure extension has necessary permissions
5. **Restart Extension**: Disable and re-enable in `chrome://extensions/`

#### Missing Logs from Specific Sites

**Symptoms**: Some websites don't show logs

**Solutions**:
1. **Check Website Settings**: Verify site isn't disabled
2. **Content Security Policy**: Some sites block content scripts
3. **JavaScript Errors**: Check if site has JavaScript errors preventing injection
4. **Reload Extension**: Try disabling and re-enabling

#### Storage Issues

**Symptoms**: "Storage quota exceeded" or missing old logs

**Solutions**:
1. **Increase Limit**: Raise storage limit in settings
2. **Reduce Retention**: Lower retention period
3. **Manual Cleanup**: Clear old logs manually
4. **Check Usage**: Monitor storage usage in settings

#### Performance Problems

**Symptoms**: Browser slowdown, extension lag

**Solutions**:
1. **Reduce Capture**: Limit log levels or use keyword filters
2. **Shorter Retention**: Keep fewer logs in storage
3. **Close Unused Tabs**: Reduce active capture points
4. **Regular Cleanup**: Clear logs more frequently

#### Export Failures

**Symptoms**: Export doesn't work or files are corrupted

**Solutions**:
1. **Smaller Exports**: Try exporting smaller date ranges
2. **Different Format**: Try a different export format
3. **Filter First**: Reduce dataset size with filters
4. **Check Storage**: Ensure enough disk space for export

### Error Messages

#### "Failed to inject content script"
- **Cause**: Website blocks content script injection
- **Solution**: Some sites (like chrome:// pages) cannot be monitored

#### "Storage quota exceeded"
- **Cause**: Too many logs stored
- **Solution**: Increase limit or clean up old logs

#### "Export too large"
- **Cause**: Trying to export too much data at once
- **Solution**: Use filters to reduce export size

#### "Sensitive data detected"
- **Cause**: Logs contain potentially sensitive information
- **Solution**: Review and confirm export, or filter out sensitive logs

### Getting Help

If you continue to experience issues:

1. **Check FAQ**: Review frequently asked questions in README
2. **Report Bugs**: Use GitHub issues for bug reports
3. **Feature Requests**: Submit enhancement requests
4. **Community Support**: Check discussions for community help

### Performance Tips

- **Regular Maintenance**: Clean up logs weekly
- **Appropriate Settings**: Match retention to your needs
- **Monitor Usage**: Keep an eye on storage consumption
- **Selective Capture**: Use website settings to focus on important sites

This user guide should help you make the most of the Console Log Extension. For technical details, see the Developer Documentation. For quick reference, check the main README file.