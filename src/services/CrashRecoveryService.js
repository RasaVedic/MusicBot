const { EmbedBuilder } = require('discord.js');
const firebaseState = require('./FirebaseStateManager');
const logger = require('../modules/@rasavedic').createModuleLogger('CrashRecovery');
const emoji = require('../config/emoji.json');
const config = require('../config/config.json');
const { safeDelete } = require('../utils/messageUtils');

class CrashRecoveryService {
    constructor() {
        this.recoveryAttempts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 2000;
    }

    async attemptRecovery(client, guildId) {
        try {
            logger.info(`Attempting crash recovery for guild ${guildId}`);
            
            const attempts = this.recoveryAttempts.get(guildId) || 0;
            
            if (attempts >= this.maxRetries) {
                logger.error(`Max recovery attempts reached for guild ${guildId}`);
                this.recoveryAttempts.delete(guildId);
                
                try {
                    await firebaseState.saveDisconnectHistory(guildId, 'max_recovery_attempts', {
                        errorMessage: 'Maximum recovery attempts exceeded'
                    });
                } catch (error) {
                    logger.error('Failed to save disconnect history', error);
                }
                
                return false;
            }
            
            this.recoveryAttempts.set(guildId, attempts + 1);
            
            const savedState = await firebaseState.getPlayerState(guildId);
            
            if (!savedState || !savedState.active) {
                logger.debug(`No active state found for guild ${guildId}, skipping recovery`);
                this.recoveryAttempts.delete(guildId);
                return false;
            }
            
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                logger.error(`Guild ${guildId} not found`);
                this.recoveryAttempts.delete(guildId);
                return false;
            }
            
            const voiceChannel = guild.channels.cache.get(savedState.voiceChannelId);
            const textChannel = guild.channels.cache.get(savedState.textChannelId);
            
            if (!voiceChannel || !textChannel) {
                logger.error(`Channels not found for guild ${guildId}`);
                this.recoveryAttempts.delete(guildId);
                
                try {
                    await firebaseState.saveDisconnectHistory(guildId, 'channels_not_found', {
                        voiceChannelId: savedState.voiceChannelId,
                        textChannelId: savedState.textChannelId
                    });
                } catch (error) {
                    logger.error('Failed to save disconnect history', error);
                }
                
                return false;
            }
            
            const membersInVC = voiceChannel.members.filter(m => !m.user.bot).size;
            
            if (membersInVC === 0) {
                logger.info(`No users in voice channel for guild ${guildId}, waiting 30s for users to join`);
                
                const waitEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.success} I have recovered! If you want to continue listening, join the voice channel within **30 seconds**.`)
                    .setTimestamp();
                
                const waitMsg = await textChannel.send({ embeds: [waitEmbed] });
                
                await new Promise(resolve => setTimeout(resolve, 30000));
                
                const currentMembersInVC = voiceChannel.members.filter(m => !m.user.bot).size;
                
                if (currentMembersInVC === 0) {
                    logger.info(`No users joined voice channel for guild ${guildId}, canceling recovery`);
                    
                    const leaveEmbed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.info} No one joined. I'm leaving the voice channel now.`)
                        .setTimestamp();
                    
                    await textChannel.send({ embeds: [leaveEmbed] });
                    
                    try {
                        await firebaseState.deletePlayerState(guildId);
                        await firebaseState.deleteQueue(guildId);
                    } catch (error) {
                        logger.error('Failed to cleanup state', error);
                    }
                    
                    this.recoveryAttempts.delete(guildId);
                    return false;
                }
                
                await safeDelete(waitMsg);
            }
            
            const apologizeEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.info} Reconnecting and restoring your session...`)
                .setTimestamp();
            
            const apologizeMsg = await textChannel.send({ embeds: [apologizeEmbed] });
            setTimeout(() => safeDelete(apologizeMsg), config.autoDeleteTime);
            
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            
            let player = client.manager.get(guildId);
            
            if (player && player.state === 'DESTROYED') {
                player = null;
            }
            
            if (!player) {
                try {
                    // Clean up any old now playing messages from Firebase before creating new player
                    const oldMessages = await firebaseState.getAllMessagesForGuild(guildId);
                    for (const msgData of oldMessages) {
                        try {
                            const channel = client.channels.cache.get(msgData.channelId);
                            if (channel) {
                                const msg = await channel.messages.fetch(msgData.messageId).catch(() => null);
                                if (msg) await safeDelete(msg);
                            }
                        } catch (err) {
                            // Message might already be deleted
                        }
                    }
                    await firebaseState.deleteAllMessagesForGuild(guildId);
                    
                    player = await client.manager.create({
                        guild: guildId,
                        voiceChannel: voiceChannel.id,
                        textChannel: textChannel.id,
                        selfDeafen: true,
                    });
                    
                    logger.info(`Created new player for guild ${guildId}`);
                } catch (createError) {
                    logger.error(`Failed to create player for guild ${guildId}`, createError);
                    
                    try {
                        await firebaseState.saveDisconnectHistory(guildId, 'player_creation_failed', {
                            errorMessage: createError.message,
                            voiceChannelId: voiceChannel.id,
                            textChannelId: textChannel.id
                        });
                    } catch (error) {
                        logger.error('Failed to save disconnect history', error);
                    }
                    
                    return false;
                }
            }
            
            if (savedState.volume) {
                player.setVolume(savedState.volume);
            }
            
            player.data = player.data || {};
            if (savedState.autoplay !== undefined) {
                player.data.autoplay = savedState.autoplay;
            }
            if (savedState.loop) {
                player.data.loop = savedState.loop;
            }
            if (savedState.equalizer) {
                player.data.equalizer = savedState.equalizer;
                const EQ_PRESETS = {
                    flat: Array(15).fill(0.0),
                    bass: [0.6, 0.5, 0.4, 0.3, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                    boost: Array(15).fill(0.2),
                    metal: [0.0, 0.1, 0.15, 0.13, 0.1, 0.05, 0.07, 0.09, 0.11, 0.125, 0.125, 0.1, 0.075, 0.0, 0.0],
                    piano: [-0.25, -0.25, 0.0, 0.25, 0.25, 0.0, -0.25, -0.25, 0.0, 0.0, 0.0, 0.25, 0.25, -0.025, -0.025],
                    pop: [-0.02, -0.01, 0.08, 0.1, 0.15, 0.1, 0.03, -0.02, -0.035, -0.05, -0.05, -0.05, -0.05, -0.05, -0.05],
                    soft: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05, -0.1, -0.125, -0.15, -0.175, -0.175, -0.175, -0.175],
                    treblebass: [0.6, 0.5, 0.4, 0.3, 0.2, -0.25, 0.0, 0.0, 0.125, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4],
                    nightcore: [0.3, 0.3, 0.0, 0.0, -0.1, -0.1, -0.15, -0.2, 0.0, 0.0, 0.0, 0.0, 0.3, 0.35, 0.35],
                    vaporwave: [0.3, 0.3, 0.0, 0.0, 0.0, -0.1, -0.15, -0.15, 0.0, 0.0, 0.25, 0.3, 0.4, 0.4, 0.4]
                };
                if (EQ_PRESETS[savedState.equalizer]) {
                    try {
                        const bands = EQ_PRESETS[savedState.equalizer].map((gain, index) => ({ band: index, gain }));
                        await player.shoukaku.setEqualizer(bands);
                        logger.info(`Restored equalizer preset '${savedState.equalizer}' for guild ${guildId}`);
                    } catch (eqError) {
                        logger.error(`Failed to restore equalizer for guild ${guildId}`, eqError);
                    }
                }
            }
            
            const savedQueue = await firebaseState.getQueue(guildId);
            
            if (savedQueue && savedQueue.length > 0) {
                logger.debug(`Re-resolving ${savedQueue.length} tracks for queue restoration...`);
                
                for (const savedTrack of savedQueue) {
                    try {
                        const searchResult = await client.manager.search(
                            savedTrack.uri || savedTrack.title, 
                            savedTrack.requester || { id: 'system', username: 'System', tag: 'System' }
                        );
                        
                        if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
                            const resolvedTrack = searchResult.tracks[0];
                            player.queue.add(resolvedTrack);
                        } else {
                            logger.warn(`Could not resolve track: ${savedTrack.title}`);
                        }
                    } catch (trackError) {
                        logger.error(`Failed to resolve track ${savedTrack.title}`, trackError);
                    }
                }
                
                logger.info(`Restored ${player.queue.length} tracks to queue for guild ${guildId}`);
            }
            
            if (savedState.currentTrack) {
                const { currentTrack, position } = savedState;
                
                const searchResult = await client.manager.search(currentTrack.uri || currentTrack.title, {
                    id: currentTrack.requester?.id || 'system',
                    username: currentTrack.requester?.username || 'System',
                    tag: currentTrack.requester?.tag || 'System'
                });
                
                if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
                    const track = searchResult.tracks[0];
                    
                    // Use forceplay to resume the track immediately (proper Kazagumo API)
                    if (!player.playing && !player.paused) {
                        await player.play(track);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    if (position && position > 1000) {
                        try {
                            if (typeof player.seek === 'function') {
                                await player.seek(position);
                                logger.info(`Resumed playback at ${position}ms for guild ${guildId}`);
                            } else if (typeof player.setPosition === 'function') {
                                await player.setPosition(position);
                                logger.info(`Resumed playback at ${position}ms for guild ${guildId}`);
                            } else {
                                logger.warn(`Seek not supported for guild ${guildId}, playing from start`);
                            }
                        } catch (seekError) {
                            logger.error(`Failed to seek to position for guild ${guildId}`, seekError);
                        }
                    }
                    
                    if (savedState.paused) {
                        player.pause(true);
                    }
                    
                    const { createClickableTitle } = require('../utils/trackUtils');
                    const clickableTitle = createClickableTitle(currentTrack, 50);
                    
                    const recoveryEmbed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.success} Successfully reconnected and resumed playback!\n**Now Playing:** ${clickableTitle}`)
                        .setTimestamp();
                    
                    const recoveryMsg = await textChannel.send({ embeds: [recoveryEmbed] });
                    setTimeout(() => safeDelete(recoveryMsg), config.autoDeleteTime);
                    
                    try {
                        await firebaseState.saveDisconnectHistory(guildId, 'recovery_successful', {
                            voiceChannelId: voiceChannel.id,
                            textChannelId: textChannel.id,
                            currentTrack: currentTrack,
                            position: position,
                            queueLength: savedQueue.length
                        });
                    } catch (error) {
                        logger.error('Failed to save recovery history', error);
                    }
                    
                    this.recoveryAttempts.delete(guildId);
                    
                    logger.info(`Successfully recovered playback for guild ${guildId}`);
                    return true;
                } else {
                    logger.error(`Failed to find track for recovery in guild ${guildId}`);
                    
                    try {
                        await firebaseState.saveDisconnectHistory(guildId, 'track_not_found', {
                            currentTrack: currentTrack
                        });
                    } catch (error) {
                        logger.error('Failed to save disconnect history', error);
                    }
                }
            }
            
            this.recoveryAttempts.delete(guildId);
            return false;
            
        } catch (error) {
            logger.error(`Crash recovery failed for guild ${guildId}`, error);
            
            try {
                await firebaseState.saveDisconnectHistory(guildId, 'recovery_error', {
                    errorMessage: error.message
                });
            } catch (saveError) {
                logger.error('Failed to save disconnect history', saveError);
            }
            
            const attempts = this.recoveryAttempts.get(guildId) || 0;
            if (attempts < this.maxRetries) {
                setTimeout(() => {
                    this.attemptRecovery(client, guildId);
                }, this.retryDelay * (attempts + 1));
            } else {
                this.recoveryAttempts.delete(guildId);
            }
            
            return false;
        }
    }

    async recoverAllActiveStates(client) {
        try {
            logger.info('Checking for active states to recover...');
            
            const activeStates = await firebaseState.getAllActivePlayerStates();
            
            if (activeStates.length === 0) {
                logger.info('No active states found to recover');
                return;
            }
            
            logger.info(`Found ${activeStates.length} active states to recover`);
            
            for (const state of activeStates) {
                const guild = client.guilds.cache.get(state.guildId);
                if (!guild) {
                    logger.debug(`Guild ${state.guildId} not found, marking state as inactive`);
                    try {
                        await firebaseState.deletePlayerState(state.guildId);
                    } catch (error) {
                        logger.error('Failed to delete player state', error);
                    }
                    continue;
                }
                
                const player = client.manager.get(state.guildId);
                if (player && player.playing) {
                    logger.debug(`Player already active for guild ${state.guildId}, skipping recovery`);
                    continue;
                }
                
                logger.info(`Initiating recovery for guild ${state.guildId}`);
                await this.attemptRecovery(client, state.guildId);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            logger.info('Recovery process completed');
        } catch (error) {
            logger.error('Failed to recover active states', error);
        }
    }
}

module.exports = new CrashRecoveryService();
