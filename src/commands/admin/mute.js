const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { canUseCommand } = require('../../utils/permissionUtils');
const firebaseState = require('../../services/FirebaseStateManager');

module.exports = {
    name: 'mute',
    category: 'admin',
    aliases: ['timeout'],
    description: 'Timeout/mute a member',
    async execute(client, message, args) {
        if (!canUseCommand(message.author.id, message.member, PermissionFlagsBits.ModerateMembers)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You don't have permission to timeout members.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I don't have permission to timeout members.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        
        if (!target) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please mention a user or provide a user ID.\nUsage: \`!mute @user <time> [reason]\`\nTime format: 10m, 1h, 1d`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (target.id === message.author.id) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You cannot mute yourself.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (target.id === client.user.id) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I cannot mute myself.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (target.roles.highest.position >= message.member.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You cannot mute this user due to role hierarchy.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!target.moderatable) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I cannot mute this user.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const timeArg = args[1];
        if (!timeArg) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please specify a time.\nExample: \`!mute @user 10m Spamming\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const timeRegex = /^(\d+)(m|h|d)$/;
        const match = timeArg.match(timeRegex);

        if (!match) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Invalid time format. Use: \`<number><m|h|d>\`\nExample: \`10m\`, \`2h\`, \`1d\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const amount = parseInt(match[1]);
        const unit = match[2];

        let milliseconds;
        let displayTime;

        switch (unit) {
            case 'm':
                if (amount > 40320) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Maximum timeout is 28 days (40320 minutes).`);
                    
                    const reply = await message.reply({ embeds: [embed] });
                    safeDeleteMultiple([reply], config.autoDeleteTime);
                    return;
                }
                milliseconds = amount * 60 * 1000;
                displayTime = `${amount} minute${amount !== 1 ? 's' : ''}`;
                break;
            case 'h':
                if (amount > 672) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Maximum timeout is 28 days (672 hours).`);
                    
                    const reply = await message.reply({ embeds: [embed] });
                    safeDeleteMultiple([reply], config.autoDeleteTime);
                    return;
                }
                milliseconds = amount * 60 * 60 * 1000;
                displayTime = `${amount} hour${amount !== 1 ? 's' : ''}`;
                break;
            case 'd':
                if (amount > 28) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Maximum timeout is 28 days.`);
                    
                    const reply = await message.reply({ embeds: [embed] });
                    safeDeleteMultiple([reply], config.autoDeleteTime);
                    return;
                }
                milliseconds = amount * 24 * 60 * 60 * 1000;
                displayTime = `${amount} day${amount !== 1 ? 's' : ''}`;
                break;
        }

        const reason = args.slice(2).join(' ') || 'No reason provided';

        try {
            await target.timeout(milliseconds, `${reason} | Muted by ${message.author.tag}`);
            
            await firebaseState.logModerationAction(message.guild.id, {
                type: 'mute',
                targetUserId: target.id,
                targetUserTag: target.user.tag,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                reason: reason,
                duration: displayTime,
                expiresAt: Date.now() + milliseconds
            });
            
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setTitle('🔇 You Have Been Muted')
                    .setDescription(
                        `You have been muted in **${message.guild.name}**\n\n` +
                        `**Duration:** ${displayTime}\n` +
                        `**Reason:** ${reason}\n` +
                        `**Muted by:** ${message.author.tag}\n` +
                        `**Muted at:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                        `You will be unmuted automatically after the timeout expires.`
                    )
                    .setThumbnail(message.guild.iconURL())
                    .setTimestamp();
                
                await target.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Could not DM ${target.user.tag} about mute.`);
            }
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('🔇 Member Muted')
                .setDescription(`**User:** ${target.user.tag}\n**Duration:** ${displayTime}\n**Reason:** ${reason}\n**Muted by:** ${message.author.tag}`)
                .setTimestamp();
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 2);
        } catch (error) {
            console.error('Error muting member:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to mute member. Please try again.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
