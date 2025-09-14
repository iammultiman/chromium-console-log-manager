/**
 * Unit tests for KeywordFilters class
 */

const KeywordFilters = require('../models/KeywordFilters.js');

describe('KeywordFilters', () => {
  let filters;

  beforeEach(() => {
    filters = new KeywordFilters();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(filters.include).toEqual([]);
      expect(filters.exclude).toEqual([]);
      expect(filters.caseSensitive).toBe(false);
    });
  });

  describe('setIncludeKeywords', () => {
    test('should set inclusion keywords', () => {
      filters.setIncludeKeywords(['error', 'warning']);
      expect(filters.include).toEqual(['error', 'warning']);
    });

    test('should filter out empty keywords', () => {
      filters.setIncludeKeywords(['error', '', '  ', 'warning']);
      expect(filters.include).toEqual(['error', 'warning']);
    });

    test('should handle non-array input', () => {
      filters.setIncludeKeywords('error');
      expect(filters.include).toEqual([]);
    });

    test('should return this for chaining', () => {
      const result = filters.setIncludeKeywords(['error']);
      expect(result).toBe(filters);
    });
  });

  describe('setExcludeKeywords', () => {
    test('should set exclusion keywords', () => {
      filters.setExcludeKeywords(['debug', 'trace']);
      expect(filters.exclude).toEqual(['debug', 'trace']);
    });

    test('should filter out empty keywords', () => {
      filters.setExcludeKeywords(['debug', '', null, 'trace']);
      expect(filters.exclude).toEqual(['debug', 'trace']);
    });

    test('should return this for chaining', () => {
      const result = filters.setExcludeKeywords(['debug']);
      expect(result).toBe(filters);
    });
  });

  describe('setCaseSensitive', () => {
    test('should set case sensitivity', () => {
      filters.setCaseSensitive(true);
      expect(filters.caseSensitive).toBe(true);
      
      filters.setCaseSensitive(false);
      expect(filters.caseSensitive).toBe(false);
    });

    test('should convert to boolean', () => {
      filters.setCaseSensitive('true');
      expect(filters.caseSensitive).toBe(true);
      
      filters.setCaseSensitive(0);
      expect(filters.caseSensitive).toBe(false);
    });

    test('should return this for chaining', () => {
      const result = filters.setCaseSensitive(true);
      expect(result).toBe(filters);
    });
  });

  describe('addIncludeKeyword', () => {
    test('should add keyword to inclusion list', () => {
      filters.addIncludeKeyword('error');
      expect(filters.include).toEqual(['error']);
    });

    test('should not add duplicate keywords', () => {
      filters.addIncludeKeyword('error');
      filters.addIncludeKeyword('error');
      expect(filters.include).toEqual(['error']);
    });

    test('should trim whitespace', () => {
      filters.addIncludeKeyword('  error  ');
      expect(filters.include).toEqual(['error']);
    });

    test('should ignore empty keywords', () => {
      filters.addIncludeKeyword('');
      filters.addIncludeKeyword('  ');
      expect(filters.include).toEqual([]);
    });

    test('should return this for chaining', () => {
      const result = filters.addIncludeKeyword('error');
      expect(result).toBe(filters);
    });
  });

  describe('addExcludeKeyword', () => {
    test('should add keyword to exclusion list', () => {
      filters.addExcludeKeyword('debug');
      expect(filters.exclude).toEqual(['debug']);
    });

    test('should not add duplicate keywords', () => {
      filters.addExcludeKeyword('debug');
      filters.addExcludeKeyword('debug');
      expect(filters.exclude).toEqual(['debug']);
    });

    test('should return this for chaining', () => {
      const result = filters.addExcludeKeyword('debug');
      expect(result).toBe(filters);
    });
  });

  describe('removeIncludeKeyword', () => {
    test('should remove keyword from inclusion list', () => {
      filters.setIncludeKeywords(['error', 'warning']);
      filters.removeIncludeKeyword('error');
      expect(filters.include).toEqual(['warning']);
    });

    test('should handle non-existent keyword', () => {
      filters.setIncludeKeywords(['error']);
      filters.removeIncludeKeyword('warning');
      expect(filters.include).toEqual(['error']);
    });

    test('should return this for chaining', () => {
      const result = filters.removeIncludeKeyword('error');
      expect(result).toBe(filters);
    });
  });

  describe('removeExcludeKeyword', () => {
    test('should remove keyword from exclusion list', () => {
      filters.setExcludeKeywords(['debug', 'trace']);
      filters.removeExcludeKeyword('debug');
      expect(filters.exclude).toEqual(['trace']);
    });

    test('should return this for chaining', () => {
      const result = filters.removeExcludeKeyword('debug');
      expect(result).toBe(filters);
    });
  });

  describe('shouldCapture', () => {
    test('should capture all messages when no filters are set', () => {
      expect(filters.shouldCapture('Any message')).toBe(true);
      expect(filters.shouldCapture('Error occurred')).toBe(true);
    });

    test('should handle empty message', () => {
      expect(filters.shouldCapture('')).toBe(true);
      
      filters.setIncludeKeywords(['error']);
      expect(filters.shouldCapture('')).toBe(false);
    });

    test('should apply inclusion filters', () => {
      filters.setIncludeKeywords(['error', 'warning']);
      
      expect(filters.shouldCapture('An error occurred')).toBe(true);
      expect(filters.shouldCapture('Warning: deprecated')).toBe(true);
      expect(filters.shouldCapture('Info message')).toBe(false);
    });

    test('should apply exclusion filters', () => {
      filters.setExcludeKeywords(['debug', 'trace']);
      
      expect(filters.shouldCapture('Debug information')).toBe(false);
      expect(filters.shouldCapture('Trace data')).toBe(false);
      expect(filters.shouldCapture('Error occurred')).toBe(true);
    });

    test('should apply inclusion then exclusion filters', () => {
      filters.setIncludeKeywords(['error'])
             .setExcludeKeywords(['debug']);
      
      expect(filters.shouldCapture('Error occurred')).toBe(true);
      expect(filters.shouldCapture('Debug error')).toBe(false);
      expect(filters.shouldCapture('Warning message')).toBe(false);
    });

    test('should respect case sensitivity', () => {
      filters.setIncludeKeywords(['Error'])
             .setCaseSensitive(true);
      
      expect(filters.shouldCapture('Error occurred')).toBe(true);
      expect(filters.shouldCapture('error occurred')).toBe(false);
      
      filters.setCaseSensitive(false);
      expect(filters.shouldCapture('error occurred')).toBe(true);
    });

    test('should handle case sensitivity with exclusion', () => {
      filters.setExcludeKeywords(['Debug'])
             .setCaseSensitive(true);
      
      expect(filters.shouldCapture('Debug info')).toBe(false);
      expect(filters.shouldCapture('debug info')).toBe(true);
      
      filters.setCaseSensitive(false);
      expect(filters.shouldCapture('debug info')).toBe(false);
    });
  });

  describe('hasActiveFilters', () => {
    test('should return false when no filters are set', () => {
      expect(filters.hasActiveFilters()).toBe(false);
    });

    test('should return true when inclusion filters are set', () => {
      filters.setIncludeKeywords(['error']);
      expect(filters.hasActiveFilters()).toBe(true);
    });

    test('should return true when exclusion filters are set', () => {
      filters.setExcludeKeywords(['debug']);
      expect(filters.hasActiveFilters()).toBe(true);
    });
  });

  describe('reset', () => {
    test('should reset all filters to defaults', () => {
      filters.setIncludeKeywords(['error'])
             .setExcludeKeywords(['debug'])
             .setCaseSensitive(true);
      
      filters.reset();
      
      expect(filters.include).toEqual([]);
      expect(filters.exclude).toEqual([]);
      expect(filters.caseSensitive).toBe(false);
    });

    test('should return this for chaining', () => {
      const result = filters.reset();
      expect(result).toBe(filters);
    });
  });

  describe('clone', () => {
    test('should create independent copy', () => {
      filters.setIncludeKeywords(['error'])
             .setExcludeKeywords(['debug'])
             .setCaseSensitive(true);
      
      const clone = filters.clone();
      
      expect(clone).not.toBe(filters);
      expect(clone.include).toEqual(filters.include);
      expect(clone.exclude).toEqual(filters.exclude);
      expect(clone.caseSensitive).toBe(filters.caseSensitive);
      
      // Verify independence
      clone.addIncludeKeyword('warning');
      expect(filters.include).toEqual(['error']);
    });
  });

  describe('toJSON and fromJSON', () => {
    test('should serialize and deserialize correctly', () => {
      filters.setIncludeKeywords(['error', 'warning'])
             .setExcludeKeywords(['debug'])
             .setCaseSensitive(true);
      
      const json = filters.toJSON();
      const restored = KeywordFilters.fromJSON(json);
      
      expect(restored.include).toEqual(filters.include);
      expect(restored.exclude).toEqual(filters.exclude);
      expect(restored.caseSensitive).toBe(filters.caseSensitive);
    });

    test('should handle null/undefined data', () => {
      const restored = KeywordFilters.fromJSON(null);
      expect(restored.include).toEqual([]);
      expect(restored.exclude).toEqual([]);
      expect(restored.caseSensitive).toBe(false);
    });

    test('should handle partial data', () => {
      const restored = KeywordFilters.fromJSON({ include: ['error'] });
      expect(restored.include).toEqual(['error']);
      expect(restored.exclude).toEqual([]);
      expect(restored.caseSensitive).toBe(false);
    });
  });
});