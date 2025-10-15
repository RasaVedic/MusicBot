const config = require('../config/config.json');

class ValidationUtils {
    /**
     * Validate purge amount
     * @param {number} amount - Amount to purge
     * @returns {Object} - { valid: boolean, error: string }
     */
    static validatePurgeAmount(amount) {
        if (!amount || isNaN(amount)) {
            return {
                valid: false,
                error: 'Please provide a valid number of messages to delete.'
            };
        }

        if (amount < config.validation.purgeMinAmount || amount > config.validation.purgeMaxAmount) {
            return {
                valid: false,
                error: `Please provide a number between ${config.validation.purgeMinAmount} and ${config.validation.purgeMaxAmount}.`
            };
        }

        return { valid: true };
    }

    /**
     * Validate mute duration
     * @param {number} amount - Time amount
     * @param {string} unit - Time unit (m, h, d)
     * @returns {Object} - { valid: boolean, error: string, milliseconds: number, displayTime: string }
     */
    static validateMuteDuration(amount, unit) {
        let milliseconds;
        let displayTime;
        const validation = config.validation;

        switch (unit) {
            case 'm':
                if (amount < validation.minMuteMinutes) {
                    return {
                        valid: false,
                        error: `Minimum timeout is ${validation.minMuteMinutes} minute(s).`
                    };
                }
                if (amount > validation.maxMuteMinutes) {
                    return {
                        valid: false,
                        error: `Maximum timeout is ${validation.maxMuteDays} days (${validation.maxMuteMinutes} minutes).`
                    };
                }
                milliseconds = amount * 60 * 1000;
                displayTime = `${amount} minute${amount !== 1 ? 's' : ''}`;
                break;

            case 'h':
                if (amount > validation.maxMuteHours) {
                    return {
                        valid: false,
                        error: `Maximum timeout is ${validation.maxMuteDays} days (${validation.maxMuteHours} hours).`
                    };
                }
                milliseconds = amount * 60 * 60 * 1000;
                displayTime = `${amount} hour${amount !== 1 ? 's' : ''}`;
                break;

            case 'd':
                if (amount > validation.maxMuteDays) {
                    return {
                        valid: false,
                        error: `Maximum timeout is ${validation.maxMuteDays} days.`
                    };
                }
                milliseconds = amount * 24 * 60 * 60 * 1000;
                displayTime = `${amount} day${amount !== 1 ? 's' : ''}`;
                break;

            default:
                return {
                    valid: false,
                    error: 'Invalid time unit. Use: m (minutes), h (hours), or d (days)'
                };
        }

        return { valid: true, milliseconds, displayTime };
    }

    /**
     * Validate queue position
     * @param {number} position - Queue position
     * @param {number} queueLength - Current queue length
     * @returns {Object} - { valid: boolean, error: string }
     */
    static validateQueuePosition(position, queueLength) {
        if (!position || isNaN(position)) {
            return {
                valid: false,
                error: 'Please provide a valid queue position number.'
            };
        }

        if (position < 1) {
            return {
                valid: false,
                error: 'Queue position must be greater than 0.'
            };
        }

        if (position > queueLength) {
            return {
                valid: false,
                error: `Invalid position. Queue has ${queueLength} track${queueLength !== 1 ? 's' : ''}.`
            };
        }

        return { valid: true };
    }

    /**
     * Validate volume level
     * @param {number} volume - Volume level
     * @returns {Object} - { valid: boolean, error: string }
     */
    static validateVolume(volume) {
        if (!volume || isNaN(volume)) {
            return {
                valid: false,
                error: 'Please provide a valid volume number (0-100).'
            };
        }

        if (volume < 0 || volume > 100) {
            return {
                valid: false,
                error: 'Volume must be between 0 and 100.'
            };
        }

        return { valid: true };
    }

    /**
     * Validate user mention or ID
     * @param {string} input - User mention or ID
     * @param {Object} guild - Guild object
     * @returns {Object} - { valid: boolean, error: string, member: GuildMember }
     */
    static async validateUser(input, guild, mentions) {
        const target = mentions?.members?.first() || guild.members.cache.get(input);
        
        if (!target) {
            return {
                valid: false,
                error: 'Please mention a valid user or provide a valid user ID.'
            };
        }

        return { valid: true, member: target };
    }

    /**
     * Validate message age for bulk delete
     * @param {number} timestamp - Message timestamp
     * @returns {boolean} - Whether the message is deletable
     */
    static isMessageDeletable(timestamp) {
        const age = Date.now() - timestamp;
        return age < config.validation.messageMaxAge;
    }

    /**
     * Parse time string (e.g., "10m", "2h", "1d")
     * @param {string} timeString - Time string to parse
     * @returns {Object} - { valid: boolean, amount: number, unit: string, error: string }
     */
    static parseTimeString(timeString) {
        const timeRegex = /^(\d+)(m|h|d)$/;
        const match = timeString?.match(timeRegex);

        if (!match) {
            return {
                valid: false,
                error: 'Invalid time format. Use: `<number><m|h|d>` (Example: `10m`, `2h`, `1d`)'
            };
        }

        return {
            valid: true,
            amount: parseInt(match[1]),
            unit: match[2]
        };
    }
}

module.exports = ValidationUtils;
