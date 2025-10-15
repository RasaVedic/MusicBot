const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config.json');
const emoji = require('../../config/emoji.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { canUseCommand } = require('../../utils/permissionUtils');

module.exports = {
    name: 'purge',
    category: 'admin',
    aliases: ['clear', 'prune'],
    description: 'Delete multiple messages at once',
    async execute(client, message, args) {
        if (!canUseCommand(message.author.id, message.member, PermissionFlagsBits.ManageMessages)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You don't have permission to manage messages.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} I don't have permission to manage messages.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const amount = parseInt(args[0]);

        if (!amount || isNaN(amount)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide a valid number of messages to delete.\nUsage: \`!purge <amount>\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (amount < 1 || amount > 100) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide a number between 1 and 100.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        try {
            // Discord's limit is 100, so we need to cap it
            const fetchLimit = Math.min(amount + 1, 100);
            const messages = await message.channel.messages.fetch({ limit: fetchLimit });
            
            const deletableMessages = messages.filter(msg => {
                const age = Date.now() - msg.createdTimestamp;
                return age < 14 * 24 * 60 * 60 * 1000;
            });

            await message.channel.bulkDelete(deletableMessages, true);
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.success} Successfully deleted **${deletableMessages.size - 1}** message${deletableMessages.size - 1 !== 1 ? 's' : ''}.`);
            
            const reply = await message.channel.send({ embeds: [embed] });
            
            setTimeout(async () => {
                try {
                    await reply.delete();
                } catch (err) {}
            }, config.autoDeleteTime);
        } catch (error) {
            console.error('Error purging messages:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to delete messages. They might be older than 14 days.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
