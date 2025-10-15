const logger = require('./index').createModuleLogger('DataManager');

class DataManager {
    constructor() {
        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0
        };
        
        this.maxCacheSize = parseInt(process.env.CACHE_MAX_SIZE) || 1000;
        this.cacheTTL = parseInt(process.env.CACHE_TTL) || 300000; // 5 minutes default
        
        setInterval(() => this.cleanupCache(), 60000);
    }
    
    set(key, value, ttl = this.cacheTTL) {
        const entry = {
            value,
            expires: Date.now() + ttl,
            hits: 0
        };
        
        this.cache.set(key, entry);
        
        if (this.cache.size > this.maxCacheSize) {
            const oldestKey = this.findOldestKey();
            this.cache.delete(oldestKey);
            logger.debug('Cache eviction', { key: oldestKey });
        }
        
        logger.trace('Cache set', { key, ttl });
    }
    
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.cacheStats.misses++;
            logger.trace('Cache miss', { key });
            return null;
        }
        
        if (entry.expires < Date.now()) {
            this.cache.delete(key);
            this.cacheStats.misses++;
            logger.trace('Cache expired', { key });
            return null;
        }
        
        entry.hits++;
        this.cacheStats.hits++;
        logger.trace('Cache hit', { key, hits: entry.hits });
        return entry.value;
    }
    
    delete(key) {
        const deleted = this.cache.delete(key);
        logger.trace('Cache delete', { key, deleted });
        return deleted;
    }
    
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) return false;
        
        if (entry.expires < Date.now()) {
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }
    
    cleanupCache() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expires < now) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logger.debug('Cache cleanup', { cleaned, remaining: this.cache.size });
        }
    }
    
    findOldestKey() {
        let oldestKey = null;
        let oldestTime = Infinity;
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expires < oldestTime) {
                oldestTime = entry.expires;
                oldestKey = key;
            }
        }
        
        return oldestKey;
    }
    
    getStats() {
        const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
            ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(2)
            : 0;
        
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            hits: this.cacheStats.hits,
            misses: this.cacheStats.misses,
            hitRate: `${hitRate}%`
        };
    }
    
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.cacheStats = { hits: 0, misses: 0 };
        logger.info('Cache cleared', { previousSize: size });
    }
    
    getUserData(userId) {
        return this.get(`user:${userId}`);
    }
    
    setUserData(userId, data, ttl) {
        this.set(`user:${userId}`, data, ttl);
    }
    
    getChannelData(channelId) {
        return this.get(`channel:${channelId}`);
    }
    
    setChannelData(channelId, data, ttl) {
        this.set(`channel:${channelId}`, data, ttl);
    }
    
    getGuildData(guildId) {
        return this.get(`guild:${guildId}`);
    }
    
    setGuildData(guildId, data, ttl) {
        this.set(`guild:${guildId}`, data, ttl);
    }
}

module.exports = new DataManager();
