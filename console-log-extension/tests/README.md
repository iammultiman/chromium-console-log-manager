# Test Suite Documentation

This document provides comprehensive information about the test suite for the Console Log Extension.

## Overview

The test suite is organized into multiple categories to ensure comprehensive coverage of all extension functionality:

- **Unit Tests**: Test individual components and functions in isolation
- **Integration Tests**: Test component interactions and end-to-end workflows
- **Performance Tests**: Validate performance characteristics and resource usage
- **Security Tests**: Ensure data isolation and security requirements
- **Compatibility Tests**: Verify functionality across different browser environments

## Test Structure

```
tests/
├── setup/                    # Test configuration and setup
│   ├── jest.setup.js        # Global Jest configuration
│   └── test-results-processor.js  # Custom test result processing
├── integration/             # Integration and E2E tests
│   ├── end-to-end-log-flow.test.js
│   ├── cross-component-communication.test.js
│   ├── extension-lifecycle.test.js
│   └── chrome-api-integration.test.js
├── performance/             # Performance and efficiency tests
│   ├── large-volume-performance.test.js
│   └── memory-efficiency.test.js
├── security/                # Security and data isolation tests
│   └── data-isolation.test.js
├── compatibility/           # Browser compatibility tests
│   └── browser-compatibility.test.js
└── [component-tests]/       # Unit tests for individual components
    ├── LogEntry.test.js
    ├── StorageManager.test.js
    └── [other-component-tests]
```

## Running Tests

### All Tests
```bash
npm test
```

### By Category
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:performance   # Performance tests only
npm run test:security      # Security tests only
npm run test:compatibility # Compatibility tests only
```

### With Coverage
```bash
npm run test:coverage      # Run all tests with coverage report
```

### Development Mode
```bash
npm run test:watch         # Watch mode for development
npm run test:verbose       # Verbose output
npm run test:debug         # Debug mode with inspector
```

### CI Mode
```bash
npm run test:ci           # Optimized for CI environments
```

## Test Categories

### Unit Tests

Unit tests focus on testing individual components in isolation. They should:

- Test a single function or class method
- Use mocks for external dependencies
- Be fast and reliable
- Have clear, descriptive test names
- Follow the AAA pattern (Arrange, Act, Assert)

**Example:**
```javascript
describe('LogEntry', () => {
  test('should create log entry with correct properties', () => {
    // Arrange
    const level = 'error';
    const message = 'Test error';
    const url = 'https://example.com';
    
    // Act
    const logEntry = new LogEntry(level, message, [message], url, 1);
    
    // Assert
    expect(logEntry.level).toBe(level);
    expect(logEntry.message).toBe(message);
    expect(logEntry.domain).toBe('example.com');
  });
});
```

### Integration Tests

Integration tests verify that components work together correctly. They should:

- Test complete workflows and user scenarios
- Use minimal mocking (only for external services)
- Validate data flow between components
- Test error handling and edge cases

**Key Integration Test Areas:**
- End-to-end log capture and storage flow
- Cross-component message passing
- Extension lifecycle events
- Chrome API integration

### Performance Tests

Performance tests ensure the extension performs well under various conditions:

- **Load Testing**: Handle large volumes of log data
- **Memory Testing**: Monitor memory usage and detect leaks
- **Timing Tests**: Verify operations complete within acceptable timeframes
- **Concurrency Tests**: Handle multiple simultaneous operations

**Performance Thresholds:**
- Log insertion: >100 logs/second
- Query operations: <1 second for 10,000 logs
- Memory usage: <10KB per stored log
- Startup time: <500ms

### Security Tests

Security tests validate data protection and isolation:

- **Data Isolation**: Ensure logs from different domains don't mix
- **Sensitive Data Detection**: Verify sensitive information is flagged
- **Access Control**: Test that unauthorized access is prevented
- **Export Security**: Validate export warnings and data sanitization

### Compatibility Tests

Compatibility tests ensure the extension works across different environments:

- **Chrome Versions**: Test with different Chrome versions
- **Manifest Versions**: Validate V2 and V3 compatibility
- **Operating Systems**: Test on Windows, macOS, and Linux
- **API Variations**: Handle different Chrome API implementations

## Test Utilities

### Global Test Utilities

The test suite provides several utilities available in all tests:

```javascript
// Create mock log entries
const mockLog = testUtils.createMockLog({ level: 'error' });
const mockLogs = testUtils.createMockLogs(10);

// Performance measurement
const { result, duration } = await testUtils.measurePerformance(async () => {
  return await someAsyncOperation();
});

// Memory measurement
const memoryBefore = testUtils.measureMemory();
// ... perform operations
const memoryAfter = testUtils.measureMemory();

// Wait for async operations
await testUtils.waitFor(100);

// Reset all mocks
testUtils.resetMocks();
```

### Custom Matchers

The test suite includes custom Jest matchers:

```javascript
// Validate log structure
expect(logEntry).toHaveValidLogStructure();

// Check log levels
expect('error').toBeValidLogLevel();

// Range validation
expect(responseTime).toBeWithinRange(100, 500);
```

## Coverage Requirements

The test suite maintains high coverage standards:

- **Global Coverage**: 80% minimum for all metrics
- **Models**: 85% minimum (core business logic)
- **Background Scripts**: 75% minimum
- **UI Components**: 70% minimum

Coverage reports are generated in multiple formats:
- HTML report: `coverage/lcov-report/index.html`
- JSON report: `coverage/coverage-final.json`
- LCOV format: `coverage/lcov.info`

## Writing New Tests

### Test Naming Conventions

- Use descriptive test names that explain the scenario
- Follow the pattern: "should [expected behavior] when [condition]"
- Group related tests using `describe` blocks
- Use `test` or `it` for individual test cases

### Test Organization

1. **Arrange**: Set up test data and mocks
2. **Act**: Execute the code being tested
3. **Assert**: Verify the expected outcomes

### Mocking Guidelines

- Mock external dependencies (Chrome APIs, IndexedDB)
- Use real implementations for internal components when possible
- Reset mocks between tests using `beforeEach`
- Verify mock calls when testing interactions

### Async Testing

```javascript
// Use async/await for promises
test('should save logs asynchronously', async () => {
  const logs = [mockLog];
  await StorageManager.saveLogs(logs);
  expect(/* assertions */);
});

// Use done callback for callbacks
test('should handle callback-based APIs', (done) => {
  chrome.storage.sync.get(null, (result) => {
    expect(result).toBeDefined();
    done();
  });
});
```

## Debugging Tests

### Debug Mode
```bash
npm run test:debug
```

This starts the Node.js inspector, allowing you to:
- Set breakpoints in your tests
- Step through code execution
- Inspect variables and call stacks

### Verbose Output
```bash
npm run test:verbose
```

Provides detailed information about:
- Test execution order
- Setup and teardown operations
- Mock call details
- Performance metrics

### Isolating Tests

Run specific test files:
```bash
npx jest LogEntry.test.js
```

Run specific test cases:
```bash
npx jest --testNamePattern="should create log entry"
```

## Continuous Integration

The test suite is configured to run automatically on:

- **Pull Requests**: All test categories
- **Main Branch Pushes**: Full test suite with coverage
- **Scheduled Runs**: Daily comprehensive testing
- **Release Tags**: Complete validation including compatibility tests

### CI Test Matrix

- **Node.js Versions**: 16.x, 18.x, 20.x
- **Operating Systems**: Ubuntu, Windows, macOS
- **Test Categories**: All categories run in parallel
- **Coverage**: Uploaded to Codecov for tracking

## Performance Monitoring

Performance tests track key metrics:

- **Execution Time**: Individual test and suite timing
- **Memory Usage**: Heap usage before/after operations
- **Resource Utilization**: CPU and I/O metrics
- **Regression Detection**: Compare against baseline performance

Results are stored in `coverage/test-results-detailed.json` for analysis.

## Troubleshooting

### Common Issues

1. **Timeout Errors**: Increase timeout for slow operations
2. **Memory Leaks**: Use `global.gc()` and check cleanup
3. **Flaky Tests**: Add proper async handling and cleanup
4. **Mock Issues**: Verify mock setup and reset between tests

### Getting Help

- Check test output for detailed error messages
- Review the test setup in `tests/setup/jest.setup.js`
- Use debug mode to step through failing tests
- Check CI logs for environment-specific issues

## Best Practices

1. **Keep Tests Independent**: Each test should be able to run in isolation
2. **Use Descriptive Names**: Test names should clearly describe the scenario
3. **Test Edge Cases**: Include boundary conditions and error scenarios
4. **Maintain Fast Tests**: Unit tests should complete quickly
5. **Regular Cleanup**: Remove obsolete tests and update as code changes
6. **Document Complex Tests**: Add comments for complex test logic
7. **Monitor Performance**: Watch for test suite performance degradation