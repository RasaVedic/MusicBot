const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');

module.exports = {
    name: 'announce',
    category: 'admin',
    aliases: ['ann', 'broadcast'],
    description: 'Send an announcement to the current channel (Admin only)',
    async execute(client, message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && 
            message.author.id !== process.env.OWNER_ID) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need Administrator permission to use this command.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!args.length) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide an announcement message.\n**Usage:** \`announce <message>\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const announcement = args.join(' ');
        
        const announceEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setAuthor({ 
                name: `📢 Server Announcement`, 
    category: 'admin',
                iconURL: message.guild.iconURL() 
            })
            .setDescription(announcement)
            .setFooter({ 
                text: `Announced by ${message.author.username}`, 
                iconURL: message.author.displayAvatarURL() 
            })
            .setTimestamp();

        try {
            await message.channel.send({ embeds: [announceEmbed] });
            
            await message.delete().catch(() => {});
            
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to send announcement.`);
            
            const reply = await message.reply({ embeds: [errorEmbed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
