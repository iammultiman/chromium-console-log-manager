/**
 * Unit tests for FilterCriteria class
 */

const FilterCriteria = require('../models/FilterCriteria.js');

describe('FilterCriteria', () => {
  let filter;

  beforeEach(() => {
    filter = new FilterCriteria();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(filter.textSearch).toBe('');
      expect(filter.levels).toEqual(['log', 'error', 'warn', 'info']);
      expect(filter.dateRange).toEqual({ start: null, end: null });
      expect(filter.domains).toEqual([]);
      expect(filter.sessionIds).toEqual([]);
    });
  });

  describe('setTextSearch', () => {
    test('should set text search criteria', () => {
      filter.setTextSearch('error message');
      expect(filter.textSearch).toBe('error message');
    });

    test('should handle null/undefined input', () => {
      filter.setTextSearch(null);
      expect(filter.textSearch).toBe('');
      
      filter.setTextSearch(undefined);
      expect(filter.textSearch).toBe('');
    });

    test('should return this for chaining', () => {
      const result = filter.setTextSearch('test');
      expect(result).toBe(filter);
    });
  });

  describe('setLevels', () => {
    test('should set log levels', () => {
      filter.setLevels(['error', 'warn']);
      expect(filter.levels).toEqual(['error', 'warn']);
    });

    test('should handle non-array input', () => {
      filter.setLevels('error');
      expect(filter.levels).toEqual([]);
      
      filter.setLevels(null);
      expect(filter.levels).toEqual([]);
    });

    test('should return this for chaining', () => {
      const result = filter.setLevels(['error']);
      expect(result).toBe(filter);
    });
  });

  describe('setDateRange', () => {
    test('should set date range with Date objects', () => {
      const start = new Date('2023-01-01');
      const end = new Date('2023-12-31');
      
      filter.setDateRange(start, end);
      
      expect(filter.dateRange.start).toBe(start.getTime());
      expect(filter.dateRange.end).toBe(end.getTime());
    });

    test('should set date range with timestamps', () => {
      const start = 1672531200000; // 2023-01-01
      const end = 1704067199000;   // 2023-12-31
      
      filter.setDateRange(start, end);
      
      expect(filter.dateRange.start).toBe(start);
      expect(filter.dateRange.end).toBe(end);
    });

    test('should handle null values', () => {
      filter.setDateRange(null, null);
      expect(filter.dateRange).toEqual({ start: null, end: null });
    });

    test('should return this for chaining', () => {
      const result = filter.setDateRange(new Date(), new Date());
      expect(result).toBe(filter);
    });
  });

  describe('setDomains', () => {
    test('should set domains array', () => {
      filter.setDomains(['example.com', 'test.org']);
      expect(filter.domains).toEqual(['example.com', 'test.org']);
    });

    test('should handle non-array input', () => {
      filter.setDomains('example.com');
      expect(filter.domains).toEqual([]);
    });

    test('should return this for chaining', () => {
      const result = filter.setDomains(['example.com']);
      expect(result).toBe(filter);
    });
  });

  describe('setSessionIds', () => {
    test('should set session IDs array', () => {
      filter.setSessionIds(['session1', 'session2']);
      expect(filter.sessionIds).toEqual(['session1', 'session2']);
    });

    test('should handle non-array input', () => {
      filter.setSessionIds('session1');
      expect(filter.sessionIds).toEqual([]);
    });

    test('should return this for chaining', () => {
      const result = filter.setSessionIds(['session1']);
      expect(result).toBe(filter);
    });
  });

  describe('matches', () => {
    const mockLogEntry = {
      level: 'error',
      message: 'Test error message',
      timestamp: Date.now(),
      domain: 'example.com',
      sessionId: 'session123'
    };

    test('should match entry with default criteria', () => {
      expect(filter.matches(mockLogEntry)).toBe(true);
    });

    test('should filter by log level', () => {
      filter.setLevels(['warn', 'info']);
      expect(filter.matches(mockLogEntry)).toBe(false);
      
      filter.setLevels(['error', 'warn']);
      expect(filter.matches(mockLogEntry)).toBe(true);
    });

    test('should filter by text search', () => {
      filter.setTextSearch('error');
      expect(filter.matches(mockLogEntry)).toBe(true);
      
      filter.setTextSearch('success');
      expect(filter.matches(mockLogEntry)).toBe(false);
    });

    test('should filter by date range', () => {
      const now = Date.now();
      const entry = { ...mockLogEntry, timestamp: now };
      
      filter.setDateRange(now - 1000, now + 1000);
      expect(filter.matches(entry)).toBe(true);
      
      filter.setDateRange(now + 1000, now + 2000);
      expect(filter.matches(entry)).toBe(false);
    });

    test('should filter by domain', () => {
      filter.setDomains(['example.com']);
      expect(filter.matches(mockLogEntry)).toBe(true);
      
      filter.setDomains(['other.com']);
      expect(filter.matches(mockLogEntry)).toBe(false);
    });

    test('should filter by session ID', () => {
      filter.setSessionIds(['session123']);
      expect(filter.matches(mockLogEntry)).toBe(true);
      
      filter.setSessionIds(['other-session']);
      expect(filter.matches(mockLogEntry)).toBe(false);
    });
  });

  describe('matchesTextSearch', () => {
    test('should match case-insensitive text', () => {
      filter.setTextSearch('ERROR');
      expect(filter.matchesTextSearch('Test error message')).toBe(true);
    });

    test('should handle empty search text', () => {
      filter.setTextSearch('');
      expect(filter.matchesTextSearch('Any message')).toBe(true);
    });

    test('should handle null message', () => {
      filter.setTextSearch('test');
      expect(filter.matchesTextSearch(null)).toBe(false);
    });
  });

  describe('matchesDateRange', () => {
    test('should match timestamp within range', () => {
      const now = Date.now();
      filter.setDateRange(now - 1000, now + 1000);
      expect(filter.matchesDateRange(now)).toBe(true);
    });

    test('should reject timestamp outside range', () => {
      const now = Date.now();
      filter.setDateRange(now - 1000, now + 1000);
      expect(filter.matchesDateRange(now + 2000)).toBe(false);
      expect(filter.matchesDateRange(now - 2000)).toBe(false);
    });

    test('should handle open-ended ranges', () => {
      const now = Date.now();
      
      filter.setDateRange(now - 1000, null);
      expect(filter.matchesDateRange(now + 1000)).toBe(true);
      expect(filter.matchesDateRange(now - 2000)).toBe(false);
      
      filter.setDateRange(null, now + 1000);
      expect(filter.matchesDateRange(now - 1000)).toBe(true);
      expect(filter.matchesDateRange(now + 2000)).toBe(false);
    });
  });

  describe('reset', () => {
    test('should reset all criteria to defaults', () => {
      filter.setTextSearch('test')
            .setLevels(['error'])
            .setDomains(['example.com'])
            .setSessionIds(['session1']);
      
      filter.reset();
      
      expect(filter.textSearch).toBe('');
      expect(filter.levels).toEqual(['log', 'error', 'warn', 'info']);
      expect(filter.dateRange).toEqual({ start: null, end: null });
      expect(filter.domains).toEqual([]);
      expect(filter.sessionIds).toEqual([]);
    });

    test('should return this for chaining', () => {
      const result = filter.reset();
      expect(result).toBe(filter);
    });
  });

  describe('clone', () => {
    test('should create independent copy', () => {
      filter.setTextSearch('test')
            .setLevels(['error'])
            .setDomains(['example.com']);
      
      const clone = filter.clone();
      
      expect(clone).not.toBe(filter);
      expect(clone.textSearch).toBe(filter.textSearch);
      expect(clone.levels).toEqual(filter.levels);
      expect(clone.domains).toEqual(filter.domains);
      
      // Verify independence
      clone.setTextSearch('different');
      expect(filter.textSearch).toBe('test');
    });
  });

  describe('toJSON and fromJSON', () => {
    test('should serialize and deserialize correctly', () => {
      filter.setTextSearch('test')
            .setLevels(['error', 'warn'])
            .setDomains(['example.com'])
            .setDateRange(1000, 2000);
      
      const json = filter.toJSON();
      const restored = FilterCriteria.fromJSON(json);
      
      expect(restored.textSearch).toBe(filter.textSearch);
      expect(restored.levels).toEqual(filter.levels);
      expect(restored.domains).toEqual(filter.domains);
      expect(restored.dateRange).toEqual(filter.dateRange);
    });

    test('should handle null/undefined data', () => {
      const restored = FilterCriteria.fromJSON(null);
      expect(restored.textSearch).toBe('');
      expect(restored.levels).toEqual(['log', 'error', 'warn', 'info']);
    });
  });
});