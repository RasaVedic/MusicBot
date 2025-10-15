const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');

module.exports = {
    name: 'uptime',
    category: 'utility',
    aliases: ['up', 'botuptime'],
    description: 'Check how long the bot has been online',
    async execute(client, message, args) {
        const totalSeconds = Math.floor(client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        let uptimeString = '';
        if (days > 0) uptimeString += `${days}d `;
        if (hours > 0) uptimeString += `${hours}h `;
        if (minutes > 0) uptimeString += `${minutes}m `;
        uptimeString += `${seconds}s`;
        
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle('⏰ Bot Uptime')
            .setDescription(`${emoji.success} The bot has been online for:\n\`${uptimeString}\``)
            .setTimestamp();
        
        const reply = await message.reply({ embeds: [embed] });
        safeDeleteMultiple([reply], config.autoDeleteTime);
    }
};
