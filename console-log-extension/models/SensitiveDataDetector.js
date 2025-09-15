/**
 * SensitiveDataDetector - Detects potentially sensitive data in console logs
 * Provides warnings and validation for export operations
 */

class SensitiveDataDetector {
  constructor() {
    // Common patterns for sensitive data detection
    this.patterns = {
      // API Keys and Tokens
      apiKey: {
        regex: /(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key)\s*[:=]\s*['"]*([a-zA-Z0-9_-]{16,})['"]*|Bearer\s+([a-zA-Z0-9_.-]{20,})/gi,
        description: 'API keys or access tokens',
        severity: 'high'
      },
      // Generic API key label (value length-agnostic; conservative high severity)
      apiKeyLabel: {
        regex: /api\s*key\s*[:=]\s*[^\s"']+/gi,
        description: 'API key label present',
        severity: 'high'
      },
      
      // JWT Tokens
      jwt: {
        regex: /eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        description: 'JWT tokens',
        severity: 'high'
      },
      
      // Passwords
      password: {
        regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]*([^'"\s]{6,})['"]*|"password"\s*:\s*"([^"]{6,})"/gi,
        description: 'Passwords',
        severity: 'critical'
      },
      
      // Credit Card Numbers
      creditCard: {
        regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
        description: 'Credit card numbers',
        severity: 'critical'
      },
      
      // Social Security Numbers
      ssn: {
        regex: /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g,
        description: 'Social Security Numbers',
        severity: 'critical'
      },
      
      // Email Addresses (in certain contexts)
      email: {
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        description: 'Email addresses',
        severity: 'medium'
      },
      
      // Phone Numbers
      phone: {
        regex: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
        description: 'Phone numbers',
        severity: 'medium'
      },
      
      // IP Addresses (private ranges)
      privateIP: {
        regex: /\b(?:10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.)\d{1,3}\.\d{1,3}\b/g,
        description: 'Private IP addresses',
        severity: 'low'
      },
      
      // Database Connection Strings
      dbConnection: {
        regex: /(?:mongodb|mysql|postgresql|sqlite):\/\/[^\s'"]+|(?:host|server|database|db)\s*[:=]\s*['"]*[^'"\s]+['"]*|connection[_-]?string/gi,
        description: 'Database connection strings',
        severity: 'high'
      },
      
      // AWS Keys
      awsKey: {
        regex: /AKIA[0-9A-Z]{16}|(?:aws[_-]?access[_-]?key|aws[_-]?secret)/gi,
        description: 'AWS access keys',
        severity: 'critical'
      },
      
      // Generic secrets
      secret: {
        regex: /(?:secret|token|key)\s*[:=]\s*['"]*([a-zA-Z0-9_-]{20,})['"]*|[a-zA-Z0-9]{32,}/gi,
        description: 'Generic secrets or long alphanumeric strings',
        severity: 'medium'
      }
    };
  }

  /**
   * Scan logs for sensitive data
   * @param {Array} logs - Array of log entries to scan
   * @returns {Object} Detection results with warnings and statistics
   */
  scanLogs(logs) {
    const results = {
      hasSensitiveData: false,
      totalMatches: 0,
      severityCount: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      detectedPatterns: [],
      affectedLogs: [],
      recommendations: []
    };

    logs.forEach((log, index) => {
      const logMatches = this.scanLogEntry(log);
      
      if (logMatches.length > 0) {
        results.hasSensitiveData = true;
        results.totalMatches += logMatches.length;
        
        const logResult = {
          logIndex: index,
          logId: log.id,
          timestamp: log.timestamp,
          domain: log.domain,
          matches: logMatches
        };
        
        results.affectedLogs.push(logResult);
        
        // Count severity levels and track patterns
        logMatches.forEach(match => {
          results.severityCount[match.severity]++;
          
          if (!results.detectedPatterns.find(p => p.type === match.type)) {
            results.detectedPatterns.push({
              type: match.type,
              description: match.description,
              severity: match.severity,
              count: 1
            });
          } else {
            const pattern = results.detectedPatterns.find(p => p.type === match.type);
            pattern.count++;
          }
        });
      }
    });

    // Generate recommendations based on findings
    results.recommendations = this.generateRecommendations(results);

    return results;
  }

  /**
   * Scan a single log entry for sensitive data
   * @param {Object} log - Log entry to scan
   * @returns {Array} Array of matches found
   */
  scanLogEntry(log) {
    const matches = [];
    const textToScan = `${log.message} ${JSON.stringify(log.args || [])}`;

    Object.entries(this.patterns).forEach(([type, pattern]) => {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      
      while ((match = regex.exec(textToScan)) !== null) {
        matches.push({
          type,
          description: pattern.description,
          severity: pattern.severity,
          matchedText: match[0],
          position: match.index,
          context: this.getContext(textToScan, match.index, match[0].length)
        });
      }
    });

    return matches;
  }

  /**
   * Get context around a match for better understanding
   * @param {string} text - Full text
   * @param {number} position - Match position
   * @param {number} length - Match length
   * @returns {string} Context string
   */
  getContext(text, position, length) {
    const contextLength = 20;
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + length + contextLength);
    
    let context = text.substring(start, end);
    
    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  /**
   * Generate recommendations based on scan results
   * @param {Object} results - Scan results
   * @returns {Array} Array of recommendation strings
   */
  generateRecommendations(results) {
    const recommendations = [];

    if (results.severityCount.critical > 0) {
      recommendations.push('CRITICAL: Passwords, credit card numbers, or SSNs detected. Do not export this data.');
      recommendations.push('Consider filtering out logs containing sensitive personal information.');
    }

    if (results.severityCount.high > 0) {
      recommendations.push('HIGH RISK: API keys, tokens, or database credentials detected.');
      recommendations.push('Review logs carefully before sharing and consider redacting sensitive values.');
    }

    if (results.severityCount.medium > 0) {
      recommendations.push('MEDIUM RISK: Email addresses or potentially sensitive data detected.');
      recommendations.push('Verify that sharing this information complies with your privacy policies.');
    }

    if (results.severityCount.low > 0) {
      recommendations.push('LOW RISK: Internal IP addresses or system information detected.');
      recommendations.push('Consider whether internal network information should be shared externally.');
    }

    if (results.hasSensitiveData) {
      recommendations.push('Consider using filtered exports to exclude sensitive logs.');
      recommendations.push('Review your application\'s logging practices to avoid logging sensitive data.');
    }

    return recommendations;
  }

  /**
   * Validate export request and generate warnings
   * @param {Array} logs - Logs to be exported
   * @param {Object} exportOptions - Export configuration
   * @returns {Object} Validation result with warnings and approval status
   */
  validateExport(logs, exportOptions = {}) {
    const scanResults = this.scanLogs(logs);
    
    const validation = {
      approved: true,
      warnings: [],
      errors: [],
      requiresConfirmation: false,
      scanResults
    };

    // Check for critical data
    if (scanResults.severityCount.critical > 0) {
      validation.approved = false;
      validation.requiresConfirmation = true;
      validation.errors.push('Critical sensitive data detected (passwords, credit cards, SSNs)');
      validation.warnings.push('Exporting this data may violate privacy regulations and security policies');
    }

    // Check for high-risk data
    if (scanResults.severityCount.high > 0) {
      validation.requiresConfirmation = true;
      validation.warnings.push('High-risk data detected (API keys, tokens, credentials)');
      validation.warnings.push('Sharing this data could compromise system security');
    }

    // Check export size
    if (logs.length > 10000) {
      validation.warnings.push('Large export detected - consider filtering to reduce data exposure');
    }

    // Check if exporting to external format
    if (exportOptions.format && ['csv', 'text'].includes(exportOptions.format)) {
      validation.warnings.push('Plain text formats may not preserve data security - consider JSON format for internal use');
    }

    // Add recommendations
    validation.recommendations = scanResults.recommendations;

    return validation;
  }

  /**
   * Generate a security summary for export confirmation
   * @param {Object} scanResults - Results from scanning logs
   * @returns {Object} Security summary for user display
   */
  generateSecuritySummary(scanResults) {
    const summary = {
      riskLevel: this.calculateRiskLevel(scanResults),
      totalIssues: scanResults.totalMatches,
      affectedLogs: scanResults.affectedLogs.length,
      patternSummary: scanResults.detectedPatterns.map(pattern => ({
        type: pattern.description,
        count: pattern.count,
        severity: pattern.severity
      })),
      topRecommendations: scanResults.recommendations.slice(0, 3)
    };

    return summary;
  }

  /**
   * Calculate overall risk level based on detected patterns
   * @param {Object} scanResults - Scan results
   * @returns {string} Risk level (critical, high, medium, low, none)
   */
  calculateRiskLevel(scanResults) {
    if (scanResults.severityCount.critical > 0) return 'critical';
    if (scanResults.severityCount.high > 0) return 'high';
    if (scanResults.severityCount.medium > 0) return 'medium';
    if (scanResults.severityCount.low > 0) return 'low';
    return 'none';
  }

  /**
   * Create a redacted version of logs for safe preview
   * @param {Array} logs - Original logs
   * @returns {Array} Logs with sensitive data redacted
   */
  createRedactedPreview(logs) {
    return logs.map(log => {
      const redactedLog = { ...log };
      const matches = this.scanLogEntry(log);
      
      if (matches.length > 0) {
        let redactedMessage = log.message;
        let redactedArgs = JSON.stringify(log.args || []);
        
        // Sort matches by position (descending) to avoid position shifts during replacement
        matches.sort((a, b) => b.position - a.position);
        
        matches.forEach(match => {
          const replacement = this.getRedactionReplacement(match);
          
          if (match.position < log.message.length) {
            // Match is in message
            const localPos = match.position;
            redactedMessage = redactedMessage.substring(0, localPos) + 
                            replacement + 
                            redactedMessage.substring(localPos + match.matchedText.length);
          } else {
            // Match is in args
            const argsStart = log.message.length + 1;
            const localPos = match.position - argsStart;
            redactedArgs = redactedArgs.substring(0, localPos) + 
                          replacement + 
                          redactedArgs.substring(localPos + match.matchedText.length);
          }
        });
        
        redactedLog.message = redactedMessage;
        try {
          redactedLog.args = JSON.parse(redactedArgs);
        } catch (e) {
          redactedLog.args = ['[REDACTED]'];
        }
        redactedLog._hasRedactions = true;
      }
      
      return redactedLog;
    });
  }

  /**
   * Get appropriate redaction replacement for a match
   * @param {Object} match - Match object
   * @returns {string} Redaction replacement
   */
  getRedactionReplacement(match) {
    const replacements = {
      critical: '[REDACTED-CRITICAL]',
      high: '[REDACTED-SENSITIVE]',
      medium: '[REDACTED]',
      low: '[FILTERED]'
    };
    
    return replacements[match.severity] || '[REDACTED]';
  }
}



// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SensitiveDataDetector;
} else if (typeof window !== 'undefined') {
  window.SensitiveDataDetector = SensitiveDataDetector;
} else if (typeof self !== 'undefined') {
  self.SensitiveDataDetector = SensitiveDataDetector;
}


