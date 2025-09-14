/**
 * Test Results Processor
 * Processes and enhances test results with additional metrics and reporting
 */

const fs = require('fs');
const path = require('path');

module.exports = (results) => {
  // Calculate additional metrics
  const metrics = {
    totalTests: results.numTotalTests,
    passedTests: results.numPassedTests,
    failedTests: results.numFailedTests,
    skippedTests: results.numPendingTests,
    testSuites: results.numTotalTestSuites,
    passedTestSuites: results.numPassedTestSuites,
    failedTestSuites: results.numFailedTestSuites,
    totalTime: results.testResults.reduce((sum, result) => sum + (result.perfStats?.end - result.perfStats?.start || 0), 0),
    averageTestTime: 0,
    slowestTests: [],
    fastestTests: [],
    testsByType: {
      unit: 0,
      integration: 0,
      performance: 0,
      security: 0,
      compatibility: 0
    },
    coverage: results.coverageMap ? {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    } : null
  };

  // Calculate average test time
  if (metrics.totalTests > 0) {
    metrics.averageTestTime = metrics.totalTime / metrics.totalTests;
  }

  // Analyze individual test results
  const testTimes = [];
  
  results.testResults.forEach(testResult => {
    testResult.testResults.forEach(test => {
      const testTime = test.duration || 0;
      testTimes.push({
        name: test.fullName,
        file: testResult.testFilePath,
        duration: testTime,
        status: test.status
      });

      // Categorize tests by type based on file path
      const filePath = testResult.testFilePath;
      if (filePath.includes('/integration/')) {
        metrics.testsByType.integration++;
      } else if (filePath.includes('/performance/')) {
        metrics.testsByType.performance++;
      } else if (filePath.includes('/security/')) {
        metrics.testsByType.security++;
      } else if (filePath.includes('/compatibility/')) {
        metrics.testsByType.compatibility++;
      } else {
        metrics.testsByType.unit++;
      }
    });
  });

  // Sort tests by duration
  testTimes.sort((a, b) => b.duration - a.duration);
  
  // Get slowest and fastest tests
  metrics.slowestTests = testTimes.slice(0, 10);
  metrics.fastestTests = testTimes.slice(-10).reverse();

  // Calculate coverage metrics if available
  if (results.coverageMap) {
    const coverageData = results.coverageMap.getCoverageSummary();
    metrics.coverage = {
      statements: coverageData.statements.pct,
      branches: coverageData.branches.pct,
      functions: coverageData.functions.pct,
      lines: coverageData.lines.pct
    };
  }

  // Generate performance insights
  const performanceInsights = generatePerformanceInsights(metrics, testTimes);

  // Generate quality insights
  const qualityInsights = generateQualityInsights(results, metrics);

  // Create enhanced results object
  const enhancedResults = {
    ...results,
    customMetrics: metrics,
    performanceInsights,
    qualityInsights,
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage()
    }
  };

  // Write detailed results to file
  const outputDir = path.join(process.cwd(), 'coverage');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resultsFile = path.join(outputDir, 'test-results-detailed.json');
  fs.writeFileSync(resultsFile, JSON.stringify(enhancedResults, null, 2));

  // Write summary report
  const summaryFile = path.join(outputDir, 'test-summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify({
    summary: {
      success: results.success,
      totalTests: metrics.totalTests,
      passedTests: metrics.passedTests,
      failedTests: metrics.failedTests,
      coverage: metrics.coverage,
      totalTime: metrics.totalTime,
      averageTestTime: metrics.averageTestTime
    },
    insights: {
      performance: performanceInsights,
      quality: qualityInsights
    },
    timestamp: enhancedResults.timestamp
  }, null, 2));

  // Generate console summary
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${metrics.passedTests}/${metrics.totalTests}`);
  console.log(`❌ Failed: ${metrics.failedTests}`);
  console.log(`⏭️  Skipped: ${metrics.skippedTests}`);
  console.log(`⏱️  Total Time: ${(metrics.totalTime / 1000).toFixed(2)}s`);
  console.log(`📈 Average Test Time: ${metrics.averageTestTime.toFixed(2)}ms`);

  if (metrics.coverage) {
    console.log('\n📋 Coverage Summary:');
    console.log(`📄 Statements: ${metrics.coverage.statements.toFixed(1)}%`);
    console.log(`🌿 Branches: ${metrics.coverage.branches.toFixed(1)}%`);
    console.log(`🔧 Functions: ${metrics.coverage.functions.toFixed(1)}%`);
    console.log(`📝 Lines: ${metrics.coverage.lines.toFixed(1)}%`);
  }

  console.log('\n🏷️  Tests by Type:');
  Object.entries(metrics.testsByType).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`  ${type}: ${count}`);
    }
  });

  if (performanceInsights.length > 0) {
    console.log('\n⚡ Performance Insights:');
    performanceInsights.slice(0, 3).forEach(insight => {
      console.log(`  • ${insight}`);
    });
  }

  if (qualityInsights.length > 0) {
    console.log('\n🎯 Quality Insights:');
    qualityInsights.slice(0, 3).forEach(insight => {
      console.log(`  • ${insight}`);
    });
  }

  return results;
};

function generatePerformanceInsights(metrics, testTimes) {
  const insights = [];

  // Slow test detection
  const slowTests = testTimes.filter(test => test.duration > 5000);
  if (slowTests.length > 0) {
    insights.push(`${slowTests.length} tests are taking longer than 5 seconds`);
  }

  // Performance test analysis
  const performanceTests = testTimes.filter(test => 
    test.file.includes('/performance/') && test.status === 'passed'
  );
  if (performanceTests.length > 0) {
    const avgPerfTime = performanceTests.reduce((sum, test) => sum + test.duration, 0) / performanceTests.length;
    insights.push(`Performance tests average ${avgPerfTime.toFixed(0)}ms execution time`);
  }

  // Test distribution analysis
  if (metrics.testsByType.unit > metrics.testsByType.integration * 3) {
    insights.push('Good unit to integration test ratio maintained');
  } else if (metrics.testsByType.integration > metrics.testsByType.unit) {
    insights.push('Consider adding more unit tests for better test pyramid');
  }

  return insights;
}

function generateQualityInsights(results, metrics) {
  const insights = [];

  // Coverage analysis
  if (metrics.coverage) {
    if (metrics.coverage.statements < 80) {
      insights.push(`Statement coverage (${metrics.coverage.statements.toFixed(1)}%) is below 80% threshold`);
    }
    if (metrics.coverage.branches < 80) {
      insights.push(`Branch coverage (${metrics.coverage.branches.toFixed(1)}%) is below 80% threshold`);
    }
    if (metrics.coverage.functions >= 90) {
      insights.push(`Excellent function coverage (${metrics.coverage.functions.toFixed(1)}%)`);
    }
  }

  // Test reliability
  const flakyTests = results.testResults.filter(result => 
    result.testResults.some(test => test.status === 'failed' && test.failureMessages.length === 0)
  );
  if (flakyTests.length > 0) {
    insights.push(`${flakyTests.length} potentially flaky tests detected`);
  }

  // Test completeness
  const testTypes = Object.values(metrics.testsByType).filter(count => count > 0).length;
  if (testTypes >= 4) {
    insights.push('Comprehensive test coverage across all test types');
  } else {
    insights.push(`Consider adding tests for missing types (${5 - testTypes} types missing)`);
  }

  // Success rate
  const successRate = (metrics.passedTests / metrics.totalTests) * 100;
  if (successRate >= 95) {
    insights.push(`Excellent test success rate (${successRate.toFixed(1)}%)`);
  } else if (successRate < 90) {
    insights.push(`Test success rate (${successRate.toFixed(1)}%) needs improvement`);
  }

  return insights;
}