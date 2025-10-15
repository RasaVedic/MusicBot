const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple, safeDelete } = require('../../utils/messageUtils');
const { getIndianTimestamp } = require('../../utils/timeUtils');

module.exports = {
    name: 'skip',
    category: 'music',
    aliases: ['s', 'next'],
    description: 'Skip the current song',
    async execute(client, message, args) {
        const player = client.manager.players.get(message.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Nothing is currently playing.`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const voiceChannelId = player.voiceChannel || player.voiceId;
        if (!message.member.voice.channel || message.member.voice.channel.id !== voiceChannelId) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in the same voice channel as me.`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        // Save current track as previous track before skipping
        if (player.queue?.current) {
            player.previousTrack = player.queue.current;
            try {
                const firebaseState = require('../../services/FirebaseStateManager');
                await firebaseState.savePreviousTrack(message.guild.id, player.queue.current);
            } catch (error) {
                console.error('Failed to save previous track:', error);
            }
        }

        // Cleanup timers and messages
        if (player.preloadTimer) {
            clearTimeout(player.preloadTimer);
            player.preloadTimer = null;
        }

        if (player.nowPlayingMessage) {
            await safeDelete(player.nowPlayingMessage);
            player.nowPlayingMessage = null;
        }

        // Initialize player data
        player.data = player.data || {};

        // Set manualSkip flag to prevent trackEnd loop
        player.data.manualSkip = true;

        // Check autoplay status and queue state before skipping
        const wasAutoplayEnabled = player.data.autoplay;
        const queueWasEmpty = player.queue.size === 0;

        try {
            // Perform the skip
            player.skip();

            let description = `${emoji.skip} Skipped to the next track.`;

            // If autoplay was enabled and queue was empty, show autoplay message
            if (wasAutoplayEnabled && queueWasEmpty) {
                description += `\n${emoji.autoplay || '🔁'} **Autoplay**: Finding related song...`;
            }

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(description);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([message, reply], config.autoDeleteTime);

        } catch (error) {
            console.error('Skip error:', error);

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to skip track: ${error.message}`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};