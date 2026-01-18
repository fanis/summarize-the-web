import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DigestCache } from '../../src/modules/cache.js';
import { createMockStorage } from '../setup.js';

describe('DigestCache', () => {
  let cache;
  let mockStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = createMockStorage();
    cache = new DigestCache(mockStorage);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should load cache from storage', async () => {
      const storedData = JSON.stringify({
        'summary_large:test text': { result: 'cached summary', timestamp: Date.now() }
      });
      mockStorage.get.mockResolvedValue(storedData);

      await cache.init();

      expect(mockStorage.get).toHaveBeenCalled();
      expect(cache.size).toBe(1);
    });

    it('should handle invalid JSON gracefully', async () => {
      mockStorage.get.mockResolvedValue('invalid json');

      await cache.init();

      expect(cache.size).toBe(0);
    });

    it('should handle empty storage', async () => {
      mockStorage.get.mockResolvedValue('{}');

      await cache.init();

      expect(cache.size).toBe(0);
    });
  });

  describe('key generation', () => {
    it('should generate key with mode prefix', () => {
      const key = cache.key('test text', 'summary_large');

      expect(key).toBe('summary_large:test text');
    });

    it('should generate different keys for different modes', () => {
      const keyLarge = cache.key('test text', 'summary_large');
      const keySmall = cache.key('test text', 'summary_small');

      expect(keyLarge).not.toBe(keySmall);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue('{}');
      await cache.init();
    });

    it('should return cached value if exists', () => {
      cache.cache['summary_large:test text'] = {
        result: 'cached summary',
        timestamp: Date.now()
      };

      const result = cache.get('test text', 'summary_large');

      expect(result.result).toBe('cached summary');
    });

    it('should return undefined if not cached', () => {
      const result = cache.get('not cached', 'summary_large');

      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue('{}');
      await cache.init();
    });

    it('should store value with timestamp', async () => {
      await cache.set('test text', 'summary_large', 'summary result');

      const entry = cache.cache['summary_large:test text'];
      expect(entry).toBeDefined();
      expect(entry.result).toBe('summary result');
      expect(entry.timestamp).toBeDefined();
    });

    it('should persist to storage after set', async () => {
      await cache.set('test text', 'summary_large', 'summary result');

      // After set completes, storage should have been called
      expect(mockStorage.set).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue('{}');
      await cache.init();
    });

    it('should empty cache', async () => {
      cache.cache['key1'] = { result: 'v1', timestamp: 1000 };
      cache.cache['key2'] = { result: 'v2', timestamp: 2000 };

      await cache.clear();

      expect(cache.size).toBe(0);
    });

    it('should call storage delete', async () => {
      await cache.clear();

      expect(mockStorage.delete).toHaveBeenCalled();
    });
  });

  describe('size', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue('{}');
      await cache.init();
    });

    it('should return number of cached items', () => {
      cache.cache['key1'] = { result: 'v1', timestamp: 1000 };
      cache.cache['key2'] = { result: 'v2', timestamp: 2000 };

      expect(cache.size).toBe(2);
    });

    it('should return 0 for empty cache', () => {
      expect(cache.size).toBe(0);
    });
  });

  describe('save', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue('{}');
      await cache.init();
    });

    it('should not save if not dirty', async () => {
      await cache.save();

      expect(mockStorage.set).not.toHaveBeenCalled();
    });

    it('should save if dirty', async () => {
      cache.dirty = true;
      cache.cache['key1'] = { result: 'v1', timestamp: 1000 };

      await cache.save();

      expect(mockStorage.set).toHaveBeenCalled();
    });

    it('should reset dirty flag after save', async () => {
      cache.dirty = true;

      await cache.save();

      expect(cache.dirty).toBe(false);
    });
  });
});
