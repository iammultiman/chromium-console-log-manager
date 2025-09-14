/**
 * Debug Extension Script
 * Comprehensive testing and debugging utilities for the Console Log Extension
 */

class ExtensionDebugger {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  /**
   * Run all debug tests
   */
  async runAllTests() {
    console.log('🔍 Starting Extension Debug Tests...');
    
    // Test 1: Model Loading
    await this.testModelLoading();
    
    // Test 2: Background Script Communication
    await this.testBackgroundCommunication();
    
    // Test 3: Options Page Functionality
    await this.testOptionsPageFunctionality();
    
    // Test 4: Popup Functionality
    await this.testPopupFunctionality();
    
    // Test 5: Error Handling
    await this.testErrorHandling();
    
    // Test 6: CSP Compliance
    await this.testCSPCompliance();
    
    // Generate report
    this.generateReport();
  }

  /**
   * Test model loading and availability
   */
  async testModelLoading() {
    console.log('📦 Testing Model Loading...');
    
    const requiredModels = [
      'LogEntry', 'FilterCriteria', 'StorageManager', 'ExtensionSettings',
      'KeywordFilters', 'ExportManager', 'SensitiveDataDetector',
      'NotificationManager', 'ErrorHandler'
    ];

    const results = {
      name: 'Model Loading',
      passed: 0,
      failed: 0,
      details: []
    };

    for (const model of requiredModels) {
      try {
        if (typeof window[model] === 'function') {
          // Try to instantiate
          const instance = new window[model]();
          results.passed++;
          results.details.push(`✅ ${model}: Available and instantiable`);
        } else {
          results.failed++;
          results.details.push(`❌ ${model}: Not available or not a constructor`);
        }
      } catch (error) {
        results.failed++;
        results.details.push(`❌ ${model}: Error during instantiation - ${error.message}`);
      }
    }

    this.results.push(results);
  }

  /**
   * Test background script communication
   */
  async testBackgroundCommunication() {
    console.log('📡 Testing Background Communication...');
    
    const results = {
      name: 'Background Communication',
      passed: 0,
      failed: 0,
      details: []
    };

    const messageTypes = [
      'PING',
      'GET_SETTINGS',
      'GET_LOGS',
      'GET_RECENT_LOGS',
      'GET_STATISTICS'
    ];

    for (const messageType of messageTypes) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: messageType,
          data: messageType === 'GET_LOGS' ? { limit: 1 } : {}
        });

        if (response && !response.error) {
          results.passed++;
          results.details.push(`✅ ${messageType}: Response received`);
        } else {
          results.failed++;
          results.details.push(`❌ ${messageType}: Error response - ${response?.error || 'Unknown error'}`);
        }
      } catch (error) {
        results.failed++;
        results.details.push(`❌ ${messageType}: Communication failed - ${error.message}`);
      }
    }

    this.results.push(results);
  }

  /**
   * Test options page functionality
   */
  async testOptionsPageFunctionality() {
    console.log('⚙️ Testing Options Page Functionality...');
    
    const results = {
      name: 'Options Page Functionality',
      passed: 0,
      failed: 0,
      details: []
    };

    // Test tab navigation
    try {
      const navButtons = document.querySelectorAll('.nav-btn');
      const tabContents = document.querySelectorAll('.tab-content');
      
      if (navButtons.length > 0 && tabContents.length > 0) {
        results.passed++;
        results.details.push('✅ Tab navigation elements found');
      } else {
        results.failed++;
        results.details.push('❌ Tab navigation elements missing');
      }
    } catch (error) {
      results.failed++;
      results.details.push(`❌ Tab navigation test failed - ${error.message}`);
    }

    // Test filter controls
    try {
      const searchInput = document.getElementById('log-search');
      const levelFilter = document.getElementById('level-filter');
      const applyFilters = document.getElementById('apply-filters');
      
      if (searchInput && levelFilter && applyFilters) {
        results.passed++;
        results.details.push('✅ Filter controls found');
      } else {
        results.failed++;
        results.details.push('❌ Filter controls missing');
      }
    } catch (error) {
      results.failed++;
      results.details.push(`❌ Filter controls test failed - ${error.message}`);
    }

    // Test options manager
    try {
      if (window.optionsManager && typeof window.optionsManager.loadLogs === 'function') {
        results.passed++;
        results.details.push('✅ Options manager initialized');
      } else {
        results.failed++;
        results.details.push('❌ Options manager not initialized');
      }
    } catch (error) {
      results.failed++;
      results.details.push(`❌ Options manager test failed - ${error.message}`);
    }

    this.results.push(results);
  }

  /**
   * Test popup functionality
   */
  async testPopupFunctionality() {
    console.log('🔧 Testing Popup Functionality...');
    
    const results = {
      name: 'Popup Functionality',
      passed: 0,
      failed: 0,
      details: []
    };

    // This test only runs if we're in a popup context
    if (window.location.pathname.includes('popup.html')) {
      try {
        const enableToggle = document.getElementById('enable-toggle');
        const openOptionsBtn = document.getElementById('open-options');
        const recentLogsList = document.getElementById('recent-logs-list');
        
        if (enableToggle && openOptionsBtn && recentLogsList) {
          results.passed++;
          results.details.push('✅ Popup elements found');
        } else {
          results.failed++;
          results.details.push('❌ Popup elements missing');
        }
      } catch (error) {
        results.failed++;
        results.details.push(`❌ Popup elements test failed - ${error.message}`);
      }
    } else {
      results.details.push('ℹ️ Popup test skipped (not in popup context)');
    }

    this.results.push(results);
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    console.log('🚨 Testing Error Handling...');
    
    const results = {
      name: 'Error Handling',
      passed: 0,
      failed: 0,
      details: []
    };

    try {
      // Test ErrorHandler instantiation
      const errorHandler = new ErrorHandler();
      
      // Test error normalization
      const normalizedError = errorHandler.normalizeError(new Error('Test error'));
      if (normalizedError.message === 'Test error') {
        results.passed++;
        results.details.push('✅ Error normalization works');
      } else {
        results.failed++;
        results.details.push('❌ Error normalization failed');
      }

      // Test safe stringify
      const complexObject = { a: 1, b: { c: 2 } };
      complexObject.circular = complexObject; // Create circular reference
      
      const stringified = errorHandler.safeStringify(complexObject);
      if (stringified.includes('Circular Reference')) {
        results.passed++;
        results.details.push('✅ Safe stringify handles circular references');
      } else {
        results.failed++;
        results.details.push('❌ Safe stringify failed on circular references');
      }

    } catch (error) {
      results.failed++;
      results.details.push(`❌ Error handling test failed - ${error.message}`);
    }

    this.results.push(results);
  }

  /**
   * Test CSP compliance
   */
  async testCSPCompliance() {
    console.log('🔒 Testing CSP Compliance...');
    
    const results = {
      name: 'CSP Compliance',
      passed: 0,
      failed: 0,
      details: []
    };

    // Check for inline scripts
    const inlineScripts = document.querySelectorAll('script:not([src])');
    if (inlineScripts.length === 0) {
      results.passed++;
      results.details.push('✅ No inline scripts found');
    } else {
      results.failed++;
      results.details.push(`❌ Found ${inlineScripts.length} inline scripts`);
    }

    // Check for inline event handlers
    const elementsWithInlineEvents = document.querySelectorAll('[onclick], [onload], [onerror]');
    if (elementsWithInlineEvents.length === 0) {
      results.passed++;
      results.details.push('✅ No inline event handlers found');
    } else {
      results.failed++;
      results.details.push(`❌ Found ${elementsWithInlineEvents.length} inline event handlers`);
    }

    this.results.push(results);
  }

  /**
   * Generate and display test report
   */
  generateReport() {
    console.log('\n📊 Extension Debug Report');
    console.log('========================');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    this.results.forEach(result => {
      console.log(`\n${result.name}:`);
      console.log(`  Passed: ${result.passed}`);
      console.log(`  Failed: ${result.failed}`);
      
      result.details.forEach(detail => {
        console.log(`  ${detail}`);
      });
      
      totalPassed += result.passed;
      totalFailed += result.failed;
    });
    
    console.log('\n========================');
    console.log(`Total Passed: ${totalPassed}`);
    console.log(`Total Failed: ${totalFailed}`);
    console.log(`Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
    
    if (totalFailed === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('⚠️ Some tests failed. Check the details above.');
    }
  }

  /**
   * Test specific functionality
   */
  async testSpecificFunction(functionName, ...args) {
    try {
      console.log(`🔍 Testing ${functionName}...`);
      
      if (window.optionsManager && typeof window.optionsManager[functionName] === 'function') {
        const result = await window.optionsManager[functionName](...args);
        console.log(`✅ ${functionName} executed successfully:`, result);
        return result;
      } else {
        console.log(`❌ ${functionName} not found or not a function`);
        return null;
      }
    } catch (error) {
      console.log(`❌ ${functionName} failed:`, error);
      return null;
    }
  }

  /**
   * Monitor extension performance
   */
  startPerformanceMonitoring() {
    console.log('📈 Starting performance monitoring...');
    
    // Monitor memory usage
    if (performance.memory) {
      setInterval(() => {
        const memory = performance.memory;
        console.log('Memory Usage:', {
          used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + ' MB',
          total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + ' MB',
          limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
        });
      }, 30000); // Every 30 seconds
    }

    // Monitor error frequency
    let errorCount = 0;
    const originalConsoleError = console.error;
    console.error = function(...args) {
      errorCount++;
      originalConsoleError.apply(console, args);
      
      if (errorCount > 10) {
        console.warn('⚠️ High error frequency detected:', errorCount, 'errors');
      }
    };
  }
}

// Auto-run debug tests when script loads
if (typeof window !== 'undefined') {
  window.ExtensionDebugger = ExtensionDebugger;
  
  // Auto-run tests after a short delay to allow other scripts to load
  setTimeout(async () => {
    const debugger = new ExtensionDebugger();
    await debugger.runAllTests();
    
    // Start performance monitoring
    debugger.startPerformanceMonitoring();
    
    // Make debugger available globally for manual testing
    window.debugExtension = debugger;
    console.log('💡 Use window.debugExtension.testSpecificFunction("functionName") for manual testing');
  }, 2000);
}