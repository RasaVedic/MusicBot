const { safeDelete } = require('../utils/messageUtils');
const { EmbedBuilder } = require('discord.js');
const emoji = require('../config/emoji.json');
const config = require('../config/config.json');
const logger = require('../modules/@rasavedic').createModuleLogger('TrackEnd');

module.exports = {
    name: 'trackEnd',
    async execute(client, player, track) {
        logger.debug(`Track ended: ${track?.title || 'Unknown'}`);

        // Cleanup
        if (player.lyricsUpdateInterval) {
            clearInterval(player.lyricsUpdateInterval);
            player.lyricsUpdateInterval = null;
        }

        if (player.nowPlayingMessage) {
            await safeDelete(player.nowPlayingMessage);
            player.nowPlayingMessage = null;
        }

        if (player.lyricsMessages && player.lyricsMessages.length > 0) {
            for (const msg of player.lyricsMessages) {
                await safeDelete(msg).catch(() => {});
            }
            player.lyricsMessages = [];
        }

        if (client.syncedLyricsCache) {
            client.syncedLyricsCache.delete(player.guildId);
        }

        // Check if manual previous button was clicked - skip auto-play logic
        if (player.data?.manualPrevious) {
            logger.debug('Manual previous detected, skipping auto-play logic');
            // Clear flag after a delay to handle multiple trackEnd events
            setTimeout(() => {
                if (player && player.data) {
                    player.data.manualPrevious = false;
                }
            }, 2000);
            return;
        }

        // Check if manual skip happened
        if (player.data?.manualSkip) {
            logger.debug('Manual skip detected, skipping auto-play logic');
            // Clear flag after a delay to handle multiple trackEnd events
            setTimeout(() => {
                if (player && player.data) {
                    player.data.manualSkip = false;
                }
            }, 2000);
            // Don't do anything - skip() already handled playing next track
            return;
        }

        // Normal track end - check autoplay
        await checkAutoplay(client, player, track);
    }
};

async function checkAutoplay(client, player, previousTrack) {
    // DISABLED: Autoplay is now handled by LavalinkManager's playerEnd event
    // This prevents duplicate autoplay logic that was causing songs to be added too early
    
    logger.debug('trackEnd.js: Autoplay is handled by LavalinkManager, skipping duplicate logic');
    
    // Note: LavalinkManager's playerEnd event already handles:
    // - Playing next track in queue
    // - Triggering autoplay when queue is empty
    // - Queue end notifications
    // So we don't need to do anything here
    return;
}

async function handleAutoplay(client, player, previousTrack) {
    try {
        if (!previousTrack) {
            logger.debug('No previous track for autoplay');
            return;
        }

        logger.debug(`Finding related songs for: ${previousTrack.title} by ${previousTrack.author}`);

        // Get related track
        const relatedTrack = await getRelatedTrack(client, previousTrack);

        if (relatedTrack) {
            // Add to queue
            player.queue.add(relatedTrack);
            logger.debug(`Autoplay added: ${relatedTrack.title} by ${relatedTrack.author}`);

            // Send notification
            await sendAutoplayNotification(client, player, relatedTrack, previousTrack);

            // Play the track
            player.play();
        } else {
            logger.debug('No related track found');
            await sendAutoplayError(client, player);
        }
    } catch (error) {
        logger.error('Autoplay error:', error);
    }
}

async function getRelatedTrack(client, previousTrack) {
    try {
        // Search for more songs by the same artist
        const searchQuery = `"${previousTrack.author}" music`;

        const results = await client.manager.search(
            `ytsearch:${searchQuery}`, 
            previousTrack.requester
        );

        if (results && results.tracks && results.tracks.length > 0) {
            // Find a different track by same artist
            const relatedTracks = results.tracks.filter(track => 
                track.identifier !== previousTrack.identifier && 
                track.author.toLowerCase().includes(previousTrack.author.toLowerCase())
            );

            if (relatedTracks.length > 0) {
                return relatedTracks[0];
            }

            // If no exact match, return any different track
            const differentTrack = results.tracks.find(track => 
                track.identifier !== previousTrack.identifier
            );

            return differentTrack || null;
        }

        return null;
    } catch (error) {
        logger.error('Error finding related track:', error);
        return null;
    }
}

async function sendAutoplayNotification(client, player, newTrack, previousTrack) {
    try {
        const channel = client.channels.cache.get(player.textChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(
                `${emoji.autoplay || '🔁'} **Autoplay**: Added related song\n` +
                `🎵 **${newTrack.title}**\n` +
                `👤 **${newTrack.author}**`
            )
            .setFooter({ text: `Based on: ${previousTrack.author}` });

        const message = await channel.send({ embeds: [embed] });

        // Auto delete after 10 seconds
        setTimeout(() => {
            safeDelete(message).catch(() => {});
        }, 10000);
    } catch (error) {
        logger.debug('Failed to send autoplay message');
    }
}

async function sendAutoplayError(client, player) {
    try {
        const channel = client.channels.cache.get(player.textChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.error} **Autoplay**: No related songs found`);

        const message = await channel.send({ embeds: [embed] });

        setTimeout(() => {
            safeDelete(message).catch(() => {});
        }, 5000);
    } catch (error) {
        logger.debug('Failed to send autoplay error message');
    }
}