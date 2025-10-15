const config = require('../config/config.json');

class CooldownHandler {
    constructor() {
        this.cooldowns = new Map();
    }

    /**
     * Check if a user is on cooldown for a command
     * @param {string} userId - The user's ID
     * @param {string} commandName - The command name
     * @param {string} category - Command category (music, admin, utility)
     * @returns {Object} - { onCooldown: boolean, timeLeft: number }
     */
    checkCooldown(userId, commandName, category = 'utility') {
        if (!config.commandCooldown.enabled) {
            return { onCooldown: false, timeLeft: 0 };
        }

        const key = `${userId}-${commandName}`;
        const now = Date.now();
        
        if (this.cooldowns.has(key)) {
            const expiresAt = this.cooldowns.get(key);
            
            if (now < expiresAt) {
                const timeLeft = Math.ceil((expiresAt - now) / 1000);
                return { onCooldown: true, timeLeft };
            }
            
            this.cooldowns.delete(key);
        }
        
        return { onCooldown: false, timeLeft: 0 };
    }

    /**
     * Set cooldown for a user and command
     * @param {string} userId - The user's ID
     * @param {string} commandName - The command name
     * @param {string} category - Command category (music, admin, utility)
     */
    setCooldown(userId, commandName, category = 'utility') {
        if (!config.commandCooldown.enabled) {
            return;
        }

        const key = `${userId}-${commandName}`;
        const cooldownTime = this.getCooldownTime(category);
        const expiresAt = Date.now() + cooldownTime;
        
        this.cooldowns.set(key, expiresAt);
        
        setTimeout(() => {
            this.cooldowns.delete(key);
        }, cooldownTime);
    }

    /**
     * Get cooldown time based on command category
     * @param {string} category - Command category
     * @returns {number} - Cooldown time in milliseconds
     */
    getCooldownTime(category) {
        switch (category) {
            case 'music':
                return config.commandCooldown.musicCommandCooldown || 2000;
            case 'admin':
                return config.commandCooldown.adminCommandCooldown || 5000;
            default:
                return config.commandCooldown.defaultCooldown || 3000;
        }
    }

    /**
     * Clear cooldown for a user and command
     * @param {string} userId - The user's ID
     * @param {string} commandName - The command name
     */
    clearCooldown(userId, commandName) {
        const key = `${userId}-${commandName}`;
        this.cooldowns.delete(key);
    }

    /**
     * Clear all cooldowns (useful for bot restart)
     */
    clearAll() {
        this.cooldowns.clear();
    }

    /**
     * Get active cooldowns count
     * @returns {number} - Number of active cooldowns
     */
    getActiveCooldownCount() {
        return this.cooldowns.size;
    }
}

module.exports = new CooldownHandler();
