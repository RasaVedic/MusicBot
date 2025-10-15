/*[file name]: equalizer.js
[file content begin]*/
const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { getIndianTimestamp } = require('../../utils/timeUtils');
const firebaseState = require('../../services/FirebaseStateManager');

const EQ_PRESETS = {
    // Basic Presets
    flat: Array(15).fill(0.0),
    bass: [0.6, 0.5, 0.4, 0.3, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    treble: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
    boost: Array(15).fill(0.2),

    // Music Genre Presets
    rock: [0.3, 0.2, 0.1, 0.0, 0.0, -0.1, -0.1, 0.0, 0.1, 0.2, 0.3, 0.2, 0.1, 0.0, 0.0],
    pop: [0.1, 0.2, 0.3, 0.2, 0.1, 0.0, -0.1, -0.1, 0.0, 0.1, 0.2, 0.1, 0.0, -0.1, -0.1],
    jazz: [0.2, 0.1, 0.0, 0.0, 0.1, 0.2, 0.1, 0.0, -0.1, -0.1, 0.0, 0.1, 0.2, 0.3, 0.2],
    classical: [0.1, 0.2, 0.3, 0.2, 0.1, 0.0, 0.0, 0.1, 0.2, 0.3, 0.2, 0.1, 0.0, 0.0, 0.0],
    hiphop: [0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.1, 0.0, 0.1, 0.2, 0.1, 0.0, 0.0, 0.0],

    // Enhanced Presets
    dance: [0.3, 0.4, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, 0.1, 0.2, 0.3, 0.2, 0.1, 0.0, 0.0],
    metal: [0.2, 0.3, 0.4, 0.3, 0.2, 0.1, 0.0, 0.1, 0.2, 0.3, 0.2, 0.1, 0.0, -0.1, -0.1],
    electronic: [0.2, 0.3, 0.4, 0.3, 0.2, 0.1, 0.0, 0.0, 0.1, 0.2, 0.3, 0.4, 0.3, 0.2, 0.1],

    // Effect Presets
    reverb: [0.1, 0.2, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3, 0.2, 0.1],
    soft: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.05, -0.1, -0.125, -0.15, -0.175, -0.175, -0.175, -0.175],
    vocal: [0.0, 0.0, 0.0, 0.1, 0.2, 0.3, 0.4, 0.3, 0.2, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0],

    // Fun Presets
    nightcore: [0.3, 0.3, 0.0, 0.0, -0.1, -0.1, -0.15, -0.2, 0.0, 0.0, 0.0, 0.0, 0.3, 0.35, 0.35],
    vaporwave: [0.3, 0.3, 0.0, 0.0, 0.0, -0.1, -0.15, -0.15, 0.0, 0.0, 0.25, 0.3, 0.4, 0.4, 0.4],
    bassboost: [0.5, 0.4, 0.3, 0.2, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    trebleboost: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],

    // Custom Combinations
    party: [0.4, 0.5, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.2, 0.3, 0.4, 0.3, 0.2, 0.1, 0.0],
    cinematic: [0.2, 0.3, 0.4, 0.3, 0.2, 0.1, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.4, 0.3, 0.2],
    clear: [0.1, 0.2, 0.1, 0.0, -0.1, -0.1, 0.0, 0.1, 0.2, 0.3, 0.2, 0.1, 0.0, 0.0, 0.0]
};

const PRESET_CATEGORIES = {
    '🎵 Basic': ['flat', 'bass', 'treble', 'boost'],
    '🎸 Music Genres': ['rock', 'pop', 'jazz', 'classical', 'hiphop'],
    '💃 Enhanced': ['dance', 'metal', 'electronic'],
    '🎛️ Effects': ['reverb', 'soft', 'vocal'],
    '🎮 Fun': ['nightcore', 'vaporwave', 'bassboost', 'trebleboost'],
    '🌟 Special': ['party', 'cinematic', 'clear']
};

module.exports = {
    name: 'equalizer',
    category: 'music',
    aliases: ['eq', 'filter'],
    description: 'Set equalizer preset for enhanced audio experience',
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

        const preset = args[0]?.toLowerCase();

        if (!preset) {
            // Create a beautiful categorized preset list
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle(`${emoji.eq} 🎚️ Equalizer Presets`)
                .setDescription(`Use \`${message.prefix || '+'}eq <preset>\` to apply a preset\n\n**Current Preset:** \`${player.data?.equalizer || 'flat'}\``);

            // Add fields for each category
            for (const [category, presets] of Object.entries(PRESET_CATEGORIES)) {
                const presetList = presets.map(p => `\`${p}\``).join(', ');
                embed.addFields({ 
                    name: category, 
                    value: presetList, 
                    inline: true 
                });
            }

            embed.addFields({
                name: '💡 Tip',
                value: `Try popular presets like \`dance\`, \`bassboost\`, or \`reverb\` for different effects!`,
                inline: false
            });

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!EQ_PRESETS[preset]) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Invalid preset **${preset}**. Use \`${message.prefix || '+'}eq\` to see all available presets.`)
                .addFields({
                    name: '💡 Quick Suggestions',
                    value: 'Try: `bass`, `dance`, `rock`, `reverb`, `vocal`',
                    inline: true
                });

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        try {
            const bands = EQ_PRESETS[preset].map((gain, index) => ({ band: index, gain }));
            await player.shoukaku.setEqualizer(bands);

            player.data = player.data || {};
            player.data.equalizer = preset;

            await firebaseState.savePlayerState(message.guild.id, player);

            // Get category for the applied preset
            let category = 'Custom';
            for (const [cat, presets] of Object.entries(PRESET_CATEGORIES)) {
                if (presets.includes(preset)) {
                    category = cat.replace(/[^\w\s]/g, '');
                    break;
                }
            }

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.success} **Equalizer Applied!**`)
                .addFields(
                    { name: '🎛️ Preset', value: `**${preset}**`, inline: true },
                    { name: '📂 Category', value: category, inline: true },
                    { name: '🔊 Status', value: 'Active', inline: true }
                )
                .setFooter({ text: `Use "${message.prefix || '+'}eq flat" to reset to default` });

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        } catch (error) {
            console.error('Equalizer error:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to apply **${preset}** equalizer preset.`)
                .addFields({
                    name: '🔧 Troubleshooting',
                    value: '• Make sure a track is playing\n• Try a different preset\n• Wait a moment and try again',
                    inline: false
                });

            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
        }
    }
};
//[file content end]