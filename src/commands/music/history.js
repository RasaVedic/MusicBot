const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { createClickableTitle } = require('../../utils/trackUtils');
const firebaseState = require('../../services/FirebaseStateManager');

module.exports = {
    name: 'history',
    category: 'music',
    aliases: ['h', 'played', 'recent'],
    description: 'Show recently played songs in this server',
    async execute(client, message, args) {
        await message.channel.sendTyping();
        
        try {
            const guildHistory = await firebaseState.getUserActivity(null, message.guild.id);
            
            if (!guildHistory || guildHistory.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.info} No playback history found for this server.`);
                
                const reply = await message.reply({ embeds: [embed] });
                safeDeleteMultiple([reply], config.autoDeleteTime);
                return;
            }

            const sortedHistory = guildHistory
                .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
                .slice(0, 10);

            const historyList = sortedHistory.map((entry, index) => {
                const track = entry.trackTitle || 'Unknown Track';
                const requester = entry.userId ? `<@${entry.userId}>` : 'Unknown User';
                const timeAgo = entry.lastPlayed 
                    ? `<t:${Math.floor(entry.lastPlayed / 1000)}:R>` 
                    : 'Unknown time';
                
                return `**${index + 1}.** ${track}\n┗ Played by ${requester} ${timeAgo}`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({ 
                    name: `${message.guild.name} - Playback History`, 
    category: 'music',
                    iconURL: message.guild.iconURL() 
                })
                .setDescription(
                    `${emoji.music} **Last 10 Played Songs**\n\n${historyList}`
                )
                .setFooter({ 
                    text: `Requested by ${message.author.username}`, 
                    iconURL: message.author.displayAvatarURL() 
                })
                .setTimestamp();

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 3);
            
        } catch (error) {
            console.error('Error fetching history:', error);
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to fetch playback history.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
