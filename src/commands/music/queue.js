const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDelete } = require('../../utils/messageUtils');
const { getIndianTimestamp } = require('../../utils/timeUtils');

module.exports = {
    name: 'queue',
    category: 'music',
    aliases: ['q'],
    description: 'Show the current queue',
    async execute(client, message, args) {
        const player = client.manager.players.get(message.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Nothing is currently playing.`);

            const reply = await message.reply({ embeds: [embed] });
            setTimeout(() => safeDelete(reply), config.autoDeleteTime);
            setTimeout(() => safeDelete(message), config.autoDeleteTime);
            return;
        }

        let page = parseInt(args[0]) || 1;
        const itemsPerPage = 10;

        const queue = player.queue;
        const current = queue.current;
        const queueTracks = Array.isArray(queue) ? queue : (queue.tracks || []);
        const totalTracks = queueTracks.length;
        const totalPages = Math.ceil(totalTracks / itemsPerPage);

        if (page < 1 || page > totalPages) {
            page = 1;
        }

        const currentUrl = current.uri || `https://www.youtube.com/watch?v=${current.identifier}`;
        const currentTitle = current.title.length > 40 ? current.title.substring(0, 40) + '...' : current.title;
        const currentClickable = currentUrl ? `[${currentTitle}](${currentUrl})` : currentTitle;

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emoji.queue} Queue for ${message.guild.name}`)
            .addFields(
                { 
                    name: 'Now Playing', 
                    value: currentClickable, 
                    inline: false 
                }
            );

        if (totalTracks > 0) {
            const start = (page - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageTracks = queueTracks.slice(start, end);

            const upcoming = pageTracks.map((track, i) => {
                const num = start + i + 1;
                const trackUrl = track.uri || `https://www.youtube.com/watch?v=${track.identifier}`;
                const trackTitle = track.title.length > 40 ? track.title.substring(0, 40) + '...' : track.title;
                const clickableTitle = trackUrl ? `[${trackTitle}](${trackUrl})` : trackTitle;
                return `**${num}.** ${clickableTitle}`;
            }).join('\n');

            embed.addFields({ 
                name: `Up Next (${totalTracks} tracks) - Page ${page}/${totalPages}`, 
                value: upcoming, 
                inline: false 
            });
        } else {
            embed.addFields({ name: 'Up Next', value: 'No tracks in queue', inline: false });
        }

        const components = [];

        if (totalTracks > itemsPerPage) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`queue_prev_${page}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId(`queue_next_${page}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages)
                );
            components.push(row);
        }

        const reply = await message.reply({ 
            embeds: [embed],
            components: components
        });

        setTimeout(() => safeDelete(message), config.autoDeleteTime);

        let timeoutId = setTimeout(() => safeDelete(reply), config.autoDeleteTime);
        let totalTime = config.autoDeleteTime;

        if (components.length > 0) {
            const collector = reply.createMessageComponentCollector({ 
                time: 60000
            });

            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== message.author.id) {
                    await interaction.reply({ 
                        content: `${emoji.error} Only ${message.author.username} can use these buttons!`, 
                        flags: MessageFlags.Ephemeral 
                    });
                    return;
                }

                clearTimeout(timeoutId);
                totalTime += config.autoDeleteTime;

                if (totalTime >= 60000) {
                    collector.stop();
                    await safeDelete(reply);
                    return;
                }

                const [action, direction, currentPage] = interaction.customId.split('_');
                let newPage = parseInt(currentPage);

                if (direction === 'prev') {
                    newPage = Math.max(1, newPage - 1);
                } else if (direction === 'next') {
                    newPage = Math.min(totalPages, newPage + 1);
                }

                const newStart = (newPage - 1) * itemsPerPage;
                const newEnd = newStart + itemsPerPage;
                const newPageTracks = queueTracks.slice(newStart, newEnd);

                const newUpcoming = newPageTracks.map((track, i) => {
                    const num = newStart + i + 1;
                    const trackUrl = track.uri || `https://www.youtube.com/watch?v=${track.identifier}`;
                    const trackTitle = track.title.length > 40 ? track.title.substring(0, 40) + '...' : track.title;
                    const clickableTitle = trackUrl ? `[${trackTitle}](${trackUrl})` : trackTitle;
                    return `**${num}.** ${clickableTitle}`;
                }).join('\n');

                const newEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setTitle(`${emoji.queue} Queue for ${message.guild.name}`)
                    .addFields(
                        { 
                            name: 'Now Playing', 
                            value: currentClickable, 
                            inline: false 
                        },
                        { 
                            name: `Up Next (${totalTracks} tracks) - Page ${newPage}/${totalPages}`, 
                            value: newUpcoming, 
                            inline: false 
                        }
                    )
                    .setFooter({ text: `${getIndianTimestamp()} || ❤️ RasaVedic ❤️` });

                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`queue_prev_${newPage}`)
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === 1),
                        new ButtonBuilder()
                            .setCustomId(`queue_next_${newPage}`)
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === totalPages)
                    );

                await interaction.update({ 
                    embeds: [newEmbed],
                    components: [newRow]
                });

                timeoutId = setTimeout(() => safeDelete(reply), config.autoDeleteTime);
            });

            collector.on('end', () => {
                clearTimeout(timeoutId);
                setTimeout(() => safeDelete(reply), 1000);
            });
        }
    }
};