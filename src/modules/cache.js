/**
 * Cache management for Summarize The Web
 */

import { STORAGE_KEYS, CACHE_LIMIT, CACHE_TRIM_TO } from './config.js';
import { log } from './utils.js';

export class DigestCache {
    constructor(storage) {
        this.storage = storage;
        this.cache = {};
        this.dirty = false;
    }

    /**
     * Initialize cache from storage
     */
    async init() {
        try {
            const stored = await this.storage.get(STORAGE_KEYS.CACHE, '{}');
            this.cache = JSON.parse(stored);
        } catch {
            this.cache = {};
        }

        // Start periodic save
        setInterval(() => this.save(), 5000);
    }

    /**
     * Generate cache key
     */
    key(text, mode) {
        return `${mode}:${text}`;
    }

    /**
     * Get cached result
     */
    get(text, mode) {
        const key = this.key(text, mode);
        return this.cache[key];
    }

    /**
     * Set cached result
     */
    async set(text, mode, result) {
        const key = this.key(text, mode);
        this.cache[key] = { result, timestamp: Date.now() };
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
     * Get cache size
     */
    get size() {
        return Object.keys(this.cache).length;
    }
}
