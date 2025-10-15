const { Kazagumo, KazagumoPlayer, Plugins } = require('kazagumo');
const { Connectors } = require('shoukaku');
const Spotify = require('kazagumo-spotify');
const { safeDelete } = require('../utils/messageUtils');
const { sendSilentAwareMessage } = require('../utils/timeUtils');
const logger = require('./@rasavedic').createModuleLogger('LavalinkManager');
const firebaseState = require('../services/FirebaseStateManager');
const debugLogger = require('../utils/debugLogger');

class LavalinkManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        
        const nodes = config.lavalink.nodes.map(node => ({
            name: node.name,
            url: node.url,
            auth: node.auth,
            secure: node.secure
        }));

        this.kazagumo = new Kazagumo(
            {
                defaultSearchEngine: 'youtube',
                plugins: [
                    new Plugins.PlayerMoved(client),
                    new Spotify({
                        clientId: process.env.SPOTIFY_CLIENT_ID || '',
                        clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
                        playlistPageLimit: 100,
                        albumPageLimit: 100,
                        searchLimit: 10,
                        searchMarket: 'US'
                    })
                ],
                send: (guildId, payload) => {
                    const guild = client.guilds.cache.get(guildId);
                    if (guild) guild.shard.send(payload);
                }
            },
            new Connectors.DiscordJS(client),
            nodes,
            {
                moveOnDisconnect: false,
                resumable: true,
                resumableTimeout: 60,
                reconnectTries: 10,
                restTimeout: 60000,
                // Audio quality and buffering optimizations
                nodeResolver: (nodes) => {
                    // Convert Map to array if needed
                    const nodeArray = Array.isArray(nodes) ? nodes : Array.from(nodes.values());
                    
                    // Prefer nodes with lower ping and fewer players for better performance
                    const availableNodes = nodeArray.filter(node => node.state === 2); // 2 = CONNECTED
                    if (availableNodes.length === 0) return nodeArray[0];
                    
                    // Sort by stats: prefer nodes with lower CPU usage and fewer players
                    return availableNodes.sort((a, b) => {
                        const aLoad = (a.stats?.players || 0) + (a.stats?.cpu?.systemLoad || 0);
                        const bLoad = (b.stats?.players || 0) + (b.stats?.cpu?.systemLoad || 0);
                        return aLoad - bLoad;
                    })[0];
                }
            }
        );

        this.setupEvents();
        logger.info('Using Lavalink with Kazagumo + Spotify Plugin');
    }

    setupEvents() {
        this.kazagumo.shoukaku.on('ready', (name) => {
            logger.info(`✅ Lavalink node ${name} is ready and connected!`);
        });

        this.kazagumo.shoukaku.on('error', (name, error) => {
            const errorCode = error.code || error.statusCode || 'UNKNOWN';
            const is502or503 = error.message?.includes('502') || error.message?.includes('503');
            
            if (is502or503) {
                logger.error(`❌ Lavalink node ${name} - Server Error (${errorCode})`, {
                    errorMessage: error.message,
                    errorType: 'BAD_GATEWAY',
                    recommendation: 'Switching to alternate node if available',
                    timestamp: new Date().toISOString()
                });
                
                const availableNodes = Array.from(this.kazagumo.shoukaku.nodes.values())
                    .filter(node => node.state === 2);
                
                if (availableNodes.length > 1) {
                    logger.info(`🔄 Found ${availableNodes.length - 1} alternate node(s) available`);
                }
            } else {
                logger.error(`Lavalink node ${name} error: ${error.message}`, {
                    errorCode,
                    errorName: error.name,
                    stack: error.stack
                });
            }
        });

        this.kazagumo.shoukaku.on('close', (name, code, reason) => {
            const closeReasons = {
                1000: 'Normal Closure',
                1001: 'Going Away',
                1006: 'Abnormal Closure (No close frame)',
                1011: 'Server Error',
                1012: 'Service Restart',
                1013: 'Try Again Later',
                1014: 'Bad Gateway'
            };
            
            const closeReason = closeReasons[code] || 'Unknown';
            logger.warn(`⚠️ Lavalink node ${name} closed`, {
                code,
                reason: reason || closeReason,
                description: closeReason,
                timestamp: new Date().toISOString()
            });
            
            if (code === 1006 || code === 1011 || code === 1014) {
                logger.warn(`🔍 Connection issue detected - Code ${code} indicates server/network problem`);
            }
        });

        this.kazagumo.shoukaku.on('disconnect', async (name, count) => {
            logger.warn(`🔌 Lavalink node ${name} disconnected`, {
                retryCount: count,
                maxRetries: 10,
                timestamp: new Date().toISOString()
            });
            
            const players = Array.from(this.kazagumo.players.values());
            logger.info(`📊 Affected players: ${players.length}`);
            
            for (const player of players) {
                try {
                    await firebaseState.saveDisconnectHistory(player.guildId, 'lavalink_disconnect', {
                        voiceChannelId: player.voiceId,
                        textChannelId: player.textId,
                        currentTrack: player.queue?.current,
                        position: player.position || 0,
                        queueLength: player.queue?.length || 0,
                        wasPlaying: player.playing || false,
                        errorMessage: `Lavalink node ${name} disconnected (retry ${count}/10)`,
                        nodeName: name,
                        timestamp: Date.now()
                    });
                } catch (error) {
                    logger.error('Failed to save disconnect history', error);
                }
            }
        });

        this.kazagumo.on('playerStart', (player, track) => {
            // DO NOT reset flags here - they're checked in playerEnd which fires BEFORE playerStart
            // Flags will be reset in playerEnd after being checked
            
            debugLogger.logMusicEvent('trackStart', player, track, {
                wasManualSkip: player.data?.wasManualSkip || false,
                autoplayEnabled: player.data?.autoplay || false
            });
            
            this.handleTrackStart(player, track);
            this.setupPeriodicStateSave(player);
        });

        this.kazagumo.on('playerEnd', async (player, track) => {
            // ANTI-SPAM GUARD: Prevent infinite loop when tracks fail immediately
            const trackPosition = player.position || 0;
            const isManualSkip = player.data?.manualSkip;
            
            // If track ended at position 0 and it wasn't a manual skip, it's a Lavalink error
            if (trackPosition < 1000 && !isManualSkip) {
                logger.warn('Track ended immediately (position < 1s), likely Lavalink error - preventing spam loop', {
                    track: track?.title,
                    position: trackPosition
                });
                
                // Mark track as failed and skip to prevent infinite loop
                if (!player.failedTrackCount) {
                    player.failedTrackCount = 0;
                }
                player.failedTrackCount++;
                
                // If too many tracks fail in a row, stop the bot
                if (player.failedTrackCount > 3) {
                    logger.error('Too many tracks failed in a row, stopping player to prevent spam');
                    const channel = this.client.channels.cache.get(player.textId);
                    if (channel) {
                        const { EmbedBuilder } = require('discord.js');
                        const emoji = require('../config/emoji.json');
                        const embed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setDescription(`${emoji.error} **Playback Error:** Too many tracks failed to play. The music server may be having issues. Please try again later.`);
                        await sendSilentAwareMessage(channel, { embeds: [embed] });
                    }
                    this.handleQueueEnd(player);
                    return;
                }
                
                // Skip this track and try the next one
                if (player.queue.length > 0) {
                    const failedTrack = player.queue[0];
                    player.queue.remove(0);
                    logger.warn('Removed failed track from queue:', { title: failedTrack?.title });
                    
                    if (player.queue.length > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        try {
                            await player.play();
                        } catch (err) {
                            logger.error('Failed to play next track after skip', err);
                        }
                    } else if (player.data?.autoplay && !player.data?.suppressAutoplay) {
                        await this.handleAutoplay(player, track);
                    } else {
                        this.handleQueueEnd(player);
                    }
                }
                return;
            }
            
            // Reset failed track counter on successful playback
            if (trackPosition >= 1000) {
                player.failedTrackCount = 0;
            }
            
            logger.debug('Player ended', { 
                track: track?.title,
                position: trackPosition,
                queueLength: player.queue.length,
                queueSize: player.queue.size,
                autoplay: player.data?.autoplay,
                manualSkip: player.data?.manualSkip,
                suppressAutoplay: player.data?.suppressAutoplay
            });
            
            debugLogger.logMusicEvent('trackEnd', player, track, {
                reason: 'track_ended',
                nextInQueue: (player.queue.length > 0) || (player.queue.size > 0),
                manualSkip: player.data?.manualSkip || false,
                suppressAutoplay: player.data?.suppressAutoplay || false
            });

            // Small delay to ensure queue is properly updated before checking
            await new Promise(resolve => setTimeout(resolve, 150));

            const hasMoreTracks = (player.queue.length > 0) || (player.queue.size > 0);
            
            if (hasMoreTracks) {
                logger.debug('Playing next track in queue');
                try {
                    await player.play();
                    logger.debug('Successfully triggered next track playback');
                    
                    // Reset flags after successfully starting next track
                    if (player.data?.manualSkip) {
                        player.data.manualSkip = false;
                    }
                    if (player.data?.suppressAutoplay) {
                        player.data.suppressAutoplay = false;
                    }
                } catch (error) {
                    logger.error('Error playing next track in queue, skipping to next', error);
                    
                    // Immediately skip problematic track (no retries to prevent slowness)
                    if (player.queue.length > 0) {
                        const skippedTrack = player.queue[0];
                        player.queue.remove(0);
                        logger.warn('Skipped problematic track:', { title: skippedTrack?.title });
                        
                        // Try next track
                        if (player.queue.length > 0) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            try {
                                await player.play();
                            } catch (retryErr) {
                                logger.error('Next track also failed, falling back', retryErr);
                                if (player.data?.autoplay && !player.data?.suppressAutoplay) {
                                    await this.handleAutoplay(player, track);
                                } else {
                                    this.handleQueueEnd(player);
                                }
                            }
                        } else if (player.data?.autoplay && !player.data?.suppressAutoplay) {
                            await this.handleAutoplay(player, track);
                        } else {
                            this.handleQueueEnd(player);
                        }
                    }
                }
            } else if (player.data?.autoplay && !player.data?.suppressAutoplay) {
                // Autoplay enabled - find related track (works even with manual skip)
                logger.debug('Queue empty, autoplay enabled - fetching related track', {
                    wasManualSkip: player.data?.manualSkip || false
                });
                debugLogger.logMusicEvent('autoplayTriggered', player, track, {
                    reason: 'queue_empty',
                    wasManualSkip: player.data?.manualSkip || false
                });
                
                await this.handleAutoplay(player, track);
                
                // Reset flags after autoplay completes
                if (player.data?.manualSkip) {
                    player.data.manualSkip = false;
                }
                if (player.data?.suppressAutoplay) {
                    player.data.suppressAutoplay = false;
                }
            } else {
                // Autoplay NOT triggered due to: suppressAutoplay, manualSkip, or disabled
                const reason = player.data?.suppressAutoplay ? 'suppress_autoplay' 
                    : player.data?.manualSkip ? 'manual_skip'
                    : 'autoplay_disabled';
                    
                logger.debug(`Queue empty - not triggering autoplay (reason: ${reason})`);
                debugLogger.logMusicEvent('autoplayBlocked', player, track, {
                    reason,
                    suppressAutoplayFlag: player.data?.suppressAutoplay || false,
                    manualSkipFlag: player.data?.manualSkip || false,
                    autoplayEnabled: player.data?.autoplay || false
                });
                
                // Reset flags
                if (player.data?.manualSkip) {
                    player.data.manualSkip = false;
                }
                if (player.data?.suppressAutoplay) {
                    player.data.suppressAutoplay = false;
                }
                
                player.data = player.data || {};
                player.data.queueEndHandled = true;
                this.handleQueueEnd(player);
            }
        });

        this.kazagumo.on('playerEmpty', async (player) => {
            logger.debug('Player empty event triggered', { 
                autoplay: player.data?.autoplay,
                suppressAutoplay: player.data?.suppressAutoplay,
                queueEndHandled: player.data?.queueEndHandled,
                queueLength: player.queue?.length || 0
            });
            
            if (player.data?.autoplay && !player.data?.suppressAutoplay) {
                logger.debug('Autoplay is enabled and not suppressed, skipping playerEmpty handler');
                return;
            }
            
            if (player.data?.queueEndHandled) {
                logger.debug('Queue end already handled, skipping duplicate');
                return;
            }
            
            this.handleQueueEnd(player);
        });

        // Save state on pause/resume (non-critical)
        this.kazagumo.on('playerPause', async (player) => {
            try {
                await firebaseState.savePlayerState(player.guildId, {
                    voiceChannelId: player.voiceId,
                    textChannelId: player.textId,
                    volume: player.volume,
                    paused: true,
                    data: player.data,
                    currentTrack: player.queue.current,
                    position: player.position || 0
                });
            } catch (error) {
                logger.error('Failed to save pause state', error);
            }
        });

        this.kazagumo.on('playerResume', async (player) => {
            try {
                await firebaseState.savePlayerState(player.guildId, {
                    voiceChannelId: player.voiceId,
                    textChannelId: player.textId,
                    volume: player.volume,
                    paused: false,
                    data: player.data,
                    currentTrack: player.queue.current,
                    position: player.position || 0
                });
            } catch (error) {
                logger.error('Failed to save resume state', error);
            }
        });

        this.kazagumo.on('playerCreate', async (player) => {
            logger.debug(`Player created for guild ${player.guildId}`);
        });

        // Cleanup intervals on player destroy
        this.kazagumo.on('playerDestroy', async (player) => {
            logger.debug(`Player destroyed for guild ${player.guildId}, cleaning up intervals`);
            
            if (player.stateSaveInterval) {
                clearInterval(player.stateSaveInterval);
                player.stateSaveInterval = null;
            }
            
            if (player.preloadTimer) {
                clearTimeout(player.preloadTimer);
                player.preloadTimer = null;
            }
            
            if (player.queueEndWarningTimer) {
                clearTimeout(player.queueEndWarningTimer);
                player.queueEndWarningTimer = null;
            }
            
            try {
                await firebaseState.saveDisconnectHistory(player.guildId, 'player_destroyed', {
                    voiceChannelId: player.voiceId,
                    textChannelId: player.textId,
                    currentTrack: player.queue?.current,
                    position: player.position || 0,
                    queueLength: player.queue?.length || 0,
                    wasPlaying: player.playing || false
                });
            } catch (error) {
                logger.error('Failed to save disconnect history', error);
            }
            
            try {
                await firebaseState.deletePlayerState(player.guildId);
                await firebaseState.deleteQueue(player.guildId);
                await firebaseState.deleteAllMessagesForGuild(player.guildId);
            } catch (error) {
                logger.error('Failed to cleanup player state', error);
            }
        });
    }

    async handleTrackStart(player, track) {
        const channel = this.client.channels.cache.get(player.textId);
        if (!channel) return;

        player.data = player.data || {};
        
        if (player.data.lastTrack) {
            player.previousTrack = player.data.lastTrack;
            await firebaseState.savePreviousTrack(player.guildId, player.data.lastTrack);
        }
        player.data.lastTrack = track;

        if (player.nowPlayingMessage) {
            await safeDelete(player.nowPlayingMessage);
            player.nowPlayingMessage = null;
        }

        // Clean up lyrics update interval
        if (player.lyricsUpdateInterval) {
            clearInterval(player.lyricsUpdateInterval);
            player.lyricsUpdateInterval = null;
        }

        // Clean up lyrics messages from previous track
        if (player.lyricsMessages && player.lyricsMessages.length > 0) {
            for (const msg of player.lyricsMessages) {
                await safeDelete(msg);
            }
            player.lyricsMessages = [];
        }

        // Clear synced lyrics cache for this guild
        if (this.client.syncedLyricsCache) {
            this.client.syncedLyricsCache.delete(player.guildId);
        }

        // Small delay to verify track actually starts (prevents spam from instant failures)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if player is still playing this track (wasn't immediately skipped due to error)
        if (!player.playing || player.state === 'DESTROYED') {
            logger.debug('Track failed before message could be sent, skipping message');
            return;
        }

        const { AttachmentBuilder } = require('discord.js');
        const path = require('path');
        const footerImage = new AttachmentBuilder(path.join(__dirname, '../assets/footerimg.jpg'), { name: 'footerimg.jpg' });

        const message = await sendSilentAwareMessage(channel, {
            embeds: [this.client.musicPlayer.createNowPlayingEmbed(track, player, track.requester)],
            components: this.client.musicPlayer.createControlButtons(player),
            files: [footerImage]
        });

        player.nowPlayingMessage = message;

        // Save player state to Firebase (non-critical, don't let it crash the player)
        try {
            await firebaseState.savePlayerState(player.guildId, {
                voiceChannelId: player.voiceId,
                textChannelId: player.textId,
                volume: player.volume,
                paused: player.paused,
                data: player.data,
                currentTrack: track,
                position: player.position || 0
            });

            // Save current queue to Firebase
            if (player.queue && player.queue.length > 0) {
                await firebaseState.saveQueue(player.guildId, player.queue);
            }
        } catch (error) {
            logger.error('Failed to save player state, continuing playback', error);
        }

        // Save now playing message ID with user info (non-critical)
        try {
            const userId = track.requester?.id || 'system';
            await firebaseState.saveMessageWithUser(player.guildId, 'nowPlaying', message, userId);
        } catch (error) {
            logger.error('Failed to save message info', error);
        }

        // Save user activity (non-critical)
        try {
            if (track.requester && track.requester.id) {
                await firebaseState.saveUserActivity(track.requester.id, player.guildId, {
                    trackTitle: track.title,
                    trackUri: track.uri,
                    totalTracksPlayed: 1
                });
            }
        } catch (error) {
            logger.error('Failed to save user activity', error);
        }
    }


    setupPeriodicStateSave(player) {
        // Clear existing interval if any
        if (player.stateSaveInterval) {
            clearInterval(player.stateSaveInterval);
        }

        // Save player state every 10 seconds during playback
        player.stateSaveInterval = setInterval(async () => {
            if (player && player.playing && player.state !== 'DESTROYED') {
                try {
                    await firebaseState.savePlayerState(player.guildId, {
                        voiceChannelId: player.voiceId,
                        textChannelId: player.textId,
                        volume: player.volume,
                        paused: player.paused,
                        data: player.data,
                        currentTrack: player.queue.current,
                        position: player.position || 0
                    });

                    // Also save queue if it changed
                    if (player.queue && player.queue.length > 0) {
                        await firebaseState.saveQueue(player.guildId, player.queue);
                    }

                    logger.debug(`Periodic state saved for guild ${player.guildId}`);
                } catch (error) {
                    logger.error('Failed to save periodic state', error);
                }
            }
        }, 10000); // Save every 10 seconds
    }


    async handleAutoplay(player, lastTrack) {
        try {
            // If lastTrack is not provided, try to get it from player data
            if (!lastTrack) {
                lastTrack = player.queue?.current || player.data?.lastTrack;
            }
            
            // If still no track, we cannot do autoplay
            if (!lastTrack || !lastTrack.title) {
                logger.warn('Autoplay: No track information available, ending queue');
                this.handleQueueEnd(player);
                return;
            }
            
            logger.info('Autoplay triggered for:', { title: lastTrack.title });

            const artist = lastTrack.author || lastTrack.title.split('-')[0]?.trim() || lastTrack.title.split('|')[0]?.trim();
            
            const searchQueries = [
                `${artist} songs`,
                `${artist} official`,
                `${artist} music`,
                `${artist} #${artist.toLowerCase().replace(/\s+/g, '')}`
            ];

            let result = null;
            for (const query of searchQueries) {
                result = await this.kazagumo.search(query, { 
                    requester: { username: 'Autoplay', id: 'autoplay' }
                });
                
                if (result && result.tracks.length > 0) {
                    break;
                }
            }

            if (result && result.tracks.length > 0) {
                const filteredTracks = result.tracks.filter(t => t.uri !== lastTrack.uri);
                if (filteredTracks.length > 0) {
                    const randomIndex = Math.floor(Math.random() * Math.min(5, filteredTracks.length));
                    const relatedTrack = filteredTracks[randomIndex];

                    player.queue.add(relatedTrack);
                    logger.info('Autoplay added:', { title: relatedTrack.title });
                    
                    if (!player.playing) {
                        player.play();
                    }
                    
                    const channel = this.client.channels.cache.get(player.textId);
                    if (channel) {
                        const { EmbedBuilder } = require('discord.js');
                        const emoji = require('../config/emoji.json');
                        const { createClickableTitle } = require('../utils/trackUtils');
                        
                        // Delete old autoplay message if it exists
                        if (player.autoplayStatusMessage) {
                            safeDelete(player.autoplayStatusMessage).catch(() => {});
                            player.autoplayStatusMessage = null;
                        }
                        
                        const clickableTitle = createClickableTitle(relatedTrack, 50);
                        const embed = new EmbedBuilder()
                            .setColor(this.config.embedColor)
                            .setDescription(`${emoji.autoplay} **Autoplay:** Added ${clickableTitle}`);
                        
                        sendSilentAwareMessage(channel, { embeds: [embed] }).then(msg => {
                            player.autoplayStatusMessage = msg;
                        });
                    }
                    return;
                }
            }

            logger.info('Autoplay: No suitable tracks found, ending queue');
            this.handleQueueEnd(player);
        } catch (error) {
            logger.error('Autoplay error', error);
            this.handleQueueEnd(player);
        }
    }

    handleQueueEnd(player) {
        if (!player || player.state === 'DESTROYED') {
            logger.debug('Player already destroyed, skipping queue end handling');
            return;
        }

        // Prevent duplicate execution
        if (player.data?.queueEndInProgress) {
            logger.debug('Queue end already in progress, skipping duplicate');
            return;
        }
        player.data = player.data || {};
        player.data.queueEndInProgress = true;
        
        // Set flag to suppress autoplay during queue end (instead of disabling it globally)
        player.data.suppressAutoplay = true;
        
        const channel = this.client.channels.cache.get(player.textId);
        
        if (player.preloadTimer) {
            clearTimeout(player.preloadTimer);
            player.preloadTimer = null;
        }
        
        if (player.queueEndWarningTimer) {
            clearTimeout(player.queueEndWarningTimer);
            player.queueEndWarningTimer = null;
        }

        if (player.lyricsUpdateInterval) {
            clearInterval(player.lyricsUpdateInterval);
            player.lyricsUpdateInterval = null;
        }

        if (!channel) {
            try {
                if (player.state !== 'DESTROYED') {
                    player.destroy();
                }
            } catch (err) {
                logger.error('Error destroying player in handleQueueEnd', err);
            }
            return;
        }

        if (player.nowPlayingMessage) {
            safeDelete(player.nowPlayingMessage).catch(() => {});
        }

        if (player.addedToQueueMessage) {
            safeDelete(player.addedToQueueMessage, 1000).catch(() => {});
        }

        // Clean up lyrics messages
        if (player.lyricsMessages && player.lyricsMessages.length > 0) {
            for (const msg of player.lyricsMessages) {
                safeDelete(msg).catch(() => {});
            }
            player.lyricsMessages = [];
        }

        // Clear synced lyrics cache
        if (this.client.syncedLyricsCache) {
            this.client.syncedLyricsCache.delete(player.guildId);
        }

        const { EmbedBuilder } = require('discord.js');
        const emoji = require('../config/emoji.json');

        // Check if we should leave on queue end
        const shouldLeave = this.config.music?.leaveOnEnd !== false;
        
        // Get voice channel name for the leaving message
        let voiceChannelName = 'voice channel';
        try {
            const guild = this.client.guilds.cache.get(player.guildId);
            if (guild) {
                const voiceChannel = guild.channels.cache.get(player.voiceId);
                if (voiceChannel) {
                    voiceChannelName = voiceChannel.name;
                }
            }
        } catch (err) {
            logger.debug('Could not get voice channel name', err);
        }
        
        const embed = new EmbedBuilder()
            .setColor(this.config.embedColor)
            .setDescription(shouldLeave 
                ? `${emoji.info} I am leaving the voice channel **${voiceChannelName}** because there are no more songs to play.`
                : `${emoji.info} Queue ended. Add more songs to continue playing.`
            );

        sendSilentAwareMessage(channel, { embeds: [embed] }).then(msg => {
            safeDelete(msg, this.config.autoDeleteTime).catch(() => {});
        }).catch(err => {
            logger.error('Error sending queue end message', err);
        });

        // Only set destroy timeout if leaveOnEnd is enabled
        if (!shouldLeave) {
            logger.debug('leaveOnEnd is disabled, keeping player alive');
            player.data.queueEndInProgress = false;
            player.data.suppressAutoplay = false;
            return;
        }

        const destroyTimeout = setTimeout(async () => {
            if (player.preloadTimer) {
                clearTimeout(player.preloadTimer);
            }
            if (player.stateSaveInterval) {
                clearInterval(player.stateSaveInterval);
            }
            try {
                // Check if player is still idle/not playing before destroying
                if (player && player.state !== 'DESTROYED' && !player.playing) {
                    // Delete Firebase state before destroying player
                    await firebaseState.deletePlayerState(player.guildId);
                    await firebaseState.deleteQueue(player.guildId);
                    await firebaseState.deleteMessage(player.guildId, 'nowPlaying');
                    player.destroy();
                } else if (player && player.playing) {
                    logger.debug('Player is now playing, cancelling queue end');
                    // Player resumed during timeout, reset queue end state
                    player.data.queueEndInProgress = false;
                    player.data.suppressAutoplay = false;
                }
            } catch (err) {
                logger.error('Error destroying player after timeout', err);
            }
        }, this.config.music.leaveOnEndDelay);
        
        // Store timeout reference so it can be cancelled if needed
        player.queueEndDestroyTimeout = destroyTimeout;
    }

    get players() {
        return this.kazagumo.players;
    }

    async create(options) {
        const { guild, voiceChannel, textChannel } = options;
        
        const player = await this.kazagumo.createPlayer({
            guildId: guild,
            textId: textChannel,
            voiceId: voiceChannel,
            volume: this.config.music.defaultVolume || 80,
            deaf: true,
            // Audio quality optimizations for smoother playback
            data: {
                audioQuality: this.config.music.audioQuality || {
                    bitrate: 96000,
                    smoothing: true,
                    bufferDuration: 400
                }
            }
        });

        return player;
    }

    get(guildId) {
        return this.kazagumo.players.get(guildId);
    }

    async search(query, requester) {
        try {
            const result = await this.kazagumo.search(query, { requester });
            
            // Debug: Output raw result structure
            console.log('[SEARCH DEBUG] Raw Kazagumo result:', JSON.stringify({
                type: result?.type,
                playlistName: result?.playlistName,
                playlistInfo: result?.playlistInfo,
                trackCount: result?.tracks?.length,
                firstTrack: result?.tracks?.[0]?.title
            }, null, 2));
            
            if (!result || !result.tracks.length) {
                return { loadType: 'NO_MATCHES', tracks: [] };
            }

            // Enhanced playlist detection for Kazagumo + Spotify plugin
            const isPlaylist = !!(
                result.playlistName || 
                result.playlistInfo?.name || 
                result.type === 'PLAYLIST' ||
                result.type === 'playlist' ||
                (result.tracks.length > 1 && query.includes('playlist'))
            );
            
            const playlistName = result.playlistName || result.playlistInfo?.name || result.playlist?.name || 'Unknown Playlist';
            
            console.log('[SEARCH DEBUG] Playlist detection result:', {
                isPlaylist,
                playlistName,
                trackCount: result.tracks.length,
                loadType: isPlaylist ? 'PLAYLIST_LOADED' : 'TRACK_LOADED'
            });
            
            return {
                loadType: isPlaylist ? 'PLAYLIST_LOADED' : 'TRACK_LOADED',
                tracks: result.tracks,
                playlistInfo: isPlaylist ? {
                    name: playlistName
                } : null
            };
        } catch (error) {
            logger.error('Search error', error);
            return { loadType: 'LOAD_FAILED', tracks: [] };
        }
    }
}

module.exports = LavalinkManager;
