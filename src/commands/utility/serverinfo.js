const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { isBotOwner } = require('../../utils/permissionUtils');

function redactSensitive(value) {
    if (!value || value.length <= 4) return '[REDACTED]';
    return value.substring(0, 2) + '[REDACTED]' + value.substring(value.length - 2);
}

module.exports = {
    name: 'serverinfo',
    category: 'utility',
    aliases: ['si', 'guildinfo'],
    description: 'Shows detailed server information with permissions (Moderator only)',
    async execute(client, message, args) {
        const guild = message.guild;
        
        if (!guild) {
            return message.reply('This command can only be used in a server.');
        }

        const isOwner = isBotOwner(message.author.id);
        const isModerator = message.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                           message.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isOwner && !isModerator) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} This command is only available to moderators and bot owner.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        await message.channel.sendTyping();

        const owner = await guild.fetchOwner();
        const textChannels = guild.channels.cache.filter(c => c.type === 0);
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2);
        
        const adminMembers = guild.members.cache.filter(m => 
            m.permissions.has(PermissionFlagsBits.Administrator)
        );
        
        const moderatorMembers = guild.members.cache.filter(m => 
            m.permissions.has(PermissionFlagsBits.ModerateMembers) && 
            !m.permissions.has(PermissionFlagsBits.Administrator)
        );

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`📊 Server Information: ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '🆔 Server ID', value: redactSensitive(guild.id), inline: true },
                { name: '👑 Owner', value: `${owner.user.tag}`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '💬 Text Channels', value: `${textChannels.size}`, inline: true },
                { name: '🔊 Voice Channels', value: `${voiceChannels.size}`, inline: true },
                { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
                { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
                { name: '🚀 Boost Level', value: `Level ${guild.premiumTier}`, inline: true }
            );

        if (adminMembers.size > 0) {
            const adminList = adminMembers
                .map(m => `• ${m.user.tag}`)
                .slice(0, 10)
                .join('\n');
            embed.addFields({ 
                name: `👑 Administrators (${adminMembers.size})`, 
                value: adminList + (adminMembers.size > 10 ? `\n...and ${adminMembers.size - 10} more` : ''), 
                inline: false 
            });
        }

        if (moderatorMembers.size > 0) {
            const modList = moderatorMembers
                .map(m => `• ${m.user.tag}`)
                .slice(0, 10)
                .join('\n');
            embed.addFields({ 
                name: `🛡️ Moderators (${moderatorMembers.size})`, 
                value: modList + (moderatorMembers.size > 10 ? `\n...and ${moderatorMembers.size - 10} more` : ''), 
                inline: false 
            });
        }

        const currentChannel = message.channel;
        embed.addFields(
            { name: '📍 Current Channel', value: currentChannel.name, inline: true },
            { name: '🔗 Channel ID', value: redactSensitive(currentChannel.id), inline: true },
            { name: '🤖 Bot in Server', value: guild.members.cache.has(client.user.id) ? '✅ Yes' : '❌ No', inline: true }
        );

        embed.setFooter({ text: `Requested by ${message.author.tag} • Auto-deletes in ${config.autoDeleteTime / 1000}s` });
        embed.setTimestamp();

        const reply = await message.reply({ embeds: [embed] });
        
        const permissionsEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle('🔐 Key Permissions Overview')
            .setDescription('Showing key permissions for this channel and server');

        const botMember = guild.members.cache.get(client.user.id);
        const botPerms = [];
        
        if (botMember.permissions.has(PermissionFlagsBits.Administrator)) botPerms.push('✅ Administrator');
        if (botMember.permissions.has(PermissionFlagsBits.ManageGuild)) botPerms.push('✅ Manage Server');
        if (botMember.permissions.has(PermissionFlagsBits.ManageChannels)) botPerms.push('✅ Manage Channels');
        if (botMember.permissions.has(PermissionFlagsBits.ManageRoles)) botPerms.push('✅ Manage Roles');
        if (botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) botPerms.push('✅ Moderate Members');
        if (botMember.permissions.has(PermissionFlagsBits.KickMembers)) botPerms.push('✅ Kick Members');
        if (botMember.permissions.has(PermissionFlagsBits.BanMembers)) botPerms.push('✅ Ban Members');

        permissionsEmbed.addFields({ 
            name: '🤖 Bot Permissions', 
            value: botPerms.length > 0 ? botPerms.join('\n') : 'No key permissions', 
            inline: true 
        });

        const userPerms = [];
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) userPerms.push('✅ Administrator');
        if (message.member.permissions.has(PermissionFlagsBits.ManageGuild)) userPerms.push('✅ Manage Server');
        if (message.member.permissions.has(PermissionFlagsBits.ManageChannels)) userPerms.push('✅ Manage Channels');
        if (message.member.permissions.has(PermissionFlagsBits.ManageRoles)) userPerms.push('✅ Manage Roles');
        if (message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) userPerms.push('✅ Moderate Members');
        if (message.member.permissions.has(PermissionFlagsBits.KickMembers)) userPerms.push('✅ Kick Members');
        if (message.member.permissions.has(PermissionFlagsBits.BanMembers)) userPerms.push('✅ Ban Members');

        permissionsEmbed.addFields({ 
            name: '👤 Your Permissions', 
            value: userPerms.length > 0 ? userPerms.join('\n') : 'No key permissions', 
            inline: true 
        });

        const permReply = await message.channel.send({ embeds: [permissionsEmbed] });

        safeDeleteMultiple([reply, permReply, message], config.autoDeleteTime * 3);
    }
};
