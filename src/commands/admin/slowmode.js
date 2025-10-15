const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { canUseCommand } = require('../../utils/permissionUtils');

module.exports = {
    name: 'slowmode',
    category: 'admin',
    aliases: ['sm', 'slow'],
    description: 'Set slowmode for the channel',
    async execute(client, message, args) {
        if (!canUseCommand(message.author.id, message.member, PermissionFlagsBits.ManageChannels)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You don't have permission to manage channels.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I don't have permission to manage channels.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const seconds = parseInt(args[0]);

        if (!args[0] || isNaN(seconds)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide a valid number of seconds (0-21600).\nUsage: \`!slowmode <seconds>\`\nExample: \`!slowmode 5\` or \`!slowmode 0\` to disable`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (seconds < 0 || seconds > 21600) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Slowmode must be between 0 and 21600 seconds (6 hours).`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        try {
            await message.channel.setRateLimitPerUser(seconds);
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('⏱️ Slowmode Updated')
                .setDescription(
                    seconds === 0 
                        ? `**Slowmode disabled** in ${message.channel}\n**Set by:** ${message.author.tag}`
                        : `**Slowmode set to ${seconds} seconds** in ${message.channel}\n**Set by:** ${message.author.tag}`
                )
                .setTimestamp();
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 2);
        } catch (error) {
            console.error('Error setting slowmode:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to set slowmode. Please try again.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
