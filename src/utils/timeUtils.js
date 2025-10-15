const { MessageFlags } = require('discord.js');

function isIndianSilentTime() {
    const now = new Date();
    
    // Get hours in IST using Intl.DateTimeFormat
    const istHours = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
    }).format(now);
    
    const hours = parseInt(istHours);
    
    // Silent mode: 10 PM (22:00) to 6 AM (06:00) IST
    return hours >= 22 || hours < 6;
}

function shouldSuppressNotifications() {
    return isIndianSilentTime();
}

function getSilentMessageOptions(options = {}) {
    const isSilent = isIndianSilentTime();
    if (isSilent) {
        return {
            ...options,
            flags: MessageFlags.SuppressNotifications
        };
    }
    return options;
}

async function sendSilentAwareMessage(channel, options) {
    const messageOptions = getSilentMessageOptions(options);
    return await channel.send(messageOptions);
}

async function replySilentAware(message, options) {
    const messageOptions = getSilentMessageOptions(options);
    return await message.reply(messageOptions);
}

function getIndianTimestamp() {
    const now = new Date();
    
    const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
    };
    
    return now.toLocaleString('en-IN', options);
}

module.exports = {
    isIndianSilentTime,
    shouldSuppressNotifications,
    getSilentMessageOptions,
    sendSilentAwareMessage,
    replySilentAware,
    getIndianTimestamp
};
