# Quick Test Guide for Fixed Issues

## 🚀 Testing the Fixes

### 1. Load the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `console-log-extension/dist`
4. Extension should load without errors

### 2. Test Log Capture on Real Web Pages
1. Open the test page: `file:///path/to/console-log-extension/test-page.html`
2. Click the buttons to generate different types of logs
3. Right-click extension icon → "Options"
4. Go to "Logs" tab
5. **Expected**: Should see logs from the test page, not just extension logs

### 3. Test Extension Log Filtering
1. In Options → Settings tab
2. Check "Hide extension's own logs"
3. Go back to Logs tab
4. **Expected**: Extension's own logs should be filtered out

### 4. Test Improved Log Display
1. Go to "Logs" tab
2. **Expected**: Log display area should be resizable (drag bottom edge)
3. **Expected**: Minimum height of 400px, maximum 70% of viewport
4. Try changing "Logs per page" in Settings
5. **Expected**: Pagination should update accordingly

### 5. Test Error Handler Fix
1. In browser console, you should see detailed error logs like:
```
Extension Error Details: {
  id: "err_1234567890_abc123",
  message: "Actual error message",
  type: "error_type",
  context: "{\n  \"key\": \"value\"\n}",  // Properly formatted JSON
  severity: "low"
}
```
2. **Expected**: No more "[object Object]" errors

### 6. Test Different Log Levels
1. Open test page and generate different log types
2. In Options → Logs tab, try filtering by level:
   - Set Level to "Error" → should show only error logs
   - Set Level to "Warning" → should show only warning logs
   - Set Level to "Info" → should show only info logs
   - Set Level to "Log" → should show only regular logs
3. **Expected**: Filters should work for all log types, not just "log"

### 7. Test Real Website Log Capture
1. Navigate to any website (e.g., https://example.com)
2. Open browser console (F12) and type:
```javascript
console.log('Test log from example.com');
console.error('Test error from example.com');
console.warn('Test warning from example.com');
```
3. Check extension options → Logs tab
4. **Expected**: Should see logs from the website

### 8. Test Background Communication
1. In browser console on options page, run:
```javascript
// Test background communication
chrome.runtime.sendMessage({type: 'PING'}).then(console.log);
```
2. **Expected**: Should return `{pong: true, timestamp: ...}`

## 🔍 What to Look For

### ✅ Success Indicators
- No CSP violation errors in console
- "Options page initialized successfully" message
- "All required models loaded successfully" message
- Tab navigation works smoothly
- Search and filters respond to input
- Detailed error logs (not "[object Object]")

### ❌ Failure Indicators
- CSP violation errors about inline scripts
- "Required models not loaded" errors
- "[object Object]" in error messages
- Tabs don't switch when clicked
- Search/filter controls don't respond
- JavaScript errors in console

## 🛠 If Issues Persist

### 1. Check Console Errors
- Open browser console (F12)
- Look for specific error messages
- Note which files/lines are causing issues

### 2. Verify File Loading
- Check Network tab in DevTools
- Ensure all script files are loading (200 status)
- Look for 404 errors on missing files

### 3. Test in Incognito Mode
- Load extension in incognito window
- Test basic functionality
- This helps isolate extension conflicts

### 4. Clear Extension Data
- Go to `chrome://extensions/`
- Click "Details" on the extension
- Click "Extension options" → Storage tab
- Click "Clear All Logs" to reset data

### 5. Reload Extension
- Go to `chrome://extensions/`
- Click reload button on the extension
- Test functionality again

## 📊 Debug Commands

### Test Specific Functions
```javascript
// Test log loading
window.debugExtension.testSpecificFunction('loadLogs');

// Test settings loading
window.debugExtension.testSpecificFunction('loadSettings');

// Test filter application
window.debugExtension.testSpecificFunction('applyFilters');
```

### Monitor Performance
```javascript
// Start performance monitoring
window.debugExtension.startPerformanceMonitoring();
```

### Check Model Availability
```javascript
// Check if all models are loaded
const models = ['LogEntry', 'FilterCriteria', 'StorageManager', 'ExtensionSettings'];
models.forEach(model => {
  console.log(`${model}:`, typeof window[model]);
});
```

## 🎯 Expected Results

After applying all fixes, you should see:

1. **Clean Console**: No CSP violations, no "[object Object]" errors
2. **Working UI**: All tabs, buttons, and controls respond properly
3. **Proper Initialization**: All models load and options page initializes
4. **Functional Search**: Search and filter controls work as expected
5. **Error Handling**: Detailed, readable error messages when issues occur

If all tests pass, the extension is ready for use and further development!