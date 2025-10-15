const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { canUseCommand } = require('../../utils/permissionUtils');

module.exports = {
    name: 'unmute',
    category: 'admin',
    aliases: ['untimeout'],
    description: 'Remove timeout/unmute a member',
    async execute(client, message, args) {
        if (!canUseCommand(message.author.id, message.member, PermissionFlagsBits.ModerateMembers)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You don't have permission to manage timeouts.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I don't have permission to manage timeouts.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        
        if (!target) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please mention a user or provide a user ID.\nUsage: \`!unmute @user\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!target.isCommunicationDisabled()) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} This user is not muted.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        try {
            await target.timeout(null, `Unmuted by ${message.author.tag}`);
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('🔊 Member Unmuted')
                .setDescription(`**User:** ${target.user.tag}\n**Unmuted by:** ${message.author.tag}`)
                .setTimestamp();
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 2);
        } catch (error) {
            console.error('Error unmuting member:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to unmute member. Please try again.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
