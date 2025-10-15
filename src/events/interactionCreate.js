const { EmbedBuilder, MessageFlags } = require('discord.js');
const emoji = require('../config/emoji.json');
const config = require('../config/config.json');
const { safeDelete } = require('../utils/messageUtils');
const { getIndianTimestamp, getSilentMessageOptions } = require('../utils/timeUtils');
const { handleLiveLyrics, handleTextLyrics } = require('../utils/lyricsButtons');
const firebaseState = require('../services/FirebaseStateManager');
const buttonSpamService = require('../services/ButtonSpamService');
const debugLogger = require('../utils/debugLogger');

function createActionEmbed(user, buttonName) {
    return new EmbedBuilder()
        .setColor(config.embedColor)
        .setDescription(`**Action By -** ${user.username}\n**Button:** \`${buttonName}\``)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }));
}

module.exports = {
    name: 'interactionCreate',
    async execute(client, interaction) {
        // Handle both button and select menu interactions
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
        
        try {
            // Handle help category selection (both old button format and new select menu)
            if (interaction.customId === 'help_category_select' || interaction.customId.startsWith('help_category_')) {
                const category = interaction.isStringSelectMenu() 
                    ? interaction.values[0] 
                    : interaction.customId.replace('help_category_', '');
                
                const helpData = client.helpCollectors?.get(interaction.message.id);
                if (!helpData) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} This help menu has expired. Please use the help command again.`);
                    
                    await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                    return;
                }
                
                const categoryEmojis = {
                    'music': emoji.music || '🎵',
                    'admin': emoji.warning || '🔨',
                    'utility': emoji.info || '🛠️'
                };
                
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                const categoryEmoji = categoryEmojis[category] || emoji.info;
                const commands = helpData.categories[category] || [];
                
                if (commands.length === 0) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} No commands found in this category.`);
                    
                    await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                    return;
                }
                
                const commandList = commands.map(cmd => {
                    const aliases = cmd.aliases && cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
                    return `\`${helpData.prefix}${cmd.name}\`${aliases} - ${cmd.description}`;
                }).join('\n');
                
                const categoryEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setTitle(`${categoryEmoji} ${categoryName} Commands`)
                    .setDescription(
                        `**Prefix:** \`${helpData.prefix}\`\n` +
                        `**Total Commands:** ${commands.length}\n\n` +
                        commandList
                    )
                    .setFooter({ 
                        text: `Use ${helpData.prefix}command to execute any command`, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [categoryEmbed], flags: MessageFlags.Ephemeral });
                return;
            }

            const spamCheckButtons = ['autoplay', 'shuffle', 'lyrics_button', 'pause', 'skip', 'previous', 'loop'];
            const musicControlButtons = ['autoplay', 'shuffle', 'pause', 'skip', 'previous', 'loop', 'stop'];
            
            // Defer music control buttons immediately to prevent timeout (lyrics_button handles its own defer)
            if (musicControlButtons.includes(interaction.customId) && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
            
            if (spamCheckButtons.includes(interaction.customId)) {
                const spamCheck = await buttonSpamService.checkAndHandleSpam(interaction, interaction.customId);
                
                if (spamCheck.isMuted) {
                    const muteEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription(`${emoji.error} You are currently muted for button spam. Please wait until your mute expires.`);
                    
                    try {
                        if (interaction.deferred) {
                            await interaction.editReply({ embeds: [muteEmbed] });
                        } else {
                            await interaction.reply({ embeds: [muteEmbed], flags: MessageFlags.Ephemeral });
                        }
                    } catch (error) {
                    }
                    return;
                }
                
                if (spamCheck.shouldMute) {
                    const muteEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription(`${emoji.warning} You have been temporarily muted for button spam. Please wait for the mute to expire.`);
                    
                    try {
                        if (interaction.deferred) {
                            await interaction.editReply({ embeds: [muteEmbed] });
                        } else {
                            await interaction.reply({ embeds: [muteEmbed], flags: MessageFlags.Ephemeral });
                        }
                    } catch (error) {
                    }
                    return;
                }

                await buttonSpamService.deleteOldButtonMessage(interaction);
            }

            // Handle lyrics buttons (don't need player to be active)
            if (interaction.customId.startsWith('lyrics_live_')) {
                try {
                    if (interaction.deferred || interaction.replied) return;
                    return await handleLiveLyrics(client, interaction);
                } catch (error) {
                    console.error('Error handling live lyrics:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        return await interaction.reply({ 
                            content: `${emoji.error} Failed to load live lyrics. Please try again.`, 
                            flags: MessageFlags.Ephemeral 
                        });
                    }
                }
            }
            
            if (interaction.customId.startsWith('lyrics_text_')) {
                try {
                    if (interaction.deferred || interaction.replied) return;
                    return await handleTextLyrics(client, interaction);
                } catch (error) {
                    console.error('Error handling text lyrics:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        return await interaction.reply({ 
                            content: `${emoji.error} Failed to load lyrics. Please try again.`, 
                            flags: MessageFlags.Ephemeral 
                        });
                    }
                }
            }
            
            // For music control buttons, player is required
            const player = client.manager.players.get(interaction.guild.id);
            
            if (!player) {
                if (!interaction.replied && !interaction.deferred) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} No music is currently playing.`);
                    
                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                } else if (interaction.deferred) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} No music is currently playing.`);
                    
                    await interaction.editReply({ embeds: [embed] });
                }
                return;
            }
        
        const member = interaction.member;
        
        if (!member.voice.channel) {
            if (!interaction.replied && !interaction.deferred) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} You need to be in a voice channel.`);
                
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else if (interaction.deferred) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} You need to be in a voice channel.`);
                
                await interaction.editReply({ embeds: [embed] });
            }
            return;
        }
        
        const voiceChannelId = player.voiceChannel || player.voiceId;
        if (voiceChannelId !== member.voice.channel.id) {
            if (!interaction.replied && !interaction.deferred) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} You need to be in the same voice channel as me.`);
                
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else if (interaction.deferred) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} You need to be in the same voice channel as me.`);
                
                await interaction.editReply({ embeds: [embed] });
            }
            return;
        }
        
        let embed;
        
        switch (interaction.customId) {
            case 'previous':
                debugLogger.logButton('previous', interaction.user, interaction, { 
                    guildId: interaction.guild.id,
                    playerActive: player && player.state !== 'DESTROYED'
                });
                
                if (!player || player.state === 'DESTROYED') {
                    embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Player is not active.`);
                } else {
                    try {
                        let previousTrack = player.previousTrack;
                        
                        if (!previousTrack) {
                            previousTrack = await firebaseState.getPreviousTrack(interaction.guild.id);
                        }
                        
                        if (!previousTrack) {
                            debugLogger.logButtonAction('previous', 'no_previous_track', player);
                            embed = new EmbedBuilder()
                                .setColor(config.embedColor)
                                .setDescription(`${emoji.error} No previous track available.`);
                        } else {
                            // Re-resolve the track if it came from Firebase (plain object without Kazagumo methods)
                            if (previousTrack && !previousTrack.setKazagumo) {
                                const searchResult = await interaction.client.manager.search(
                                    previousTrack.uri || previousTrack.title,
                                    previousTrack.requester || { id: 'system', username: 'System', tag: 'System' }
                                );
                                
                                if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
                                    previousTrack = searchResult.tracks[0];
                                } else {
                                    debugLogger.logButtonAction('previous', 'track_resolve_failed', player, { trackTitle: previousTrack.title });
                                    embed = new EmbedBuilder()
                                        .setColor(config.embedColor)
                                        .setDescription(`${emoji.error} Could not load previous track.`);
                                    break;
                                }
                            }
                            
                            // Only cleanup if we have a previous track to play
                            if (player.preloadTimer) {
                                clearTimeout(player.preloadTimer);
                                player.preloadTimer = null;
                            }
                            
                            if (player.nowPlayingMessage) {
                                await safeDelete(player.nowPlayingMessage).catch(() => {});
                                player.nowPlayingMessage = null;
                            }
                            
                            player.data = player.data || {};
                            
                            debugLogger.logButtonAction('previous', 'playing_previous_track', player, { 
                                trackTitle: previousTrack.title,
                                autoplayEnabled: player.data.autoplay
                            });
                            
                            try {
                                // Set flag to prevent trackEnd from auto-playing
                                player.data.manualPrevious = true;
                                
                                // Save current queue
                                const savedQueue = [];
                                if (player.queue && player.queue.size > 0) {
                                    player.queue.forEach(track => savedQueue.push(track));
                                }
                                
                                // Clear the queue completely
                                player.queue.clear();
                                
                                // Add previous track as the only track to play
                                player.queue.add(previousTrack);
                                
                                // Add saved queue back (if any)
                                savedQueue.forEach(track => player.queue.add(track));
                                
                                // Play the previous track (first in queue now)
                                await player.play();
                                
                                // Send brief confirmation with silent mode support
                                embed = createActionEmbed(interaction.user, 'Previous');
                                break;
                            } catch (error) {
                                console.error('Error playing previous track:', error);
                                debugLogger.logError(error, 'previous_button', { trackTitle: previousTrack.title });
                                embed = new EmbedBuilder()
                                    .setColor(config.embedColor)
                                    .setDescription(`${emoji.error} Failed to play previous track. Please try again.`);
                            }
                        }
                    } catch (error) {
                        console.error('Error playing previous track:', error);
                        debugLogger.logError(error, 'previous_button');
                        embed = new EmbedBuilder()
                            .setColor(config.embedColor)
                            .setDescription(`${emoji.error} Failed to play previous track. Please try again.`);
                    }
                }
                break;
                
            case 'pause':
                const buttonAction = player.paused ? 'Resume' : 'Pause';
                
                debugLogger.logButton('pause', interaction.user, interaction, { 
                    guildId: interaction.guild.id,
                    action: buttonAction.toLowerCase(),
                    currentTrack: player?.queue?.current?.title
                });
                
                if (player.paused) {
                    player.pause(false);
                } else {
                    player.pause(true);
                }
                
                debugLogger.logButtonAction('pause', buttonAction.toLowerCase(), player);
                
                if (player.nowPlayingMessage) {
                    try {
                        const updatedButtons = require('../utils/buttons').createMusicButtons(player);
                        await player.nowPlayingMessage.edit({ components: updatedButtons });
                    } catch (error) {
                        console.error('Error updating pause button:', error);
                    }
                }
                
                embed = createActionEmbed(interaction.user, buttonAction);
                break;
                
            case 'skip':
                debugLogger.logButton('skip', interaction.user, interaction, { 
                    guildId: interaction.guild.id,
                    playerActive: player && player.state !== 'DESTROYED',
                    currentTrack: player?.queue?.current?.title
                });
                
                if (!player || player.state === 'DESTROYED') {
                    embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Player is not active.`);
                    break;
                }
                
                // Save current track as previous track before skipping
                if (player.queue?.current) {
                    player.previousTrack = player.queue.current;
                    try {
                        await firebaseState.savePreviousTrack(interaction.guild.id, player.queue.current);
                    } catch (error) {
                        console.error('Failed to save previous track:', error);
                    }
                }
                
                if (player.preloadTimer) {
                    clearTimeout(player.preloadTimer);
                    player.preloadTimer = null;
                }
                
                if (player.nowPlayingMessage) {
                    await safeDelete(player.nowPlayingMessage).catch(() => {});
                    player.nowPlayingMessage = null;
                }
                
                player.data = player.data || {};
                
                // Set manualSkip flag to prevent trackEnd loop
                player.data.manualSkip = true;
                
                debugLogger.logButtonAction('skip', 'skipping_track', player, { 
                    trackTitle: player.queue?.current?.title,
                    autoplayEnabled: player.data.autoplay,
                    queueLength: player.queue?.length || 0
                });
                
                try {
                    player.skip();
                    
                    // Send brief confirmation with silent mode support
                    embed = createActionEmbed(interaction.user, 'Skip');
                    break;
                } catch (error) {
                    console.error('Error skipping track:', error);
                    debugLogger.logError(error, 'skip_button', { trackTitle: player.queue?.current?.title });
                    embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Failed to skip track.`);
                }
                break;
                
            case 'autoplay':
                debugLogger.logButton('autoplay', interaction.user, interaction, { 
                    guildId: interaction.guild.id,
                    currentAutoplayState: player?.data?.autoplay || false
                });
                
                player.data = player.data || {};
                player.data.autoplay = !player.data.autoplay;
                
                debugLogger.logButtonAction('autoplay', player.data.autoplay ? 'enabled' : 'disabled', player);
                
                await firebaseState.savePlayerState(interaction.guild.id, player);
                
                if (player.autoplayStatusMessage) {
                    await safeDelete(player.autoplayStatusMessage);
                    player.autoplayStatusMessage = null;
                }
                
                if (player.nowPlayingMessage) {
                    try {
                        const updatedButtons = require('../utils/buttons').createMusicButtons(player);
                        await player.nowPlayingMessage.edit({ components: updatedButtons });
                    } catch (error) {
                        console.error('Error updating autoplay button:', error);
                    }
                }
                
                const status = player.data.autoplay ? 'Enabled' : 'Disabled';
                embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.success} **Autoplay is now \`${status}\`**\n${emoji.heart} *Set by ${interaction.user.username} - (New config)*`);
                
                const messageOptions = getSilentMessageOptions({ embeds: [embed] });
                let autoplayMsg;
                if (interaction.deferred) {
                    autoplayMsg = await interaction.editReply(messageOptions);
                } else {
                    autoplayMsg = await interaction.reply(messageOptions);
                }
                
                if (player.data.autoplay) {
                    player.autoplayStatusMessage = autoplayMsg;
                } else {
                    setTimeout(() => safeDelete(autoplayMsg), config.autoDeleteTime);
                }
                
                safeDelete(interaction, config.autoDeleteTime);
                return;
                
            case 'stop':
                debugLogger.logButton('stop', interaction.user, interaction, { 
                    guildId: interaction.guild.id,
                    currentTrack: player?.queue?.current?.title,
                    queueLength: player?.queue?.length || 0
                });
                
                if (player.preloadTimer) {
                    clearTimeout(player.preloadTimer);
                    player.preloadTimer = null;
                }
                
                if (player.nowPlayingMessage) {
                    await safeDelete(player.nowPlayingMessage);
                    player.nowPlayingMessage = null;
                }

                if (player.autoplayStatusMessage) {
                    await safeDelete(player.autoplayStatusMessage);
                    player.autoplayStatusMessage = null;
                }

                if (player.addedToQueueMessage) {
                    await safeDelete(player.addedToQueueMessage);
                    player.addedToQueueMessage = null;
                }
                
                const voiceChannel = interaction.guild.channels.cache.get(voiceChannelId);
                const voiceChannelName = voiceChannel?.name || 'Unknown';
                
                debugLogger.logButtonAction('stop', 'destroying_player', player, { voiceChannelName });
                
                await firebaseState.saveDisconnectHistory(interaction.guild.id, 'user_button_stop', {
                    voiceChannelId: voiceChannelId,
                    voiceChannelName: voiceChannelName,
                    textChannelId: interaction.channel.id,
                    currentTrack: player.queue?.current || player.currentTrack,
                    position: player.position || 0,
                    queueLength: player.queue?.length || player.queue?.size || 0,
                    wasPlaying: player.playing || false,
                    reason: 'User stopped via button',
                    executedBy: interaction.user.tag,
                    executedById: interaction.user.id
                });
                
                try {
                    if (player && player.state !== 'DESTROYED') {
                        player.destroy();
                    }
                } catch (error) {
                    console.error('Error destroying player:', error);
                    debugLogger.logError(error, 'stop_button');
                }
                
                embed = createActionEmbed(interaction.user, 'Stop');
                break;
                
            case 'loop':
                debugLogger.logButton('loop', interaction.user, interaction, { 
                    guildId: interaction.guild.id,
                    currentLoopMode: player?.data?.loop || 'none'
                });
                
                player.data = player.data || {};
                const loopModes = ['none', 'track', 'queue'];
                const currentLoop = player.data.loop || 'none';
                const currentIndex = loopModes.indexOf(currentLoop);
                const nextIndex = (currentIndex + 1) % loopModes.length;
                player.data.loop = loopModes[nextIndex];
                
                debugLogger.logButtonAction('loop', `changed_to_${loopModes[nextIndex]}`, player);
                
                await firebaseState.savePlayerState(interaction.guild.id, player);
                
                const loopText = {
                    'none': 'Loop - Disabled',
                    'track': 'Loop - Track',
                    'queue': 'Loop - Queue'
                };
                
                embed = createActionEmbed(interaction.user, loopText[player.data.loop]);
                break;
                
            case 'shuffle':
                debugLogger.logButton('shuffle', interaction.user, interaction, { 
                    guildId: interaction.guild.id,
                    queueLength: player?.queue?.tracks?.length || 0
                });
                
                if (!player.queue.tracks || player.queue.tracks.length < 2) {
                    debugLogger.logButtonAction('shuffle', 'insufficient_tracks', player);
                    embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Not enough tracks in queue to shuffle.`);
                } else {
                    for (let i = player.queue.tracks.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [player.queue.tracks[i], player.queue.tracks[j]] = [player.queue.tracks[j], player.queue.tracks[i]];
                    }
                    debugLogger.logButtonAction('shuffle', 'queue_shuffled', player, { tracksShuffled: player.queue.tracks.length });
                    embed = createActionEmbed(interaction.user, 'Shuffle');
                }
                break;
                
            case 'lyrics_button':
                const { searchLyrics } = require('../utils/lyricsUtils');
                const { showLyricsTypeSelection } = require('../utils/lyricsButtons');
                
                if (!player.queue.current) {
                    embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} No song is currently playing.`);
                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    return;
                }
                
                await interaction.deferReply();
                
                const currentTrack = player.queue.current;
                const trackName = currentTrack.title;
                const artistName = currentTrack.author || 'Unknown';
                const trackDuration = currentTrack.length || currentTrack.duration;
                
                const lyricsResult = await searchLyrics(trackName, artistName, null, trackDuration);
                
                if (!lyricsResult || (!lyricsResult.plainLyrics && !lyricsResult.instrumental)) {
                    embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Could not find lyrics for **${trackName}**.`);
                    const errorMsg = await interaction.editReply({ embeds: [embed] });
                    setTimeout(() => safeDelete(errorMsg), config.autoDeleteTime);
                    return;
                }
                
                // Cache lyrics data
                if (!client.syncedLyricsCache) client.syncedLyricsCache = new Map();
                client.syncedLyricsCache.set(interaction.guild.id, {
                    syncedLyrics: lyricsResult.syncedLyrics,
                    plainLyrics: lyricsResult.plainLyrics,
                    trackName: lyricsResult.trackName || trackName,
                    artistName: lyricsResult.artistName || artistName,
                    startTime: Date.now() - (player.position || 0),
                    source: lyricsResult.source,
                    albumName: lyricsResult.albumName,
                    instrumental: lyricsResult.instrumental
                });
                
                // Show lyrics type selection buttons
                const hasSyncedLyrics = !!(lyricsResult.syncedLyrics && player && player.playing);
                
                // Create a temporary embed for the selection
                const tempEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.loading} Loading lyrics options...`);
                
                const lyricsMsg = await interaction.editReply({ 
                    embeds: [tempEmbed], 
                    components: [] 
                });
                
                await showLyricsTypeSelection(
                    lyricsMsg,
                    interaction.guild.id,
                    lyricsResult.trackName || trackName,
                    lyricsResult.artistName || artistName,
                    hasSyncedLyrics
                );
                
                return;
        }
        
        if (!interaction.replied && embed) {
            try {
                let reply;
                const messageOptions = getSilentMessageOptions({ embeds: [embed] });
                
                if (interaction.deferred) {
                    reply = await interaction.editReply(messageOptions);
                } else {
                    reply = await interaction.reply(messageOptions);
                }
                
                if (reply) {
                    const spamCheckButtons = ['autoplay', 'shuffle', 'lyrics_button', 'pause', 'skip', 'previous', 'loop'];
                    if (spamCheckButtons.includes(interaction.customId)) {
                        buttonSpamService.setLastMessage(interaction, reply);
                    }
                    setTimeout(() => safeDelete(reply), config.autoDeleteTime);
                }
            } catch (replyError) {
                console.error('Error sending interaction reply:', replyError);
            }
        }
        
        } catch (error) {
            console.error('Error handling button interaction:', error);
            try {
                const errorEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} An error occurred while processing your request.`);
                
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                }
            } catch (replyError) {
                console.error('Error sending error message:', replyError);
            }
        }
    }
};
