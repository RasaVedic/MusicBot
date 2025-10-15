const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { canUseCommand } = require('../../utils/permissionUtils');
const firebaseState = require('../../services/FirebaseStateManager');

module.exports = {
    name: 'unban',
    category: 'admin',
    aliases: ['ub', 'pardon'],
    description: 'Unban a previously banned user',
    async execute(client, message, args) {
        if (!canUseCommand(message.author.id, message.member, PermissionFlagsBits.BanMembers)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You don't have permission to unban members.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I don't have permission to unban members.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const userId = args[0];
        
        if (!userId) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide a user ID.\nUsage: \`!unban <userId> [reason]\`\n\nTip: Use \`!modlogs bans\` to view banned users`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            const banList = await message.guild.bans.fetch();
            const bannedUser = banList.get(userId);

            if (!bannedUser) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} This user is not banned.\n\nUser ID: \`${userId}\``);
                
                const reply = await message.reply({ embeds: [embed] });
                safeDeleteMultiple([reply], config.autoDeleteTime);
                return;
            }

            await message.guild.members.unban(userId, `${reason} | Unbanned by ${message.author.tag}`);
            
            await firebaseState.logModerationAction(message.guild.id, {
                type: 'unban',
                targetUserId: userId,
                targetUserTag: bannedUser.user.tag,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                reason: reason
            });
            
            const logs = await firebaseState.getModerationLogs(message.guild.id, {
                type: 'ban',
                targetUserId: userId,
                activeOnly: true,
                limit: 1
            });
            
            if (logs.length > 0) {
                await firebaseState.deactivateModerationLog(logs[0].id);
            }
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('✅ Member Unbanned')
                .setDescription(
                    `**User:** ${bannedUser.user.tag}\n` +
                    `**User ID:** ${userId}\n` +
                    `**Reason:** ${reason}\n` +
                    `**Unbanned by:** ${message.author.tag}`
                )
                .setTimestamp();
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 2);
        } catch (error) {
            console.error('Error unbanning member:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to unban user. Please check the user ID and try again.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
