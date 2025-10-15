const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDelete } = require('../../utils/messageUtils');
const { canUseCommand } = require('../../utils/permissionUtils');

module.exports = {
    name: 'prefix',
    category: 'utility',
    aliases: ['setprefix'],
    description: 'Set or view the server prefix',
    async execute(client, message, args, serverSettings) {
        if (!args.length) {
            const currentPrefix = await serverSettings.getPrefix(message.guild.id);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.info} Current prefix for this server: **${currentPrefix}**\n\nNote: Bot owner can use commands without prefix.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDelete(reply, config.autoDeleteTime);
            return;
        }

        if (!canUseCommand(message.author.id, message.member, PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need Administrator permission to change the prefix.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDelete(reply, config.autoDeleteTime);
            return;
        }

        const newPrefix = args[0];
        
        if (newPrefix.length > 5) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Prefix must be 5 characters or less.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDelete(reply, config.autoDeleteTime);
            return;
        }

        await serverSettings.setPrefix(message.guild.id, newPrefix);

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.success} Prefix updated to: **${newPrefix}**`);

        const reply = await message.reply({ embeds: [embed] });
        safeDelete(reply, config.autoDeleteTime);
    }
};
