const firebaseState = require('../services/FirebaseStateManager');
const logger = require('../modules/@rasavedic').createModuleLogger('MessageDelete');

module.exports = {
    name: 'messageDelete',
    async execute(client, message) {
        if (!message.guild) return;
        
        try {
            const guildMessages = await firebaseState.getAllMessagesForGuild(message.guild.id);
            
            for (const msgData of guildMessages) {
                if (msgData.messageId === message.id) {
                    await firebaseState.deleteMessage(message.guild.id, msgData.messageType);
                    logger.debug(`Cleaned up deleted message ${message.id} from Firebase (type: ${msgData.messageType})`);
                }
            }
        } catch (error) {
            logger.error(`Error handling message deletion for ${message.id}`, error);
        }
    }
};
