const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple, safeDelete } = require('../../utils/messageUtils');
const { getIndianTimestamp, replySilentAware } = require('../../utils/timeUtils');

module.exports = {
    name: 'play',
    category: 'music',
    aliases: ['p','j','join'],
    description: 'Play a song',
    async execute(client, message, args) {
        await message.channel.sendTyping();
        
        if (!message.member.voice.channel) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} You need to be in a voice channel.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        if (!args.length) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please provide a song name or URL.`);
            
            const reply = await replySilentAware(message, { embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const query = args.join(' ');
        
        const searchingEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emoji.loading} **Searching, Please Wait...**`);
        
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
                    .setDescription(`${emoji.error} Failed to create player. Please try again 🥲.`);
                await searchingMsg.edit({ embeds: [embed] });
                safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
                return;
            }
        }

        if (!player) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Could not create music player. Comeback to the few minutes later🥲.`);
            await searchingMsg.edit({ embeds: [embed] });
            safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
            return;
        }

        const res = await client.manager.search(query, message.author);

        if (res.loadType === 'LOAD_FAILED') {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Failed to load track.`);
            
            await searchingMsg.edit({ embeds: [embed] });
            safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
            
            if (!player.queue || !player.queue.current) player.destroy();
            return;
        }

        if (res.loadType === 'NO_MATCHES') {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} No results found for: **${query}**`);
            
            await searchingMsg.edit({ embeds: [embed] });
            safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
            
            if (!player.queue || !player.queue.current) player.destroy();
            return;
        }

        if (res.loadType === 'PLAYLIST_LOADED' || res.loadType === 'playlist') {
            try {
                console.log(`[PlaylistDebug] Loading playlist: ${res.playlistInfo?.name || 'Unknown'}, tracks returned: ${res.tracks?.length || 0}`);
                
                if (!res.tracks || res.tracks.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.error} Playlist is empty or could not be loaded.`);
                    await searchingMsg.edit({ embeds: [embed] });
                    safeDeleteMultiple([searchingMsg, message], config.autoDeleteTime);
                    return;
                }
                
                let addedCount = 0;
                for (const track of res.tracks) {
                    player.queue.add(track);
                    addedCount++;
                }
                
                console.log(`[PlaylistDebug] Successfully added ${addedCount} tracks to queue`);
                
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.success} **Added playlist:** ${res.playlistInfo?.name || 'Unknown'} (${addedCount} tracks)`);
                
                await searchingMsg.edit({ embeds: [embed] });
                player.addedToQueueMessage = searchingMsg;
                safeDelete(message, config.autoDeleteTime);
                
                if (!player.playing && !player.paused) {
                    player.play();
                }
            } catch (error) {
                console.error('[PlaylistDebug] Error adding playlist to queue:', error);
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} Failed to add playlist to queue: ${error.message || 'Unknown error'}`);
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
                    return;
                }
                
                player.queue.add(track);

                const trackLink = track.uri || `https://www.youtube.com/watch?v=${track.identifier}`;
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.success} **Added to queue:** [${track.title}](${trackLink})`);
                
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
