const { AttachmentBuilder } = require('discord.js');
const { sendSilentAwareMessage } = require('../utils/timeUtils');
const { safeDelete } = require('../utils/messageUtils');
const config = require('../config/config.json');
const path = require('path');

module.exports = {
    name: 'trackStart',
    async execute(client, player, track) {
        const channel = client.channels.cache.get(player.textChannel || player.textId);
        if (!channel) return;

        if (player.nowPlayingMessage) {
            await safeDelete(player.nowPlayingMessage);
        }

        if (player.addedToQueueMessage) {
            await safeDelete(player.addedToQueueMessage);
            player.addedToQueueMessage = null;
        }

        // Prevent duplicate messages with synchronous flag (fixes race condition)
        const trackIdentifier = track?.uri || track?.title;
        
        // Set flag IMMEDIATELY before any await to prevent race conditions
        if (player.sendingNowPlaying) {
            console.log('[trackStart] Already sending now playing message, skipping duplicate');
            return;
        }
        player.sendingNowPlaying = true;
        
        // Check if same track was just sent
        if (player.lastNowPlayingTrack === trackIdentifier && Date.now() - (player.lastNowPlayingTime || 0) < 3000) {
            console.log('[trackStart] Skipping duplicate now playing message for:', track?.title);
            player.sendingNowPlaying = false;
            return;
        }

        // Wait 500ms to verify track actually starts (prevents spam from instant failures)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if player is still playing this track (wasn't immediately skipped)
        if (!player.playing || player.state === 'DESTROYED') {
            console.log('[trackStart] Track failed before message could be sent, skipping');
            player.sendingNowPlaying = false;
            return;
        }

        const embed = client.musicPlayer.createNowPlayingEmbed(track, player, track.requester);
        const buttons = client.musicPlayer.createControlButtons(player);
        
        const footerImage = new AttachmentBuilder(path.join(__dirname, '../assets/footerimg.jpg'), { name: 'footerimg.jpg' });

        try {
            const message = await sendSilentAwareMessage(channel, {
                embeds: [embed],
                components: buttons,
                files: [footerImage]
            });
            
            player.nowPlayingMessage = message;
            player.lastNowPlayingTrack = trackIdentifier;
            player.lastNowPlayingTime = Date.now();
        } catch (error) {
            console.error('Error sending now playing message:', error);
        } finally {
            // Always reset flag
            player.sendingNowPlaying = false;
        }
    }
};
