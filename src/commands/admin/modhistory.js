const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const firebaseState = require('../../services/FirebaseStateManager');

module.exports = {
    name: 'modhistory',
    category: 'admin',
    aliases: ['history', 'modhist', 'actionlog'],
    description: 'View moderation history for a user or server',
    async execute(client, message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && 
            message.author.id !== process.env.OWNER_ID) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need Moderator permissions to use this command.`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const targetUser = message.mentions.users.first() || 
                          (args[0] && !isNaN(args[0]) ? await client.users.fetch(args[0]).catch(() => null) : null);

        const typeFilter = args.find(arg => ['ban', 'kick', 'mute', 'warn', 'unban'].includes(arg.toLowerCase()));

        try {
            let options = {
                limit: 20
            };

            if (targetUser) {
                options.targetUserId = targetUser.id;
            }

            if (typeFilter) {
                options.type = typeFilter.toLowerCase();
            }

            const logs = await firebaseState.getModerationLogs(message.guild.id, options);

            if (logs.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(
                        targetUser 
                            ? `${emoji.info} No moderation history found for **${targetUser.tag}**` 
                            : `${emoji.info} No moderation history found for this server.`
                    );

                const reply = await message.reply({ embeds: [embed] });
                safeDeleteMultiple([reply], config.autoDeleteTime);
                return;
            }

            const typeEmojis = {
                'ban': '🔨',
                'unban': '✅',
                'kick': '👢',
                'mute': '🔇',
                'warn': '⚠️'
            };

            const logList = logs.slice(0, 10).map((log, index) => {
                const typeEmoji = typeEmojis[log.type] || '📝';
                const timestamp = `<t:${Math.floor(log.timestamp / 1000)}:R>`;
                const status = log.active ? '🟢' : '🔴';

                let logText = `**${index + 1}.** ${typeEmoji} ${log.type.toUpperCase()} - ${status}\n`;
                logText += `┣ **User:** ${log.targetUserTag} (\`${log.targetUserId}\`)\n`;
                logText += `┣ **Moderator:** ${log.moderatorTag}\n`;
                logText += `┣ **Reason:** ${log.reason}\n`;

                if (log.duration) {
                    logText += `┣ **Duration:** ${log.duration}\n`;
                }

                logText += `┗ **Time:** ${timestamp}`;

                return logText;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({ 
                    name: targetUser 
                        ? `Moderation History - ${targetUser.tag}` 
                        : `Moderation History - ${message.guild.name}`,
                    iconURL: targetUser ? targetUser.displayAvatarURL() : message.guild.iconURL()
                })
                .setDescription(
                    `**Filter:** ${typeFilter ? typeFilter.toUpperCase() : 'All Actions'}\n` +
                    `**Total Records:** ${logs.length}\n\n` +
                    logList
                )
                .setFooter({ 
                    text: `🟢 = Active | 🔴 = Deactivated | Showing ${Math.min(10, logs.length)} of ${logs.length} records` 
                })
                .setTimestamp();

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 3);
        } catch (error) {
            console.error('Error fetching moderation history:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to fetch moderation history. Please try again.`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};