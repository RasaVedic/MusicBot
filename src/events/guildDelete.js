const { Events } = require('discord.js');
const firebaseState = require('../services/FirebaseStateManager');
const logger = require('../modules/@rasavedic').createModuleLogger('GuildDelete');

module.exports = {
    name: Events.GuildDelete,
    async execute(client, guild) {
        const guildName = guild.name || 'Unknown Server';
        const guildId = guild.id;
        const memberCount = guild.memberCount || 0;
        
        const reason = guild.available 
            ? 'Bot was removed/kicked from server' 
            : 'Server outage or unavailable';
        
        logger.info(`Left guild: ${guildName} (${guildId}) - Members: ${memberCount} - Reason: ${reason}`);
        
        await firebaseState.logGuildLeave(guildId, guildName, reason, memberCount);
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📤 BOT LEFT SERVER`);
        console.log(`Server: ${guildName}`);
        console.log(`ID: ${guildId}`);
        console.log(`Members: ${memberCount}`);
        console.log(`Reason: ${reason}`);
        console.log(`Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        console.log(`${'='.repeat(60)}\n`);
    }
};
