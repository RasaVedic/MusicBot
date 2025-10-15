const logger = require('../modules/@rasavedic').createModuleLogger('LocalStorage');

class LocalStorageManager {
  constructor() {
    this.storage = new Map();
    this.lastCleanup = 0; // Initialize to 0 to ensure cleanup runs on first init()
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.dataLifetime = 24 * 60 * 60 * 1000; // 24 hours
  }

  init() {
    logger.info('LocalStorageManager initialized');
    
    // Cleanup on startup
    this.cleanup();
    
    // Schedule daily cleanup
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
    
    return true;
  }

  // Set data with timestamp
  set(key, value) {
    this.storage.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  // Get data
  get(key) {
    const item = this.storage.get(key);
    if (!item) return null;
    
    // Check if data is expired
    if (Date.now() - item.timestamp > this.dataLifetime) {
      this.storage.delete(key);
      return null;
    }
    
    return item.data;
  }

  // Delete data
  delete(key) {
    return this.storage.delete(key);
  }

  // Check if key exists
  has(key) {
    return this.storage.has(key) && this.get(key) !== null;
  }

  // Clear all data
  clear() {
    this.storage.clear();
    logger.info('All local storage cleared');
  }

  // Cleanup old data (runs once per day)
  cleanup() {
    const now = Date.now();
    let deletedCount = 0;
    
    // Check if cleanup already ran today
    if (now - this.lastCleanup < this.cleanupInterval) {
      logger.debug('Cleanup already ran today, skipping');
      return;
    }
    
    logger.info('Running local storage cleanup...');
    
    for (const [key, item] of this.storage.entries()) {
      if (now - item.timestamp > this.dataLifetime) {
        this.storage.delete(key);
        deletedCount++;
      }
    }
    
    this.lastCleanup = now;
    logger.info(`Cleanup completed. Removed ${deletedCount} expired items. Current storage size: ${this.storage.size}`);
  }

  // Get storage stats
  getStats() {
    return {
      size: this.storage.size,
      lastCleanup: new Date(this.lastCleanup).toISOString(),
      nextCleanup: new Date(this.lastCleanup + this.cleanupInterval).toISOString()
    };
  }
}

module.exports = new LocalStorageManager();
