const { ActivityType } = require('discord.js');
const logger = require('../modules/@rasavedic').createModuleLogger('Ready');
const emoji = require('../config/emoji.json');
const firebaseState = require('../services/FirebaseStateManager');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        logger.info(`${client.user.tag} is online!`);
        logger.info(`Serving ${client.guilds.cache.size} servers`);
        
        await client.manager.init();
        
        // Cleanup old data from Firebase (older than 24 hours)
        try {
            await firebaseState.cleanupOldData(24);
        } catch (error) {
            logger.error('Failed to cleanup old Firebase data', error);
        }
        
        // Schedule daily cleanup at midnight
        const scheduleCleanup = () => {
            const now = new Date();
            const midnight = new Date(now);
            midnight.setHours(24, 0, 0, 0); // Next midnight
            const msUntilMidnight = midnight.getTime() - now.getTime();
            
            setTimeout(async () => {
                logger.info('Running scheduled Firebase cleanup...');
                try {
                    await firebaseState.cleanupOldData(24);
                } catch (error) {
                    logger.error('Scheduled cleanup failed', error);
                }
                // Reschedule for next day
                scheduleCleanup();
            }, msUntilMidnight);
        };
        
        scheduleCleanup();
        logger.info('Scheduled daily Firebase cleanup');
        
        client.user.setActivity(`Music ${emoji.music} | Use prefix or @ me`, { type: ActivityType.Playing });
    }
};
