import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Storage } from '../../src/modules/storage.js';

describe('Storage Class', () => {
  let storage;
  let mockGM;
  let mockGM_legacy;
  let mockLocalStorage;

  beforeEach(() => {
    storage = new Storage();

    // Mock GM (async)
    mockGM = {
      getValue: vi.fn(),
      setValue: vi.fn(),
      deleteValue: vi.fn()
    };

    // Mock GM_* (legacy sync)
    mockGM_legacy = {
      getValue: vi.fn(),
      setValue: vi.fn(),
      deleteValue: vi.fn()
    };

    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    global.GM = mockGM;
    global.GM_getValue = mockGM_legacy.getValue;
    global.GM_setValue = mockGM_legacy.setValue;
    global.GM_deleteValue = mockGM_legacy.deleteValue;
    global.localStorage = mockLocalStorage;
  });

  afterEach(() => {
    delete global.GM;
    delete global.GM_getValue;
    delete global.GM_setValue;
    delete global.GM_deleteValue;
    delete global.localStorage;
  });

  describe('get', () => {
    it('should retrieve value from GM.getValue (async)', async () => {
      mockGM.getValue.mockResolvedValue('test-value');

      const result = await storage.get('test-key');

      expect(result).toBe('test-value');
      expect(mockGM.getValue).toHaveBeenCalledWith('test-key');
    });

    it('should fallback to GM_getValue when GM.getValue fails', async () => {
      mockGM.getValue.mockRejectedValue(new Error('GM not available'));
      mockGM_legacy.getValue.mockReturnValue('legacy-value');

      const result = await storage.get('test-key');

      expect(result).toBe('legacy-value');
      expect(mockGM_legacy.getValue).toHaveBeenCalledWith('test-key');
    });

    it('should fallback to localStorage when GM functions fail', async () => {
      mockGM.getValue.mockRejectedValue(new Error('GM not available'));
      mockGM_legacy.getValue.mockImplementation(() => {
        throw new Error('GM_getValue not available');
      });

      const storageData = JSON.stringify({ 'test-key': 'local-value' });
      mockLocalStorage.getItem.mockReturnValue(storageData);

      const result = await storage.get('test-key');

      expect(result).toBe('local-value');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('__webdigest__');
    });

    it('should fallback to memory when all storage fails', async () => {
      mockGM.getValue.mockRejectedValue(new Error('GM not available'));
      mockGM_legacy.getValue.mockImplementation(() => {
        throw new Error('GM_getValue not available');
      });
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      // Set value in memory first
      storage.memory.set('test-key', 'memory-value');

      const result = await storage.get('test-key');

      expect(result).toBe('memory-value');
    });

    it('should return default value when key not found', async () => {
      mockGM.getValue.mockResolvedValue(null);

      const result = await storage.get('non-existent', 'default-value');

      expect(result).toBe('default-value');
    });

    it('should prefer GM.getValue over other methods', async () => {
      mockGM.getValue.mockResolvedValue('gm-value');
      mockGM_legacy.getValue.mockReturnValue('legacy-value');
      mockLocalStorage.getItem.mockReturnValue('{"test-key": "local-value"}');

      const result = await storage.get('test-key');

      expect(result).toBe('gm-value');
      expect(mockGM_legacy.getValue).not.toHaveBeenCalled();
      expect(mockLocalStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should set value using GM.setValue (async)', async () => {
      mockGM.setValue.mockResolvedValue(undefined);

      const result = await storage.set('test-key', 'test-value');

      expect(result).toBe(true);
      expect(mockGM.setValue).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should fallback to GM_setValue when GM.setValue fails', async () => {
      mockGM.setValue.mockRejectedValue(new Error('GM not available'));
      mockGM_legacy.setValue.mockReturnValue(undefined);

      const result = await storage.set('test-key', 'test-value');

      expect(result).toBe(true);
      expect(mockGM_legacy.setValue).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should fallback to localStorage when GM functions fail', async () => {
      mockGM.setValue.mockRejectedValue(new Error('GM not available'));
      mockGM_legacy.setValue.mockImplementation(() => {
        throw new Error('GM_setValue not available');
      });
      mockLocalStorage.getItem.mockReturnValue('{}');
      mockLocalStorage.setItem.mockReturnValue(undefined);

      const result = await storage.set('test-key', 'test-value');

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        '__webdigest__',
        JSON.stringify({ 'test-key': 'test-value' })
      );
    });

    it('should fallback to memory when all storage fails', async () => {
      mockGM.setValue.mockRejectedValue(new Error('GM not available'));
      mockGM_legacy.setValue.mockImplementation(() => {
        throw new Error('GM_setValue not available');
      });
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const result = await storage.set('test-key', 'test-value');

      expect(result).toBe(false); // Returns false for memory fallback
      expect(storage.memory.get('test-key')).toBe('test-value');
    });

    it('should prefer GM.setValue over other methods', async () => {
      mockGM.setValue.mockResolvedValue(undefined);
      mockGM_legacy.setValue.mockReturnValue(undefined);

      await storage.set('test-key', 'test-value');

      expect(mockGM.setValue).toHaveBeenCalled();
      expect(mockGM_legacy.setValue).not.toHaveBeenCalled();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete value using GM.deleteValue (async)', async () => {
      mockGM.deleteValue.mockResolvedValue(undefined);

      const result = await storage.delete('test-key');

      expect(result).toBe(true);
      expect(mockGM.deleteValue).toHaveBeenCalledWith('test-key');
    });

    it('should always delete from memory', async () => {
      mockGM.deleteValue.mockResolvedValue(undefined);
      storage.memory.set('test-key', 'value');

      await storage.delete('test-key');

      expect(storage.memory.has('test-key')).toBe(false);
    });
  });

  describe('namespace', () => {
    it('should use correct namespace for localStorage', async () => {
      mockGM.setValue.mockRejectedValue(new Error('GM not available'));
      mockGM_legacy.setValue.mockImplementation(() => {
        throw new Error('GM_setValue not available');
      });

      mockLocalStorage.getItem.mockReturnValue('{}');

      await storage.set('test-key', 'test-value');

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('__webdigest__');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        '__webdigest__',
        expect.any(String)
      );
    });
  });
});
