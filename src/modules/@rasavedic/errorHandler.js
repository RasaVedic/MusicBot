const logger = require('./index').createModuleLogger('ErrorHandler');
const { MessageFlags } = require('discord.js');

class ErrorHandler {
    constructor() {
        this.errors = new Map();
        this.setupGlobalHandlers();
    }
    
    setupGlobalHandlers() {
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', error);
            
            if (process.env.EXIT_ON_UNCAUGHT === 'true') {
                console.error('Exiting due to uncaught exception...');
                process.exit(1);
            }
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Promise Rejection', reason);
            
            if (process.env.EXIT_ON_UNHANDLED === 'true') {
                console.error('Exiting due to unhandled rejection...');
                process.exit(1);
            }
        });
        
        process.on('warning', (warning) => {
            logger.warn('Process Warning', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack
            });
        });
    }
    
    async handle(error, context = {}) {
        const errorId = this.generateErrorId();
        
        const errorData = {
            id: errorId,
            timestamp: new Date().toISOString(),
            message: error.message,
            name: error.name,
            code: error.code,
            stack: error.stack,
            context
        };
        
        this.errors.set(errorId, errorData);
        
        logger.error('Handled Error', error);
        
        if (this.errors.size > 100) {
            const oldestKey = this.errors.keys().next().value;
            this.errors.delete(oldestKey);
        }
        
        return errorId;
    }
    
    generateErrorId() {
        return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getError(errorId) {
        return this.errors.get(errorId);
    }
    
    getRecentErrors(count = 10) {
        return Array.from(this.errors.values()).slice(-count);
    }
    
    createSafeWrapper(fn, context = {}) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                const errorId = await this.handle(error, context);
                logger.error(`Error ID: ${errorId}`, error);
                throw error;
            }
        };
    }
    
    createDiscordErrorHandler(interaction) {
        return async (error) => {
            const errorId = await this.handle(error, {
                type: 'discord',
                guildId: interaction.guildId,
                userId: interaction.user?.id,
                channelId: interaction.channelId
            });
            
            const errorMessage = process.env.DEBUG_SHOW_ERROR_DETAILS === 'true'
                ? `Error: ${error.message}\nID: ${errorId}`
                : `An error occurred. Error ID: ${errorId}`;
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: `❌ ${errorMessage}`,
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.reply({
                        content: `❌ ${errorMessage}`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (replyError) {
                logger.error('Failed to send error message to Discord', replyError);
            }
        };
    }
}

module.exports = new ErrorHandler();
