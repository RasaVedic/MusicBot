# @rasavedic Debug Module

Advanced debugging, error handling, and performance monitoring module for Discord bots.

## Features

- 🎨 **Colored Console Output** - Beautiful, easy-to-read logs
- 📊 **Multiple Debug Levels** - ERROR, WARN, INFO, DEBUG, TRACE
- 🔍 **Module-based Filtering** - Enable/disable specific modules
- ⚡ **Performance Tracking** - Monitor execution time
- 💾 **Smart Caching** - Fast data access with automatic cleanup
- 🛡️ **Error Handling** - Global error handlers with context

## Environment Variables

### Debug Levels
```env
DEBUG_LEVEL=INFO              # ERROR, WARN, INFO, DEBUG, TRACE
DEBUG_MODULES=*               # Comma-separated: MusicPlayer,Commands or * for all
DEBUG_DISABLE=                # Comma-separated modules to disable
DEBUG_ERROR_STACK=true        # Show full error stack traces
DEBUG_SHOW_ERROR_DETAILS=true # Show error details to users
```

### Error Handling
```env
EXIT_ON_UNCAUGHT=false        # Exit process on uncaught exceptions
EXIT_ON_UNHANDLED=false       # Exit process on unhandled rejections
```

### Caching
```env
CACHE_MAX_SIZE=1000           # Maximum cache entries
CACHE_TTL=300000              # Cache TTL in milliseconds (5 minutes)
```

## Usage

### Basic Logging
```javascript
const logger = require('@rasavedic').createModuleLogger('MyModule');

logger.error('Something went wrong', error);
logger.warn('This is a warning', { data: 'value' });
logger.info('Information message');
logger.debug('Debug details', { debug: 'data' });
logger.trace('Trace level logging');
```

### Performance Tracking
```javascript
const perf = logger.perf('Database Query');
perf.start();
// ... your code
perf.end(); // Logs duration
```

### Async Wrapper
```javascript
const result = await logger.wrapAsync('Fetch User', async () => {
    return await fetchUserFromAPI();
});
```

### Error Handling
```javascript
const errorHandler = require('@rasavedic/errorHandler');

// Handle errors
const errorId = await errorHandler.handle(error, { 
    userId: '123', 
    action: 'play_music' 
});

// Create safe wrapper
const safeFunction = errorHandler.createSafeWrapper(
    async () => { /* your code */ },
    { module: 'MusicPlayer' }
);
```

### Data Manager (Caching)
```javascript
const dataManager = require('@rasavedic/dataManager');

// Cache user data
dataManager.setUserData('123', { name: 'John' });
const user = dataManager.getUserData('123');

// Cache with custom TTL
dataManager.set('custom:key', data, 60000); // 1 minute

// Get stats
console.log(dataManager.getStats());
```

## Debug Examples

### Enable Only Errors
```env
DEBUG_LEVEL=ERROR
```

### Enable All Music Player Logs
```env
DEBUG_LEVEL=DEBUG
DEBUG_MODULES=MusicPlayer,DirectStreamPlayer
```

### Disable Specific Modules
```env
DEBUG_LEVEL=DEBUG
DEBUG_MODULES=*
DEBUG_DISABLE=Firebase,MessageHandler
```

## Stats

Get debug statistics:
```javascript
const logger = require('@rasavedic').createModuleLogger('Test');
console.log(logger.stats());
// { uptime: '120.45s', errors: 5, warnings: 12, activePerformanceTrackers: 2 }

const dataManager = require('@rasavedic/dataManager');
console.log(dataManager.getStats());
// { size: 45, maxSize: 1000, hits: 234, misses: 12, hitRate: '95.12%' }
```
