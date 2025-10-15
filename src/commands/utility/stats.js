const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');

module.exports = {
    name: 'stats',
    category: 'utility',
    aliases: ['botstats', 'info'],
    description: 'Show bot statistics and information',
    async execute(client, message, args) {
        const totalSeconds = Math.floor(client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        let uptimeString = '';
        if (days > 0) uptimeString += `${days}d `;
        if (hours > 0) uptimeString += `${hours}h `;
        uptimeString += `${minutes}m`;
        
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle('📊 Bot Statistics')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '🏷️ Bot Name', value: `\`${client.user.tag}\``, inline: true },
                { name: '🆔 Bot ID', value: `\`${client.user.id}\``, inline: true },
                { name: '⏰ Uptime', value: `\`${uptimeString}\``, inline: true },
                { name: '🌐 Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
                { name: '👥 Users', value: `\`${client.users.cache.size}\``, inline: true },
                { name: '💾 Memory', value: `\`${memoryUsage} MB\``, inline: true },
                { name: '🏓 Ping', value: `\`${Math.round(client.ws.ping)}ms\``, inline: true },
                { name: '📝 Commands', value: `\`${client.commands.size}\``, inline: true },
                { name: '🎵 Node.js', value: `\`${process.version}\``, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${message.author.tag}` });
        
        const reply = await message.reply({ embeds: [embed] });
        safeDeleteMultiple([reply], config.autoDeleteTime * 2);
    }
};
