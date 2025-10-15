const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { canUseCommand } = require('../../utils/permissionUtils');
const firebaseState = require('../../services/FirebaseStateManager');

module.exports = {
    name: 'warn',
    category: 'admin',
    aliases: ['w'],
    description: 'Warn a member',
    async execute(client, message, args) {
        if (!canUseCommand(message.author.id, message.member, PermissionFlagsBits.ModerateMembers)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You don't have permission to warn members.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        
        if (!target) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please mention a user or provide a user ID.\nUsage: \`!warn @user [reason]\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (target.id === message.author.id) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You cannot warn yourself.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (target.id === client.user.id) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I cannot warn myself.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (target.roles.highest.position >= message.member.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You cannot warn this user due to role hierarchy.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setTitle('⚠️ You Have Been Warned')
                    .setDescription(
                        `You have received a warning in **${message.guild.name}**\n\n` +
                        `**Reason:** ${reason}\n` +
                        `**Warned by:** ${message.author.tag}\n` +
                        `**Warned at:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                        `Please follow the server rules to avoid further action.`
                    )
                    .setThumbnail(message.guild.iconURL())
                    .setTimestamp();
                
                await target.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Could not DM ${target.user.tag} about warning.`);
            }
            
            await firebaseState.logModerationAction(message.guild.id, {
                type: 'warn',
                targetUserId: target.id,
                targetUserTag: target.user.tag,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                reason: reason
            });
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('⚠️ Member Warned')
                .setDescription(`**User:** ${target.user.tag}\n**Reason:** ${reason}\n**Warned by:** ${message.author.tag}`)
                .setTimestamp();
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 2);
        } catch (error) {
            console.error('Error warning member:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to warn member. Please try again.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
