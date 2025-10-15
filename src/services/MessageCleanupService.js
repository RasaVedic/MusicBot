const firebaseState = require('./FirebaseStateManager');
const logger = require('../modules/@rasavedic').createModuleLogger('MessageCleanup');

class MessageCleanupService {
    constructor() {
        this.cleanupInterval = null;
    }

    async cleanupGuildMessages(client, guildId) {
        try {
            logger.debug(`Starting message cleanup for guild ${guildId}`);
            
            const messages = await firebaseState.getAllMessagesForGuild(guildId);
            
            if (messages.length === 0) {
                logger.debug(`No messages to clean up for guild ${guildId}`);
                return;
            }
            
            logger.debug(`Found ${messages.length} messages to check for guild ${guildId}`);
            
            for (const msgData of messages) {
                try {
                    const guild = client.guilds.cache.get(msgData.guildId);
                    if (!guild) {
                        logger.debug(`Guild ${msgData.guildId} not found, deleting message record`);
                        await firebaseState.deleteMessage(msgData.guildId, msgData.messageType);
                        continue;
                    }
                    
                    const channel = guild.channels.cache.get(msgData.channelId);
                    if (!channel) {
                        logger.debug(`Channel ${msgData.channelId} not found, deleting message record`);
                        await firebaseState.deleteMessage(msgData.guildId, msgData.messageType);
                        continue;
                    }
                    
                    try {
                        const message = await channel.messages.fetch(msgData.messageId);
                        
                        if (msgData.hasButtons) {
                            try {
                                await message.edit({ components: [] });
                                logger.debug(`Removed buttons from message ${msgData.messageId}`);
                            } catch (editErr) {
                                logger.debug(`Could not remove buttons from message ${msgData.messageId}`);
                            }
                        }
                        
                        const messageAge = Date.now() - new Date(msgData.timestamp).getTime();
                        const maxAge = 24 * 60 * 60 * 1000;
                        
                        if (messageAge > maxAge) {
                            try {
                                await message.delete();
                                logger.debug(`Deleted old message ${msgData.messageId}`);
                            } catch (deleteErr) {
                                logger.debug(`Could not delete message ${msgData.messageId}`);
                            }
                            await firebaseState.deleteMessage(msgData.guildId, msgData.messageType);
                        }
                        
                    } catch (fetchErr) {
                        logger.debug(`Message ${msgData.messageId} not found, deleting record`);
                        await firebaseState.deleteMessage(msgData.guildId, msgData.messageType);
                    }
                    
                } catch (error) {
                    logger.error(`Error processing message ${msgData.messageId}`, error);
                }
            }
            
            logger.debug(`Completed message cleanup for guild ${guildId}`);
            
        } catch (error) {
            logger.error(`Failed to cleanup messages for guild ${guildId}`, error);
        }
    }

    async cleanupAllGuilds(client) {
        try {
            logger.info('Starting global message cleanup...');
            
            const guilds = client.guilds.cache.map(g => g.id);
            
            for (const guildId of guilds) {
                await this.cleanupGuildMessages(client, guildId);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            logger.info('Global message cleanup completed');
            
        } catch (error) {
            logger.error('Failed to cleanup messages for all guilds', error);
        }
    }

    startAutoCleanup(client, intervalMs = 30 * 60 * 1000) {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupAllGuilds(client);
        }, intervalMs);
        
        logger.info(`Auto cleanup started with interval: ${intervalMs}ms`);
    }

    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info('Auto cleanup stopped');
        }
    }

    async cleanupDeletedMessages(client) {
        try {
            logger.debug('Checking for deleted messages to cleanup from Firebase...');
            
            const guilds = client.guilds.cache.map(g => g.id);
            
            for (const guildId of guilds) {
                const messages = await firebaseState.getAllMessagesForGuild(guildId);
                
                for (const msgData of messages) {
                    try {
                        const guild = client.guilds.cache.get(msgData.guildId);
                        if (!guild) {
                            await firebaseState.deleteMessage(msgData.guildId, msgData.messageType);
                            continue;
                        }
                        
                        const channel = guild.channels.cache.get(msgData.channelId);
                        if (!channel) {
                            await firebaseState.deleteMessage(msgData.guildId, msgData.messageType);
                            continue;
                        }
                        
                        try {
                            await channel.messages.fetch(msgData.messageId);
                        } catch (fetchErr) {
                            await firebaseState.deleteMessage(msgData.guildId, msgData.messageType);
                            logger.debug(`Cleaned up deleted message ${msgData.messageId} from Firebase`);
                        }
                        
                    } catch (error) {
                        logger.error(`Error checking message ${msgData.messageId}`, error);
                    }
                }
            }
            
            logger.debug('Deleted messages cleanup completed');
            
        } catch (error) {
            logger.error('Failed to cleanup deleted messages', error);
        }
    }
}

module.exports = new MessageCleanupService();
