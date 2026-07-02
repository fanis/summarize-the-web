/**
 * Cache management for Summarize The Web
 *
 * Summaries are keyed by mode + a hash of the article text, so the stored
 * blob stays small. Loading is lazy: pages that never summarize don't pay
 * the JSON.parse cost, and writes happen immediately on set() (no polling).
 */

import { STORAGE_KEYS, CACHE_LIMIT, CACHE_TRIM_TO } from './config.js';
import { hashText, log } from './utils.js';

// Storage key of the pre-hash cache format (entries keyed by the full
// article text). Deleted on first load; superseded by STORAGE_KEYS.CACHE.
const LEGACY_CACHE_KEY = 'digest_cache_v1';

export class DigestCache {
    constructor(storage) {
        this.storage = storage;
        this.cache = {};
        this.dirty = false;
        this.loaded = null;
    }

    /**
     * Load cache from storage. Idempotent and lazy: get/set/getSize call it
     * automatically, so callers don't need to initialize eagerly.
     */
    init() {
        if (!this.loaded) {
            this.loaded = (async () => {
                try {
                    const stored = await this.storage.get(STORAGE_KEYS.CACHE, '{}');
                    this.cache = JSON.parse(stored);
                } catch {
                    this.cache = {};
                }
                // Best-effort cleanup of the legacy full-text cache blob.
                try { await this.storage.delete(LEGACY_CACHE_KEY); } catch {}
            })();
        }
        return this.loaded;
    }

    /**
     * Generate cache key (mode + text length + content hash)
     */
    key(text, mode) {
        return `${mode}:${text.length}:${hashText(text)}`;
    }

    /**
     * Get cached result
     */
    async get(text, mode) {
        await this.init();
        return this.cache[this.key(text, mode)];
    }

    /**
     * Set cached result (persists immediately)
     */
    async set(text, mode, result) {
        await this.init();
        this.cache[this.key(text, mode)] = { result, timestamp: Date.now() };
        this.dirty = true;

        // Trim cache if needed
        const keys = Object.keys(this.cache);
        if (keys.length > CACHE_LIMIT) {
            const sorted = keys
                .map(k => ({ key: k, time: this.cache[k].timestamp || 0 }))
                .sort((a, b) => b.time - a.time);
            const keep = sorted.slice(0, CACHE_TRIM_TO).map(x => x.key);
            const newCache = {};
            keep.forEach(k => { newCache[k] = this.cache[k]; });
            this.cache = newCache;
        }

        await this.save();
    }

    /**
     * Clear entire cache
     */
    async clear() {
        this.cache = {};
        this.dirty = false;
        this.loaded = Promise.resolve();
        await this.storage.delete(STORAGE_KEYS.CACHE);
        log('cache cleared');
    }

    /**
     * Save cache to storage
     */
    async save() {
        if (!this.dirty) return;
        this.dirty = false;
        await this.storage.set(STORAGE_KEYS.CACHE, JSON.stringify(this.cache));
    }

    /**
     * Get cache size (loads the cache if needed)
     */
    async getSize() {
        await this.init();
        return Object.keys(this.cache).length;
    }

    /**
     * Get cache size of the already-loaded cache (sync)
     */
    get size() {
        return Object.keys(this.cache).length;
    }
}
