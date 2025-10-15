const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const emoji = require('../config/emoji.json');

/**
 * Create music control buttons
 * @param {Object} player - The music player object (optional)
 * @returns {Array<ActionRowBuilder>} Array of action rows with buttons
 */
function createMusicButtons(player = null) {
    const isPaused = player?.paused || false;
    const isAutoplayEnabled = player?.data?.autoplay || false;
    
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('previous')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('pause')
                .setLabel(isPaused ? 'Resume' : 'Pause')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('skip')
                .setLabel('Skip')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stop')
                .setLabel('Stop')
                .setStyle(ButtonStyle.Danger)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('autoplay')
                .setLabel('Autoplay')
                .setStyle(isAutoplayEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('loop')
                .setLabel('Loop')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('shuffle')
                .setLabel('Shuffle')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('lyrics_button')
                .setLabel('🎵 Lyrics')
                .setStyle(ButtonStyle.Secondary)
        );

    return [row1, row2];
}

/**
 * Update pause button state
 * @param {ActionRowBuilder} row - The action row containing the pause button
 * @param {boolean} isPaused - Whether the player is paused
 */
function updatePauseButton(row, isPaused) {
    const pauseButton = row.components.find(btn => btn.data.custom_id === 'pause');
    if (pauseButton) {
        pauseButton.setLabel(isPaused ? 'Resume' : 'Pause');
        // pauseButton.setEmoji(isPaused ? emoji.play : emoji.pause); // Custom emoji will be added later
    }
}

/**
 * Update autoplay button state
 * @param {ActionRowBuilder} row - The action row containing the autoplay button
 * @param {boolean} isEnabled - Whether autoplay is enabled
 */
function updateAutoplayButton(row, isEnabled) {
    const autoplayButton = row.components.find(btn => btn.data.custom_id === 'autoplay');
    if (autoplayButton) {
        autoplayButton.setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Secondary);
    }
}

module.exports = {
    createMusicButtons,
    updatePauseButton,
    updateAutoplayButton
};
