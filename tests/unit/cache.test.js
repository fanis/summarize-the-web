import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DigestCache } from '../../src/modules/cache.js';
import { STORAGE_KEYS } from '../../src/modules/config.js';
import { hashText } from '../../src/modules/utils.js';
import { createMockStorage } from '../setup.js';

describe('DigestCache', () => {
  let cache;
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    cache = new DigestCache(mockStorage);
  });

  describe('initialization', () => {
    it('should load cache from storage', async () => {
      const key = `summary_large:9:${hashText('test text')}`;
      const storedData = JSON.stringify({
        [key]: { result: 'cached summary', timestamp: Date.now() }
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

    it('should only load from storage once (lazy, idempotent)', async () => {
      mockStorage.get.mockResolvedValue('{}');

      await cache.init();
      await cache.init();
      await cache.get('some text', 'summary_large');

      expect(mockStorage.get).toHaveBeenCalledTimes(1);
    });

    it('should delete the legacy full-text cache blob', async () => {
      mockStorage.get.mockResolvedValue('{}');

      await cache.init();

      expect(mockStorage.delete).toHaveBeenCalledWith('digest_cache_v1');
    });

    it('should load lazily on first get without explicit init', async () => {
      const key = `summary_large:9:${hashText('test text')}`;
      mockStorage.get.mockResolvedValue(JSON.stringify({
        [key]: { result: 'cached summary', timestamp: 1000 }
      }));

      const result = await cache.get('test text', 'summary_large');

      expect(result.result).toBe('cached summary');
    });
  });

  describe('key generation', () => {
    it('should generate key with mode prefix, length and content hash', () => {
      const key = cache.key('test text', 'summary_large');

      expect(key).toBe(`summary_large:9:${hashText('test text')}`);
    });

    it('should not embed the full text in the key', () => {
      const longText = 'A very long article text. '.repeat(1000);
      const key = cache.key(longText, 'summary_large');

      expect(key.length).toBeLessThan(60);
      expect(key).not.toContain('article');
    });

    it('should generate different keys for different modes', () => {
      const keyLarge = cache.key('test text', 'summary_large');
      const keySmall = cache.key('test text', 'summary_small');

      expect(keyLarge).not.toBe(keySmall);
    });

    it('should generate different keys for different texts', () => {
      const keyA = cache.key('text one!', 'summary_large');
      const keyB = cache.key('text two!', 'summary_large');

      expect(keyA).not.toBe(keyB);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue('{}');
      await cache.init();
    });

    it('should return cached value if exists', async () => {
      cache.cache[cache.key('test text', 'summary_large')] = {
        result: 'cached summary',
        timestamp: Date.now()
      };

      const result = await cache.get('test text', 'summary_large');

      expect(result.result).toBe('cached summary');
    });

    it('should return undefined if not cached', async () => {
      const result = await cache.get('not cached', 'summary_large');

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

      const entry = cache.cache[cache.key('test text', 'summary_large')];
      expect(entry).toBeDefined();
      expect(entry.result).toBe('summary result');
      expect(entry.timestamp).toBeDefined();
    });

    it('should persist to storage after set', async () => {
      await cache.set('test text', 'summary_large', 'summary result');

      // After set completes, storage should have been called
      expect(mockStorage.set).toHaveBeenCalled();
    });

    it('should round-trip through get', async () => {
      await cache.set('test text', 'summary_large', 'summary result');

      const result = await cache.get('test text', 'summary_large');

      expect(result.result).toBe('summary result');
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

      expect(mockStorage.delete).toHaveBeenCalledWith(STORAGE_KEYS.CACHE);
    });
  });

  describe('size', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue('{}');
      await cache.init();
    });

    it('should return number of cached items', async () => {
      cache.cache['key1'] = { result: 'v1', timestamp: 1000 };
      cache.cache['key2'] = { result: 'v2', timestamp: 2000 };

      expect(cache.size).toBe(2);
      expect(await cache.getSize()).toBe(2);
    });

    it('should return 0 for empty cache', async () => {
      expect(cache.size).toBe(0);
      expect(await cache.getSize()).toBe(0);
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
