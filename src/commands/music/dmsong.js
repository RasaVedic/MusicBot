const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { createClickableTitle } = require('../../utils/trackUtils');

module.exports = {
    name: 'dmsong',
    category: 'music',
    aliases: ['dm', 'sendsong'],
    description: 'Send current playing song details to your DM',
    async execute(client, message, args) {
        const player = client.manager.get(message.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} No music is currently playing.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const track = player.queue.current;
        const clickableTitle = createClickableTitle(track, 100);
        
        const formatDuration = (ms) => {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        const dmEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setAuthor({ 
                name: `🎵 Now Playing in ${message.guild.name}`, 
    category: 'music',
                iconURL: message.guild.iconURL() 
            })
            .setTitle(track.title)
            .setURL(track.uri)
            .setDescription(
                `**Artist:** ${track.author || 'Unknown'}\n` +
                `**Duration:** ${formatDuration(track.length)}\n` +
                `**Requested by:** ${track.requester?.username || 'Unknown'}\n\n` +
                `**Link:** ${clickableTitle}`
            )
            .setThumbnail(track.thumbnail || null)
            .setFooter({ text: `Sent from ${message.guild.name}` })
            .setTimestamp();

        try {
            await message.author.send({ embeds: [dmEmbed] });
            
            const successEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.success} Song details sent to your DM! Check your inbox.`);
            
            const reply = await message.reply({ embeds: [successEmbed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Couldn't send you a DM. Please enable DMs from server members.`);
            
            const reply = await message.reply({ embeds: [errorEmbed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
