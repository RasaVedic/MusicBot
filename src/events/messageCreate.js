const { handleCommand } = require('../handlers/commandHandler');
const debugLogger = require('../utils/debugLogger');

module.exports = {
    name: 'messageCreate',
    async execute(client, message) {
        if (!message.guild) return;
        
        if (message.author.bot) {
            if (message.author.id === client.user.id) {
                debugLogger.logBotReply(message, message.channel, 'bot_message_sent', {
                    isReply: message.reference !== null,
                    repliedToMessageId: message.reference?.messageId
                });
            }
            return;
        }
        
        debugLogger.logMessageEvent('messageCreate', message, {
            hasPrefix: message.content.startsWith(await client.serverSettings.getPrefix(message.guild.id))
        });
        
        await handleCommand(client, message, client.serverSettings);
    }
};
