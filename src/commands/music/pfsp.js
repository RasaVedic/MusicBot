const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple, safeDelete } = require('../../utils/messageUtils');
const { canUseAdminCommand } = require('../../utils/permissionUtils');
const { replySilentAware } = require('../../utils/timeUtils');

const platformMap = {
    'sc': 'scsearch',
    'soundcloud': 'scsearch',
    'sp': 'spsearch',
    'spotify': 'spsearch',
    'yt': 'ytsearch',
    'youtube': 'ytsearch',
    'ytm': 'ytmsearch',
    'youtubemusic': 'ytmsearch',
    'am': 'amsearch',
    'applemusic': 'amsearch',
    'dz': 'dzsearch',
    'deezer': 'dzsearch'
};

module.exports = {
    name: 'pfsp',
    category: 'music',
    aliases: ['pf', 'playform'],
    description: 'Play from specific platform (Admin only) - Usage: pfsp -platform query',
    async execute(client, message, args) {
        if (!canUseAdminCommand(message.author.id, message.member)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} This command is restricted to administrators only.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        await message.channel.sendTyping();
        
        if (!message.member.voice.channel) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in a voice channel.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!args.length || !args[0].startsWith('-')) {
            const platformList = Object.keys(platformMap)
                .filter(key => key.length === 2)
                .map(key => `\`-${key}\` (${platformMap[key].replace('search', '')})`);
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('🎵 Platform-Specific Play')
                .setDescription(
                    `**Usage:** \`pfsp -platform <query>\`\n\n` +
                    `**Available Platforms:**\n${platformList.join('\n')}\n\n` +
                    `**Examples:**\n` +
                    `\`pfsp -sc ocean eyes\` - Play from SoundCloud\n` +
                    `\`pfsp -sp starboy\` - Play from Spotify\n` +
                    `\`pfsp -ytm lovely\` - Play from YouTube Music`
                );
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime * 2);
            return;
        }

        const platformArg = args[0].substring(1).toLowerCase();
        const searchPrefix = platformMap[platformArg];
        
        if (!searchPrefix) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Invalid platform: \`${platformArg}\`\n\nUse \`pfsp\` to see available platforms.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const query = args.slice(1).join(' ');
        
        if (!query) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide a search query after the platform.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const fullQuery = `${searchPrefix}:${query}`;
        
        const searchingEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.loading} **Searching ${platformArg.toUpperCase()}, Please Wait...**`);
        
        const searchingMsg = await replySilentAware(message, { embeds: [searchingEmbed] });
        
        let player = client.manager.get(message.guild.id);
        
        if (!player) {
            try {
                player = await client.manager.create({
                    guild: message.guild.id,
                    voiceChannel: message.member.voice.channel.id,
                    textChannel: message.channel.id,
                    selfDeafen: true,
                });
            } catch (error) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} Failed to create player. Please try again.`);
                await searchingMsg.edit({ embeds: [embed] });
                safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
                return;
            }
        }

        if (!player) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Could not create music player.`);
            await searchingMsg.edit({ embeds: [embed] });
            safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
            return;
        }

        const res = await client.manager.search(fullQuery, message.author);

        if (res.loadType === 'LOAD_FAILED') {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to load track from ${platformArg.toUpperCase()}.`);
            
            await searchingMsg.edit({ embeds: [embed] });
            safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
            
            if (!player.queue || !player.queue.current) player.destroy();
            return;
        }

        if (res.loadType === 'NO_MATCHES') {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} No results found on ${platformArg.toUpperCase()} for: **${query}**`);
            
            await searchingMsg.edit({ embeds: [embed] });
            safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
            
            if (!player.queue || !player.queue.current) player.destroy();
            return;
        }

        if (res.loadType === 'PLAYLIST_LOADED' || res.loadType === 'playlist') {
            try {
                if (!player.queue) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Player queue not initialized. Try again.`);
                    await searchingMsg.edit({ embeds: [embed] });
                    safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
                    if (!player.queue || !player.queue.current) player.destroy();
                    return;
                }
                
                for (const track of res.tracks) {
                    player.queue.add(track);
                }
                
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.success} **Added playlist from ${platformArg.toUpperCase()}:** ${res.playlistInfo?.name || 'Unknown'} (${res.tracks.length} tracks)`);
                
                await searchingMsg.edit({ embeds: [embed] });
                player.addedToQueueMessage = searchingMsg;
                safeDelete(message, config.autoDeleteTime);
                
                if (!player.playing && !player.paused) {
                    player.play();
                }
            } catch (error) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} Failed to add playlist to queue.`);
                await searchingMsg.edit({ embeds: [embed] });
                safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
            }
        } else {
            try {
                const track = res.tracks[0];
                
                if (!player.queue) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Player queue not initialized. Try again.`);
                    await searchingMsg.edit({ embeds: [embed] });
                    safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
                    if (!player.queue || !player.queue.current) player.destroy();
                    return;
                }
                
                player.queue.add(track);

                const trackLink = track.uri || `https://www.youtube.com/watch?v=${track.identifier}`;
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.success} **Added from ${platformArg.toUpperCase()}:** [${track.title}](${trackLink})`);
                
                await searchingMsg.edit({ embeds: [embed] });
                player.addedToQueueMessage = searchingMsg;
                safeDelete(message, config.autoDeleteTime);
                
                if (!player.playing && !player.paused) {
                    player.play();
                }
            } catch (error) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} Failed to add track to queue.`);
                await searchingMsg.edit({ embeds: [embed] });
                safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
            }
        }
    }
};
