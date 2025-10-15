const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { canUseCommand } = require('../../utils/permissionUtils');
const firebaseState = require('../../services/FirebaseStateManager');

module.exports = {
    name: 'ban',
    category: 'admin',
    aliases: ['b'],
    description: 'Ban a member from the server',
    async execute(client, message, args) {
        if (!canUseCommand(message.author.id, message.member, PermissionFlagsBits.BanMembers)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You don't have permission to ban members.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I don't have permission to ban members.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        
        if (!target) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please mention a user or provide a user ID.\nUsage: \`!ban @user [reason]\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (target.id === message.author.id) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You cannot ban yourself.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (target.id === client.user.id) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I cannot ban myself.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (target.roles.highest.position >= message.member.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You cannot ban this user due to role hierarchy.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!target.bannable) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I cannot ban this user.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setTitle('🔨 You Have Been Banned')
                    .setDescription(
                        `You have been permanently banned from **${message.guild.name}**\n\n` +
                        `**Reason:** ${reason}\n` +
                        `**Banned by:** ${message.author.tag}\n` +
                        `**Banned at:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                        `If you believe this was a mistake, please contact the server moderators.`
                    )
                    .setThumbnail(message.guild.iconURL())
                    .setTimestamp();
                
                await target.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Could not DM ${target.user.tag} about ban.`);
            }
            
            await target.ban({ reason: `${reason} | Banned by ${message.author.tag}` });
            
            await firebaseState.logModerationAction(message.guild.id, {
                type: 'ban',
                targetUserId: target.id,
                targetUserTag: target.user.tag,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                reason: reason
            });
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('🔨 Member Banned')
                .setDescription(`**User:** ${target.user.tag}\n**Reason:** ${reason}\n**Banned by:** ${message.author.tag}`)
                .setTimestamp();
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 2);
        } catch (error) {
            console.error('Error banning member:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to ban member. Please try again.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
