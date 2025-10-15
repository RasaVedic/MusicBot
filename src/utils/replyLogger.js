const debugLogger = require('./debugLogger');

async function loggedReply(message, content, reason = 'command_response') {
    let sentMessage;
    
    if (typeof content === 'object' && content.embeds) {
        sentMessage = await message.reply(content);
        
        debugLogger.logBotReply(sentMessage, message.channel, reason, {
            hasEmbeds: true,
            embedCount: content.embeds.length,
            replyToMessageId: message.id,
            replyToUserId: message.author.id
        });
    } else if (typeof content === 'string') {
        sentMessage = await message.reply(content);
        
        debugLogger.logBotReply(sentMessage, message.channel, reason, {
            contentType: 'text',
            replyToMessageId: message.id,
            replyToUserId: message.author.id
        });
    } else {
        sentMessage = await message.reply(content);
        
        debugLogger.logBotReply(sentMessage, message.channel, reason, {
            replyToMessageId: message.id,
            replyToUserId: message.author.id
        });
    }
    
    return sentMessage;
}

async function loggedSend(channel, content, reason = 'bot_message') {
    let sentMessage;
    
    if (typeof content === 'object' && content.embeds) {
        sentMessage = await channel.send(content);
        
        debugLogger.logBotReply(sentMessage, channel, reason, {
            hasEmbeds: true,
            embedCount: content.embeds.length
        });
    } else if (typeof content === 'string') {
        sentMessage = await channel.send(content);
        
        debugLogger.logBotReply(sentMessage, channel, reason, {
            contentType: 'text'
        });
    } else {
        sentMessage = await channel.send(content);
        
        debugLogger.logBotReply(sentMessage, channel, reason);
    }
    
    return sentMessage;
}

async function loggedEdit(message, content, reason = 'message_edit') {
    let editedMessage;
    
    if (typeof content === 'object' && content.embeds) {
        editedMessage = await message.edit(content);
        
        debugLogger.logBotReply(editedMessage, message.channel, reason, {
            action: 'edit',
            hasEmbeds: true,
            embedCount: content.embeds.length
        });
    } else {
        editedMessage = await message.edit(content);
        
        debugLogger.logBotReply(editedMessage, message.channel, reason, {
            action: 'edit'
        });
    }
    
    return editedMessage;
}

module.exports = {
    loggedReply,
    loggedSend,
    loggedEdit
};
