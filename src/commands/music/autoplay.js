const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple, safeDelete } = require('../../utils/messageUtils');
const { getIndianTimestamp } = require('../../utils/timeUtils');
const firebaseState = require('../../services/FirebaseStateManager');

module.exports = {
    name: 'autoplay',
    category: 'music',
    aliases: ['ap'],
    description: 'Toggle autoplay - automatically plays artist-related songs',
    async execute(client, message, args) {
        const player = client.manager.get(message.guild.id);

        if (!player) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} No music is currently playing.`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!message.member.voice.channel) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in a voice channel.`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (message.member.voice.channel.id !== player.voiceId) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in the same voice channel as me.`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        // Initialize player data properly
        player.data = player.data || {};
        player.data.autoplay = player.data.autoplay || false;

        // Toggle autoplay
        player.data.autoplay = !player.data.autoplay;

        try {
            // Save to Firebase with error handling
            await firebaseState.savePlayerState(message.guild.id, player);
        } catch (error) {
            console.error('Failed to save autoplay state:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to save autoplay state.`);

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        // Clean up previous status message properly
        if (player.autoplayStatusMessage) {
            try {
                await safeDelete(player.autoplayStatusMessage);
            } catch (error) {
                console.error('Error deleting autoplay status message:', error);
            }
            player.autoplayStatusMessage = null;
        }

        const status = player.data.autoplay ? 'Enabled' : 'Disabled';
        const statusEmoji = player.data.autoplay ? emoji.success : emoji.error;

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${statusEmoji} **Autoplay is now \`${status}\`**\n${emoji.heart} *Set by ${message.author.username}*`);

        const reply = await message.reply({ embeds: [embed] });

        // Set status message only when autoplay is enabled
        if (player.data.autoplay) {
            player.autoplayStatusMessage = reply;
        }

        // Delete both messages after delay
        safeDeleteMultiple([message, reply], config.autoDeleteTime);

        // Update control buttons
        if (player.nowPlayingMessage) {
            try {
                const updatedButtons = client.musicPlayer.createControlButtons(player);
                await player.nowPlayingMessage.edit({ components: updatedButtons });
            } catch (error) {
                console.error('Error updating now playing buttons:', error);
            }
        }
    }
};