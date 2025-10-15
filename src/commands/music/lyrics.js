const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple, safeDelete } = require('../../utils/messageUtils');
const { getIndianTimestamp } = require('../../utils/timeUtils');
const { searchLyrics, detectLyricsLanguage } = require('../../utils/lyricsUtils');
const logger = require('../../modules/@rasavedic').createModuleLogger('LyricsCommand');

module.exports = {
    name: 'lyrics',
    category: 'music',
    aliases: ['ly', 'lyr'],
    description: 'Display lyrics for current song or search by query',
    async execute(client, message, args) {
        await message.channel.sendTyping();

        const player = client.manager.get(message.guild.id);

        let trackName, artistName, trackDuration;
        let query = args.join(' ');

        if (!query && player && player.queue.current) {
            const currentTrack = player.queue.current;
            trackName = currentTrack.title;
            artistName = currentTrack.author || 'Unknown';
            trackDuration = currentTrack.length || currentTrack.duration;
            query = `${trackName} ${artistName}`;
        } else if (!query) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide a song name or play a song first.`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const searchingEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.loading} **Searching lyrics for:** ${query}`);

        const searchingMsg = await message.reply({ embeds: [searchingEmbed] });

        try {
            // Parse query if no current track
            if (!trackName) {
                const queryParts = query.split(' ');
                trackName = queryParts.slice(0, Math.ceil(queryParts.length / 2)).join(' ');
                artistName = queryParts.slice(Math.ceil(queryParts.length / 2)).join(' ') || 'Unknown';
            }

            // Search lyrics from multiple sources
            const result = await searchLyrics(trackName, artistName, null, trackDuration);

            if (!result || (!result.plainLyrics && !result.instrumental)) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} Could not find lyrics for **${query}**.\n\nTry being more specific or check the spelling.`);

                await searchingMsg.edit({ embeds: [embed] });
                safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
                return;
            }

            // Handle instrumental tracks
            let description = result.instrumental 
                ? '🎵 *This is an instrumental track (no vocals)*' 
                : result.plainLyrics;

            // Add language indicator
            let languageBadge = '';
            if (result.language === 'hindi') {
                languageBadge = '🇮🇳 **Hindi Lyrics**\n\n';
            } else if (result.language === 'hinglish') {
                languageBadge = '🔤 **Hinglish Lyrics** (Romanized Hindi)\n\n';
            } else if (result.language === 'english') {
                languageBadge = '🇺🇸 **English Lyrics**\n\n';
            }

            description = languageBadge + description;

            // Truncate if too long
            const MAX_LENGTH = 4096;
            if (description && description.length > MAX_LENGTH) {
                description = description.slice(0, MAX_LENGTH - 100) + '\n\n... *(lyrics truncated due to length)*';
            }

            // Cache lyrics data
            if (!client.syncedLyricsCache) client.syncedLyricsCache = new Map();
            client.syncedLyricsCache.set(message.guild.id, {
                syncedLyrics: result.syncedLyrics,
                plainLyrics: result.plainLyrics,
                trackName: result.trackName || trackName,
                artistName: result.artistName || artistName,
                startTime: Date.now() - (player?.position || 0),
                source: result.source,
                albumName: result.albumName,
                instrumental: result.instrumental,
                language: result.language || 'english'
            });

            logger.debug(`Cached ${result.language} lyrics for guild: ${message.guild.id}`);

            // Show lyrics type selection buttons
            const { showLyricsTypeSelection } = require('../../utils/lyricsButtons');
            const hasSyncedLyrics = !!(result.syncedLyrics && player && player.queue.current && player.playing);

            await showLyricsTypeSelection(
                searchingMsg, 
                message.guild.id, 
                result.trackName || trackName,
                result.artistName || artistName,
                hasSyncedLyrics,
                result.language
            );

            safeDelete(message, config.autoDeleteTime);

        } catch (error) {
            logger.error('Lyrics command error', error);

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Something went wrong while fetching lyrics.\n\n${error.message}`);

            await searchingMsg.edit({ embeds: [embed] });
            safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
        }
    }
};