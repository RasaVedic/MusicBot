const { EmbedBuilder } = require('discord.js');
const { sendSilentAwareMessage } = require('../utils/timeUtils');
const { safeDelete } = require('../utils/messageUtils');
const config = require('../config/config.json');
const emoji = require('../config/emoji.json');

module.exports = {
    name: 'queueEnd',
    async execute(client, player) {
        const channel = client.channels.cache.get(player.textChannel || player.textId);
        const guildId = player.guild || player.guildId;
        const voiceChannelId = player.voiceChannel || player.voiceId;
        
        if (player.preloadTimer) {
            clearTimeout(player.preloadTimer);
            player.preloadTimer = null;
        }

        if (!channel) {
            if (player.destroy) {
                player.destroy();
            }
            return;
        }

        if (player.nowPlayingMessage) {
            await safeDelete(player.nowPlayingMessage);
        }

        // Check if we should leave on queue end
        const shouldLeave = config.music?.leaveOnEnd !== false;
        
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(shouldLeave 
                ? `${emoji.info} Queue ended. Leaving voice channel.`
                : `${emoji.info} Queue ended. Add more songs to continue playing.`
            );

        try {
            const message = await sendSilentAwareMessage(channel, { embeds: [embed] });
            setTimeout(() => safeDelete(message), config.autoDeleteTime);
        } catch (error) {
            console.error('Error sending queue end message:', error);
        }

        // Only destroy player if leaveOnEnd is enabled
        if (shouldLeave) {
            setTimeout(() => {
                if (player.destroy) {
                    player.destroy();
                }
            }, config.music?.leaveOnEndDelay || 3000);
        }
    }
};
