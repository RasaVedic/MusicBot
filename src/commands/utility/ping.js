const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');

module.exports = {
    name: 'ping',
    category: 'utility',
    aliases: ['latency'],
    description: 'Check bot latency and API response time',
    async execute(client, message, args) {
        const sent = await message.reply('🏓 Pinging...');
        
        const botLatency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: '📡 Bot Latency', value: `\`${botLatency}ms\``, inline: true },
                { name: '🌐 API Latency', value: `\`${apiLatency}ms\``, inline: true }
            )
            .setTimestamp();
        
        await sent.edit({ content: null, embeds: [embed] });
        safeDeleteMultiple([sent, message], config.autoDeleteTime);
    }
};
