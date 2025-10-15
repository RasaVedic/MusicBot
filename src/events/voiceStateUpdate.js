const config = require('../config/config.json');
const logger = require('../modules/@rasavedic').createModuleLogger('VoiceStateUpdate');
const firebaseState = require('../services/FirebaseStateManager');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(client, oldState, newState) {
        // Ignore bot's own state changes
        if (newState.member.user.bot) return;

        // Check if the bot is in a voice channel in this guild
        const player = client.manager?.players?.get(oldState.guild.id);
        if (!player) return;

        // Get the voice channel ID the bot is in
        const botVoiceChannelId = player.voiceChannel || player.voiceId;
        if (!botVoiceChannelId) return;

        // Get the voice channel
        const voiceChannel = oldState.guild.channels.cache.get(botVoiceChannelId);
        if (!voiceChannel) return;

        // Check if someone ACTUALLY LEFT the bot's voice channel (not just muted/unmuted)
        if (oldState.channelId === botVoiceChannelId && newState.channelId !== botVoiceChannelId) {
            // Someone left the channel, check if bot is alone
            const members = voiceChannel.members.filter(m => !m.user.bot);
            
            logger.debug(`User left voice channel. Remaining members: ${members.size}`);
            
            if (members.size === 0 && config.music.leaveOnEmpty) {
                logger.info(`Voice channel is empty, leaving in ${config.music.leaveOnEmptyDelay / 1000} seconds`);
                
                // Set a timeout to leave
                if (player.leaveOnEmptyTimeout) {
                    clearTimeout(player.leaveOnEmptyTimeout);
                }
                
                player.leaveOnEmptyTimeout = setTimeout(async () => {
                    // Double check if still empty
                    const currentChannel = oldState.guild.channels.cache.get(botVoiceChannelId);
                    if (currentChannel) {
                        const currentMembers = currentChannel.members.filter(m => !m.user.bot);
                        if (currentMembers.size === 0) {
                            const { EmbedBuilder } = require('discord.js');
                            const emoji = require('../config/emoji.json');
                            const textChannel = client.channels.cache.get(player.textId || player.textChannel);
                            
                            if (textChannel) {
                                const embed = new EmbedBuilder()
                                    .setColor(config.embedColor)
                                    .setDescription(`${emoji.info} Voice channel is empty. Leaving...`);
                                
                                const msg = await textChannel.send({ embeds: [embed] }).catch(() => null);
                                if (msg) {
                                    setTimeout(() => msg.delete().catch(() => {}), config.autoDeleteTime);
                                }
                            }
                            
                            await firebaseState.saveDisconnectHistory(oldState.guild.id, 'empty_channel_timeout', {
                                voiceChannelId: botVoiceChannelId,
                                voiceChannelName: currentChannel.name,
                                textChannelId: player.textId || player.textChannel,
                                currentTrack: player.queue?.current || player.currentTrack,
                                position: player.position || 0,
                                queueLength: player.queue?.length || player.queue?.size || 0,
                                wasPlaying: player.playing || false,
                                reason: 'Voice channel empty - auto disconnect',
                                timeout: config.music.leaveOnEmptyDelay / 1000 + ' seconds',
                                executedBy: client.user.tag,
                                executedById: client.user.id,
                                systemInitiated: true
                            });
                            
                            logger.info('Leaving voice channel due to inactivity');
                            if (player.destroy) {
                                player.destroy();
                            }
                        } else {
                            logger.debug('Channel not empty anymore, cancelling leave');
                        }
                    }
                }, config.music.leaveOnEmptyDelay);
            }
        }
        
        // Check if someone joined back (cancel the timeout)
        if (newState.channelId === botVoiceChannelId && oldState.channelId !== botVoiceChannelId) {
            const members = voiceChannel.members.filter(m => !m.user.bot);
            if (members.size > 0 && player.leaveOnEmptyTimeout) {
                clearTimeout(player.leaveOnEmptyTimeout);
                player.leaveOnEmptyTimeout = null;
                logger.info('User joined back, cancelling leave timeout');
            }
        }
    }
};
