# Troubleshooting Guide

This document provides solutions to common issues and frequently asked questions about the Console Log Extension.

## Table of Contents
- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Capture Problems](#capture-problems)
- [Storage Issues](#storage-issues)
- [Performance Problems](#performance-problems)
- [Export Issues](#export-issues)
- [UI Problems](#ui-problems)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Advanced Troubleshooting](#advanced-troubleshooting)

## Quick Diagnostics

### Extension Health Check

Before diving into specific issues, run this quick health check:

1. **Extension Status**
   - Go to `chrome://extensions/`
   - Verify "Console Log Extension" is enabled
   - Check for any error messages

2. **Basic Functionality**
   - Click the extension icon
   - Verify popup opens
   - Check if capture is enabled (green status)

3. **Permissions**
   - Ensure extension has "Storage", "Tabs", and "ActiveTab" permissions
   - Check if host permissions are granted for `<all_urls>`

4. **Test Capture**
   - Open a simple webpage
   - Open browser console (F12)
   - Type `console.log("test message")`
   - Check if it appears in the extension

## Installation Issues

### Extension Won't Install

**Problem**: Installation fails from Chrome Web Store or manual installation

**Solutions**:
1. **Check Chrome Version**: Ensure Chrome is up to date (minimum version 88+)
2. **Clear Browser Cache**: Clear Chrome's cache and cookies
3. **Disable Other Extensions**: Temporarily disable other extensions to check for conflicts
4. **Restart Chrome**: Close and restart the browser completely
5. **Check Disk Space**: Ensure sufficient disk space for installation

### Extension Disappears After Installation

**Problem**: Extension installs but disappears from toolbar

**Solutions**:
1. **Check Extensions Page**: Go to `chrome://extensions/` to verify it's still installed
2. **Pin Extension**: Click the puzzle piece icon in toolbar and pin the extension
3. **Check Extension Visibility**: Some extensions may be hidden in the overflow menu
4. **Reinstall**: Remove and reinstall the extension

### Permission Errors

**Problem**: Extension requests permissions but fails to work

**Solutions**:
1. **Grant All Permissions**: Ensure all requested permissions are granted
2. **Reload Extension**: Disable and re-enable the extension
3. **Check Host Permissions**: Verify `<all_urls>` permission is granted
4. **Manual Permission Grant**: Go to extension details and manually grant permissions

## Capture Problems

### No Logs Being Captured

**Problem**: Extension is enabled but no logs appear

**Diagnostic Steps**:
1. **Check Extension Status**: Verify capture is enabled in popup
2. **Test on Simple Page**: Try on a basic webpage with known console output
3. **Check Website Settings**: Verify the current site isn't disabled
4. **Inspect Content Script**: Check if content script is injected

**Solutions**:
1. **Reload Page**: Refresh the webpage to reinject content script
2. **Check Website Settings**: Go to Options → Settings → Website Settings
3. **Clear Extension Data**: Reset extension settings to defaults
4. **Reinstall Extension**: Complete removal and reinstallation

### Logs Missing from Specific Websites

**Problem**: Some websites don't show any logs

**Common Causes**:
- Content Security Policy (CSP) restrictions
- Website blocks content script injection
- JavaScript errors preventing script execution
- Website-specific settings disabled

**Solutions**:
1. **Check CSP**: Some sites block content scripts (chrome://, file://, etc.)
2. **Verify Website Settings**: Check if site is specifically disabled
3. **Test JavaScript**: Ensure the website's JavaScript is working
4. **Check Browser Console**: Look for content script injection errors

### Partial Log Capture

**Problem**: Only some logs are captured, others are missing

**Diagnostic Steps**:
1. **Check Log Level Settings**: Verify all desired levels are enabled
2. **Review Keyword Filters**: Check if filters are excluding logs
3. **Test Different Log Types**: Try console.log, console.error, etc.
4. **Check Timing**: Some logs may occur before script injection

**Solutions**:
1. **Adjust Log Levels**: Enable all log levels in settings
2. **Review Filters**: Disable keyword filters temporarily
3. **Check Injection Timing**: Set content script to run at "document_start"
4. **Increase Buffer Size**: Adjust internal buffer settings if available

### Logs Appear Delayed

**Problem**: Logs show up in extension later than expected

**Causes**:
- Background script processing delays
- Storage write operations
- Large volume of logs causing backlog

**Solutions**:
1. **Reduce Log Volume**: Use keyword filters to reduce noise
2. **Check Storage Performance**: Ensure sufficient disk space
3. **Restart Extension**: Disable and re-enable to clear backlogs
4. **Reduce Retention**: Lower storage limits to improve performance

## Storage Issues

### Storage Quota Exceeded

**Problem**: "Storage quota exceeded" error message

**Immediate Solutions**:
1. **Clear Old Logs**: Go to Options → Log Management → Clear Old Logs
2. **Reduce Retention**: Lower retention period in settings
3. **Increase Quota**: Raise storage limit if available
4. **Export and Clear**: Export important logs, then clear storage

**Prevention**:
1. **Set Appropriate Limits**: Configure realistic retention periods
2. **Regular Cleanup**: Schedule regular log cleanup
3. **Use Keyword Filters**: Reduce captured log volume
4. **Monitor Usage**: Check storage usage regularly

### Data Loss Issues

**Problem**: Logs disappear unexpectedly

**Diagnostic Steps**:
1. **Check Retention Settings**: Verify retention period configuration
2. **Review Cleanup Logs**: Check if automatic cleanup occurred
3. **Verify Storage Integrity**: Test storage read/write operations
4. **Check Browser Storage**: Ensure Chrome storage isn't corrupted

**Solutions**:
1. **Adjust Retention**: Increase retention period if too short
2. **Disable Auto-cleanup**: Turn off automatic cleanup temporarily
3. **Export Regularly**: Create regular backups of important logs
4. **Reset Storage**: Clear and reinitialize storage if corrupted

### Slow Storage Performance

**Problem**: Extension becomes slow when accessing logs

**Causes**:
- Large number of stored logs
- Inefficient database queries
- Insufficient system resources

**Solutions**:
1. **Reduce Log Volume**: Clear old or unnecessary logs
2. **Optimize Queries**: Use specific filters instead of browsing all logs
3. **Increase System Resources**: Close other applications
4. **Paginate Results**: Use smaller page sizes for log browsing

## Performance Problems

### Browser Slowdown

**Problem**: Chrome becomes slow when extension is active

**Diagnostic Steps**:
1. **Monitor CPU Usage**: Check if extension is using excessive CPU
2. **Check Memory Usage**: Monitor extension memory consumption
3. **Test Without Extension**: Disable to confirm it's the cause
4. **Profile Performance**: Use Chrome's task manager

**Solutions**:
1. **Reduce Capture Scope**: Limit log levels or use keyword filters
2. **Adjust Settings**: Lower retention periods and storage limits
3. **Close Unused Tabs**: Reduce active capture points
4. **Update Chrome**: Ensure latest browser version

### Extension UI Lag

**Problem**: Extension popup or options page is slow/unresponsive

**Causes**:
- Large number of logs to display
- Inefficient UI rendering
- Background processing conflicts

**Solutions**:
1. **Use Pagination**: Browse logs in smaller chunks
2. **Apply Filters**: Reduce displayed log count with filters
3. **Clear Display Cache**: Refresh the options page
4. **Restart Extension**: Disable and re-enable to reset state

### High Memory Usage

**Problem**: Extension uses excessive memory

**Diagnostic Steps**:
1. **Check Task Manager**: Monitor extension memory in Chrome task manager
2. **Profile Memory**: Use Chrome DevTools memory profiler
3. **Test Different Scenarios**: Compare memory usage across different sites

**Solutions**:
1. **Reduce Buffer Size**: Lower internal log buffers
2. **Clear Caches**: Reset extension caches and temporary data
3. **Limit Concurrent Capture**: Reduce number of active tabs
4. **Optimize Settings**: Use more restrictive capture settings

## Export Issues

### Export Fails to Start

**Problem**: Export button doesn't work or shows errors

**Diagnostic Steps**:
1. **Check Log Selection**: Verify logs are selected for export
2. **Test Different Formats**: Try JSON, CSV, and plain text
3. **Check Browser Permissions**: Verify download permissions
4. **Review Console Errors**: Check browser console for JavaScript errors

**Solutions**:
1. **Reduce Export Size**: Use filters to limit export data
2. **Try Different Format**: Some formats handle large data better
3. **Clear Browser Cache**: Reset browser download cache
4. **Restart Extension**: Disable and re-enable extension

### Large Export Problems

**Problem**: Exports fail or are corrupted for large datasets

**Solutions**:
1. **Use Date Filters**: Export smaller time ranges
2. **Filter by Website**: Export one domain at a time
3. **Use Pagination**: Export in multiple smaller chunks
4. **Try Different Format**: JSON may handle large data better than CSV

### Export Security Warnings

**Problem**: Extension warns about sensitive data in exports

**Understanding Warnings**:
- Extension detects potential API keys, passwords, tokens
- Warnings help prevent accidental data exposure
- You can choose to proceed or filter out sensitive data

**Solutions**:
1. **Review Content**: Manually check flagged content
2. **Use Keyword Filters**: Exclude sensitive terms before export
3. **Edit After Export**: Remove sensitive data from exported file
4. **Proceed with Caution**: Only if you're sure data is safe to export

## UI Problems

### Popup Won't Open

**Problem**: Clicking extension icon doesn't show popup

**Solutions**:
1. **Check Extension Status**: Verify extension is enabled
2. **Reload Extension**: Disable and re-enable
3. **Clear Extension Cache**: Reset extension data
4. **Check for Conflicts**: Disable other extensions temporarily

### Options Page Issues

**Problem**: Options page doesn't load or shows errors

**Diagnostic Steps**:
1. **Check Console Errors**: Open DevTools on options page
2. **Test in Incognito**: Try opening options in incognito mode
3. **Clear Extension Data**: Reset extension settings

**Solutions**:
1. **Refresh Page**: Reload the options page
2. **Clear Browser Cache**: Reset Chrome cache
3. **Reset Settings**: Restore default extension settings
4. **Reinstall Extension**: Complete removal and reinstallation

### Display Issues

**Problem**: Logs don't display correctly or formatting is broken

**Solutions**:
1. **Refresh Interface**: Reload the options page
2. **Clear Display Cache**: Reset UI cache
3. **Check Browser Zoom**: Ensure normal zoom level (100%)
4. **Update Chrome**: Ensure latest browser version

## Frequently Asked Questions

### General Questions

**Q: Does the extension work on all websites?**
A: The extension works on most websites, but some sites with strict Content Security Policies (like chrome:// pages) may block content script injection.

**Q: Can I use this extension in incognito mode?**
A: Yes, but you need to enable "Allow in incognito" in the extension settings at `chrome://extensions/`.

**Q: Does the extension slow down websites?**
A: The extension has minimal performance impact. It only intercepts console methods and doesn't modify page functionality.

**Q: How much storage does the extension use?**
A: Storage usage depends on log volume. You can monitor and configure storage limits in the extension settings.

### Privacy & Security

**Q: Is my data sent to external servers?**
A: No, all data is stored locally on your device using Chrome's secure storage APIs. No data is transmitted externally.

**Q: Can other extensions access my logs?**
A: No, the data is isolated to this extension only and cannot be accessed by other extensions or websites.

**Q: What happens to my data if I uninstall the extension?**
A: You'll be prompted to choose whether to keep or delete your stored logs during uninstallation.

### Technical Questions

**Q: Does this work with React/Angular/Vue applications?**
A: Yes, the extension captures console logs from any JavaScript application or framework.

**Q: Can I export logs programmatically?**
A: Currently, exports are manual through the UI. Programmatic export may be added in future versions.

**Q: Does this capture logs from service workers?**
A: Currently, only main thread console logs are captured. Service worker support may be added later.

**Q: Can I sync logs across multiple devices?**
A: Currently, logs are stored locally only. Cloud sync may be considered for future versions.

### Usage Questions

**Q: How do I capture logs from a specific website only?**
A: Use website-specific settings in Options → Settings → Website Settings to configure per-domain capture.

**Q: Can I automatically filter out debug logs?**
A: Yes, use keyword filters to exclude logs containing "debug" or other unwanted terms.

**Q: How do I backup my logs?**
A: Use the export functionality to save logs in JSON format, which preserves all metadata.

**Q: Can I import logs from other tools?**
A: Currently, the extension doesn't support importing. This may be added in future versions.

## Advanced Troubleshooting

### Chrome DevTools Debugging

1. **Background Script Debugging**:
   - Go to `chrome://extensions/`
   - Click "Inspect views: background page"
   - Check console for errors

2. **Content Script Debugging**:
   - Open DevTools on target webpage (F12)
   - Check console for content script errors
   - Look for injection failures

3. **Extension Storage Debugging**:
   ```javascript
   // In background script console
   chrome.storage.local.get(null, console.log);
   ```

### Manual Reset Procedures

1. **Complete Extension Reset**:
   - Go to `chrome://extensions/`
   - Remove the extension
   - Clear Chrome cache
   - Reinstall extension

2. **Storage Reset Only**:
   - Open extension options
   - Go to Settings → Advanced
   - Click "Reset All Data"

3. **Settings Reset**:
   - Open extension options
   - Go to Settings → Advanced
   - Click "Reset Settings to Default"

### Log Collection for Bug Reports

When reporting issues, include:

1. **Chrome Version**: Help → About Google Chrome
2. **Extension Version**: Check in `chrome://extensions/`
3. **Error Messages**: Copy exact error text
4. **Console Logs**: Browser console errors
5. **Steps to Reproduce**: Detailed reproduction steps
6. **System Info**: Operating system and version

### Contact Support

If issues persist after trying these solutions:

1. **GitHub Issues**: Report bugs with detailed information
2. **Feature Requests**: Submit enhancement requests
3. **Community Support**: Check discussions for community help
4. **Documentation**: Review README and user guide

Remember to include relevant system information and detailed steps to reproduce any issues when seeking support.