const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { canUseCommand } = require('../../utils/permissionUtils');

module.exports = {
    name: 'unlock',
    category: 'admin',
    aliases: [],
    description: 'Unlock a channel to allow members to send messages',
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

        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SendMessages: null
            });
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('🔓 Channel Unlocked')
                .setDescription(
                    `${message.channel} has been unlocked.\n\n` +
                    `**Unlocked by:** ${message.author.tag}`
                )
                .setTimestamp();
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 2);
        } catch (error) {
            console.error('Error unlocking channel:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to unlock channel. Please try again.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
