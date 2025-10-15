const chalk = require('chalk');

class RasavedicDebugger {
    constructor() {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };
        
        this.currentLevel = this.levels[process.env.DEBUG_LEVEL] || this.levels.INFO;
        this.enabledModules = this.parseModules(process.env.DEBUG_MODULES || '*');
        this.disabledModules = this.parseModules(process.env.DEBUG_DISABLE || '');
        
        this.colors = {
            ERROR: chalk.red.bold,
            WARN: chalk.yellow,
            INFO: chalk.blue,
            DEBUG: chalk.green,
            TRACE: chalk.gray,
            MODULE: chalk.cyan,
            TIME: chalk.magenta
        };
        
        this.startTime = Date.now();
        this.metrics = {
            errors: 0,
            warnings: 0,
            performance: new Map()
        };
    }
    
    parseModules(moduleString) {
        if (!moduleString) return [];
        return moduleString.split(',').map(m => m.trim());
    }
    
    shouldLog(level, module) {
        if (this.levels[level] > this.currentLevel) return false;
        
        if (this.disabledModules.includes(module)) return false;
        if (this.disabledModules.includes('*')) return false;
        
        if (this.enabledModules.includes('*')) return true;
        if (this.enabledModules.includes(module)) return true;
        
        return this.enabledModules.length === 0;
    }
    
    formatIndianTime() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + istOffset);
        
        const hours = String(istTime.getUTCHours()).padStart(2, '0');
        const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
        const day = String(istTime.getUTCDate()).padStart(2, '0');
        const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
        
        return `${day}/${month} ${hours}:${minutes}:${seconds}`;
    }
    
    formatMessage(level, module, message, data) {
        const timestamp = this.formatIndianTime();
        const uptime = ((Date.now() - this.startTime) / 1000).toFixed(1);
        
        let formatted = `${this.colors.TIME(`[${timestamp}]`)} `;
        formatted += `${this.colors.TIME(`+${uptime}s`)} `;
        formatted += `${this.colors[level](`[${level}]`)} `;
        formatted += `${this.colors.MODULE(`[${module}]`)} `;
        formatted += `${message}`;
        
        if (data && Object.keys(data).length > 0) {
            formatted += `\n${JSON.stringify(data, null, 2)}`;
        }
        
        return formatted;
    }
    
    error(module, message, error = null) {
        if (!this.shouldLog('ERROR', module)) return;
        
        this.metrics.errors++;
        const data = error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code
        } : {};
        
        console.error(this.formatMessage('ERROR', module, message, data));
        
        if (process.env.DEBUG_ERROR_STACK === 'true' && error?.stack) {
            console.error(chalk.red(error.stack));
        }
    }
    
    warn(module, message, data = {}) {
        if (!this.shouldLog('WARN', module)) return;
        this.metrics.warnings++;
        console.warn(this.formatMessage('WARN', module, message, data));
    }
    
    info(module, message, data = {}) {
        if (!this.shouldLog('INFO', module)) return;
        console.log(this.formatMessage('INFO', module, message, data));
    }
    
    debug(module, message, data = {}) {
        if (!this.shouldLog('DEBUG', module)) return;
        console.log(this.formatMessage('DEBUG', module, message, data));
    }
    
    trace(module, message, data = {}) {
        if (!this.shouldLog('TRACE', module)) return;
        console.log(this.formatMessage('TRACE', module, message, data));
    }
    
    performance(module, label) {
        const key = `${module}:${label}`;
        
        return {
            start: () => {
                this.metrics.performance.set(key, Date.now());
                this.trace(module, `⏱️ Started: ${label}`);
            },
            end: () => {
                const startTime = this.metrics.performance.get(key);
                if (!startTime) return;
                
                const duration = Date.now() - startTime;
                this.metrics.performance.delete(key);
                
                const color = duration > 1000 ? chalk.red : duration > 500 ? chalk.yellow : chalk.green;
                this.info(module, `⏱️ Completed: ${label}`, { 
                    duration: `${color(`${duration}ms`)}` 
                });
                
                return duration;
            }
        };
    }
    
    async wrapAsync(module, label, fn) {
        const perf = this.performance(module, label);
        perf.start();
        
        try {
            const result = await fn();
            perf.end();
            return result;
        } catch (error) {
            perf.end();
            this.error(module, `Failed: ${label}`, error);
            throw error;
        }
    }
    
    getStats() {
        return {
            uptime: ((Date.now() - this.startTime) / 1000).toFixed(2) + 's',
            errors: this.metrics.errors,
            warnings: this.metrics.warnings,
            activePerformanceTrackers: this.metrics.performance.size
        };
    }
    
    createModuleLogger(moduleName) {
        return {
            error: (msg, err) => this.error(moduleName, msg, err),
            warn: (msg, data) => this.warn(moduleName, msg, data),
            info: (msg, data) => this.info(moduleName, msg, data),
            debug: (msg, data) => this.debug(moduleName, msg, data),
            trace: (msg, data) => this.trace(moduleName, msg, data),
            perf: (label) => this.performance(moduleName, label),
            wrapAsync: (label, fn) => this.wrapAsync(moduleName, label, fn),
            stats: () => this.getStats()
        };
    }
}

const rasavedicDebugger = new RasavedicDebugger();

module.exports = rasavedicDebugger;
module.exports.RasavedicDebugger = RasavedicDebugger;
