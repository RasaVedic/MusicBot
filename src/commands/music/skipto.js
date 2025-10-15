const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple, safeDelete } = require('../../utils/messageUtils');
const { canUseAdminCommand } = require('../../utils/permissionUtils');

module.exports = {
    name: 'skipto',
    category: 'music',
    aliases: ['st', 'jumpto'],
    description: 'Skip to a specific position in queue (Admin only)',
    async execute(client, message, args) {
        if (!canUseAdminCommand(message.author.id, message.member)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} This command is restricted to administrators only.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const player = client.manager.get(message.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} No music is currently playing.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!args[0] || isNaN(args[0])) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide a valid queue position number.\n**Usage:** \`skipto <position>\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const position = parseInt(args[0]);

        if (position < 1 || position > player.queue.length) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Invalid position. Queue has ${player.queue.length} tracks.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const tracksToSkip = position - 1;
        // Use proper Kazagumo queue API to remove tracks
        for (let i = 0; i < tracksToSkip; i++) {
            player.queue.remove(0);
        }

        if (player.preloadTimer) {
            clearTimeout(player.preloadTimer);
            player.preloadTimer = null;
        }

        if (player.nowPlayingMessage) {
            await safeDelete(player.nowPlayingMessage);
            player.nowPlayingMessage = null;
        }

        player.skip();

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.success} Skipped to position **${position}** in queue.`);

        const reply = await message.reply({ embeds: [embed] });
        safeDeleteMultiple([reply], config.autoDeleteTime);
    }
};
