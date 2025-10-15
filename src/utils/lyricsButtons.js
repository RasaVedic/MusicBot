const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { parseSyncedLyrics } = require('./lyricsUtils');
const config = require('../config/config.json');
const emoji = require('../config/emoji.json');
const logger = require('../modules/@rasavedic').createModuleLogger('LyricsButtons');

/**
 * Show lyrics type selection buttons
 */
async function showLyricsTypeSelection(message, guildId, trackName, artistName, hasSyncedLyrics) {
    const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('🎵 Choose Lyrics Display Type')
        .setDescription(`**${trackName}**\nby ${artistName}\n\nSelect how you want to view the lyrics:`)
        .setFooter({ text: 'This message will auto-delete in 20 seconds' });

    const liveButton = new ButtonBuilder()
        .setCustomId(`lyrics_live_${guildId}`)
        .setLabel('🎤 Live Lyrics')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!hasSyncedLyrics);

    const textButton = new ButtonBuilder()
        .setCustomId(`lyrics_text_${guildId}`)
        .setLabel('📝 Full Text')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(liveButton, textButton);

    const selectionMessage = await message.edit({ 
        embeds: [embed], 
        components: [row] 
    });

    // Auto-delete after 20 seconds if no interaction
    setTimeout(async () => {
        try {
            await selectionMessage.delete();
        } catch (err) {
            // Message might already be deleted by user interaction
        }
    }, 20000);

    return selectionMessage;
}

/**
 * Handle Live Lyrics button interaction
 */
async function handleLiveLyrics(client, interaction) {
    const guildId = interaction.guild.id;
    
    if (!client.syncedLyricsCache || !client.syncedLyricsCache.has(guildId)) {
        return interaction.reply({ 
            content: `${emoji.error} Synced lyrics are no longer available. Please use the lyrics command again.`,
            flags: MessageFlags.Ephemeral 
        });
    }

    const lyricsData = client.syncedLyricsCache.get(guildId);
    const parsedLyrics = parseSyncedLyrics(lyricsData.syncedLyrics);

    if (parsedLyrics.length === 0) {
        return interaction.reply({ 
            content: `${emoji.error} No synced lyrics available for this track.`,
            flags: MessageFlags.Ephemeral 
        });
    }

    // Delete the selection message
    try {
        await interaction.message.delete();
    } catch (err) {
        // Message might already be deleted
    }

    // Get player and clean up previous lyrics messages
    const player = client.manager.get(guildId);
    if (player && player.lyricsMessages && player.lyricsMessages.length > 0) {
        for (const msg of player.lyricsMessages) {
            try {
                await msg.delete();
            } catch (err) {
                // Message might already be deleted
            }
        }
        player.lyricsMessages = [];
    }
    
    // Clear any existing lyrics update interval
    if (player && player.lyricsUpdateInterval) {
        clearInterval(player.lyricsUpdateInterval);
        player.lyricsUpdateInterval = null;
    }

    await interaction.deferReply();
    
    // Use player position with small offset for better sync (compensate for latency)
    let elapsedTime;
    if (player && typeof player.position === 'number') {
        // Add 100ms offset to compensate for network/processing latency
        elapsedTime = player.position + 100;
    } else {
        // Fallback to calculated time
        elapsedTime = Date.now() - lyricsData.startTime;
    }
    
    // Find current lyric line with lookahead
    let currentIndex = 0;
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (parsedLyrics[i].time <= elapsedTime) {
            currentIndex = i;
        } else {
            break;
        }
    }

    // Build live lyrics display (3 lines before, current, 3 after)
    const contextBefore = 3;
    const contextAfter = 3;
    const startIdx = Math.max(0, currentIndex - contextBefore);
    const endIdx = Math.min(parsedLyrics.length, currentIndex + contextAfter + 1);

    let lyricsText = '';
    for (let i = startIdx; i < endIdx; i++) {
        const line = parsedLyrics[i];
        const minutes = Math.floor(line.time / 60000);
        const seconds = Math.floor((line.time % 60000) / 1000);
        const timestamp = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
        
        if (i === currentIndex) {
            lyricsText += `**→ ${timestamp} ${line.text}** ✨\n`;
        } else {
            lyricsText += `${timestamp} ${line.text}\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(config.lyricsEmbedColor)
        .setTitle(`🎤 Live Lyrics: ${lyricsData.trackName}`)
        .setAuthor({ name: lyricsData.artistName })
        .setDescription(lyricsText || 'No lyrics to display')
        .setFooter({ text: 'Synced lyrics • Updates in real-time' })
        .setTimestamp();

    const message = await interaction.editReply({ embeds: [embed] });
    
    // Track for cleanup
    if (player) {
        if (!player.lyricsMessages) player.lyricsMessages = [];
        player.lyricsMessages.push(message);
    }

    // Store interval in player for cleanup
    if (player.lyricsUpdateInterval) {
        clearInterval(player.lyricsUpdateInterval);
    }
    
    // Auto-update lyrics every 1 second for better sync (reduced from 2 seconds)
    let updateCount = 0;
    const maxUpdates = 600; // 600 seconds / 10 minutes (extended from 1 minute)
    
    const updateInterval = setInterval(async () => {
        updateCount++;
        
        if (updateCount >= maxUpdates || !player || !player.playing) {
            clearInterval(updateInterval);
            if (player) {
                player.lyricsUpdateInterval = null;
            }
            return;
        }

        // Use player position with offset for accurate sync
        let newElapsedTime;
        if (player && typeof player.position === 'number') {
            newElapsedTime = player.position + 100; // 100ms offset for latency
        } else {
            newElapsedTime = Date.now() - lyricsData.startTime;
        }
        
        // Find new current lyric line
        let newCurrentIndex = 0;
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (parsedLyrics[i].time <= newElapsedTime) {
                newCurrentIndex = i;
            } else {
                break;
            }
        }

        // Only update if line changed
        if (newCurrentIndex !== currentIndex) {
            currentIndex = newCurrentIndex;
            
            const newStartIdx = Math.max(0, currentIndex - contextBefore);
            const newEndIdx = Math.min(parsedLyrics.length, currentIndex + contextAfter + 1);

            let newLyricsText = '';
            for (let i = newStartIdx; i < newEndIdx; i++) {
                const line = parsedLyrics[i];
                const minutes = Math.floor(line.time / 60000);
                const seconds = Math.floor((line.time % 60000) / 1000);
                const timestamp = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
                
                if (i === currentIndex) {
                    newLyricsText += `**→ ${timestamp} ${line.text}** ✨\n`;
                } else {
                    newLyricsText += `${timestamp} ${line.text}\n`;
                }
            }

            const newEmbed = new EmbedBuilder()
                .setColor(config.lyricsEmbedColor)
                .setTitle(`🎤 Live Lyrics: ${lyricsData.trackName}`)
                .setAuthor({ name: lyricsData.artistName })
                .setDescription(newLyricsText || 'No lyrics to display')
                .setFooter({ text: 'Synced lyrics • Updates in real-time' })
                .setTimestamp();

            try {
                await message.edit({ embeds: [newEmbed] });
            } catch (e) {
                clearInterval(updateInterval);
                if (player) {
                    player.lyricsUpdateInterval = null;
                }
                logger.debug('Stopped updating live lyrics - message deleted');
            }
        }
    }, 1000); // Update every 1 second instead of 2
    
    // Store interval reference for cleanup
    if (player) {
        player.lyricsUpdateInterval = updateInterval;
    }
}

/**
 * Handle Text Lyrics button interaction
 */
async function handleTextLyrics(client, interaction) {
    const guildId = interaction.guild.id;
    
    if (!client.syncedLyricsCache || !client.syncedLyricsCache.has(guildId)) {
        return interaction.reply({ 
            content: `${emoji.error} Lyrics are no longer available. Please use the lyrics command again.`,
            flags: MessageFlags.Ephemeral 
        });
    }

    const lyricsData = client.syncedLyricsCache.get(guildId);
    
    if (!lyricsData.plainLyrics) {
        return interaction.reply({ 
            content: `${emoji.error} No text lyrics available for this track.`,
            flags: MessageFlags.Ephemeral 
        });
    }

    // Delete the selection message
    try {
        await interaction.message.delete();
    } catch (err) {
        // Message might already be deleted
    }
    
    // Get player and clean up previous lyrics messages
    const player = client.manager.get(guildId);
    if (player && player.lyricsMessages && player.lyricsMessages.length > 0) {
        for (const msg of player.lyricsMessages) {
            try {
                await msg.delete();
            } catch (err) {
                // Message might already be deleted
            }
        }
        player.lyricsMessages = [];
    }
    
    // Clear any existing lyrics update interval
    if (player && player.lyricsUpdateInterval) {
        clearInterval(player.lyricsUpdateInterval);
        player.lyricsUpdateInterval = null;
    }

    let description = lyricsData.plainLyrics;
    const MAX_LENGTH = 4096;
    if (description.length > MAX_LENGTH) {
        description = description.slice(0, MAX_LENGTH - 50) + '\n\n... *(lyrics truncated)*';
    }

    const embed = new EmbedBuilder()
        .setColor(config.lyricsEmbedColor)
        .setTitle(`📝 ${lyricsData.trackName}`)
        .setAuthor({ name: lyricsData.artistName })
        .setDescription(description || 'No lyrics available')
        .setFooter({ text: 'Full text lyrics' })
        .setTimestamp();

    const response = await interaction.reply({ 
        embeds: [embed],
        withResponse: true
    });
    const message = response;
    
    // Track for cleanup (player already retrieved above)
    if (player) {
        if (!player.lyricsMessages) player.lyricsMessages = [];
        player.lyricsMessages.push(message);
    }
}

module.exports = {
    showLyricsTypeSelection,
    handleLiveLyrics,
    handleTextLyrics
};
