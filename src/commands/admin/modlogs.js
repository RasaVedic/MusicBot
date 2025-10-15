const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');

module.exports = {
    name: 'modlogs',
    category: 'admin',
    aliases: ['logs', 'modlog', 'moderationlogs'],
    description: 'View server moderation logs (bans, mutes, warns) - Admin only',
    async execute(client, message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && 
            !message.member.permissions.has(PermissionFlagsBits.ModerateMembers) &&
            message.author.id !== process.env.OWNER_ID) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need Administrator or Moderator permissions to use this command.`);
            
            const reply = await message.channel.send({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        await message.channel.sendTyping();

        const logType = args[0]?.toLowerCase() || 'all';
        
        try {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({ 
                    name: `${message.guild.name} - Moderation Logs`, 
    category: 'admin',
                    iconURL: message.guild.iconURL() 
                })
                .setTimestamp();

            if (logType === 'bans' || logType === 'all') {
                const bans = await message.guild.bans.fetch().catch(() => null);
                
                if (bans && bans.size > 0) {
                    const banList = bans.map((ban, index) => {
                        const user = ban.user;
                        const reason = ban.reason || 'No reason provided';
                        return `**${index + 1}.** ${user.tag} (${user.id})\n┗ Reason: ${reason}`;
                    }).slice(0, 5).join('\n\n');
                    
                    embed.addFields({
                        name: `🔨 Banned Users (${bans.size} total)`,
    category: 'admin',
                        value: bans.size > 5 ? `${banList}\n\n*...and ${bans.size - 5} more*` : banList,
                        inline: false
                    });
                } else {
                    embed.addFields({
                        name: '🔨 Banned Users',
    category: 'admin',
                        value: 'No banned users found.',
                        inline: false
                    });
                }
            }

            if (logType === 'mutes' || logType === 'all') {
                const members = await message.guild.members.fetch().catch(() => null);
                const mutedMembers = members?.filter(m => m.communicationDisabledUntil && m.communicationDisabledUntil > Date.now());
                
                if (mutedMembers && mutedMembers.size > 0) {
                    const muteList = mutedMembers.map((member, index) => {
                        const until = member.communicationDisabledUntil;
                        const timeRemaining = Math.floor((until - Date.now()) / 1000);
                        const timeString = timeRemaining > 0 
                            ? `<t:${Math.floor(until / 1000)}:R>` 
                            : 'Expired';
                        return `**${index + 1}.** ${member.user.tag} (${member.id})\n┗ Unmutes ${timeString}`;
                    }).slice(0, 5).join('\n\n');
                    
                    embed.addFields({
                        name: `🔇 Muted Users (${mutedMembers.size} total)`,
    category: 'admin',
                        value: mutedMembers.size > 5 ? `${muteList}\n\n*...and ${mutedMembers.size - 5} more*` : muteList,
                        inline: false
                    });
                } else {
                    embed.addFields({
                        name: '🔇 Muted Users',
    category: 'admin',
                        value: 'No muted users found.',
                        inline: false
                    });
                }
            }

            if (embed.data.fields?.length === 0) {
                embed.setDescription(`${emoji.info} No moderation logs found.\n\n**Usage:**\n\`modlogs\` - Show all logs\n\`modlogs bans\` - Show only bans\n\`modlogs mutes\` - Show only mutes`);
            }

            embed.setFooter({ 
                text: `Requested by ${message.author.username}`, 
                iconURL: message.author.displayAvatarURL() 
            });

            const reply = await message.channel.send({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 3);
            
        } catch (error) {
            console.error('Error fetching moderation logs:', error);
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to fetch moderation logs. Make sure I have proper permissions.`);
            
            const reply = await message.channel.send({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
