const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType } = require('@discordjs/voice');
const { Innertube } = require('youtubei.js');
const { sendSilentAwareMessage } = require('../utils/timeUtils');
const debugLogger = require('./@rasavedic');
const logger = debugLogger.createModuleLogger('DirectStreamPlayer');

class DirectStreamPlayer {
    constructor(client) {
        this.client = client;
        this.players = new Map();
        this.youtube = null;
    }

    create(options) {
        const { guild, voiceChannel, textChannel } = options;
        
        if (this.players.has(guild)) {
            return this.players.get(guild);
        }

        const queue = {
            tracks: [],
            current: null,
            add: function(track) {
                if (Array.isArray(track)) {
                    this.tracks.push(...track);
                } else {
                    this.tracks.push(track);
                }
            },
            get length() {
                return this.tracks.length;
            }
        };

        const player = {
            guild,
            voiceChannel,
            voiceId: voiceChannel,
            textChannel,
            textId: textChannel,
            queue,
            currentTrack: null,
            previousTrack: null,
            connection: null,
            audioPlayer: createAudioPlayer(),
            playing: false,
            paused: false,
            autoplayEnabled: false,
            data: {},
            nowPlayingMessage: null,
            position: 0,
            
            connect: async () => {
                try {
                    const channel = this.client.channels.cache.get(voiceChannel);
                    if (!channel) {
                        logger.error('Voice channel not found', new Error(`Channel ID: ${voiceChannel}`));
                        return;
                    }

                    player.connection = joinVoiceChannel({
                        channelId: channel.id,
                        guildId: guild,
                        adapterCreator: channel.guild.voiceAdapterCreator,
                        selfDeaf: true,
                    });

                    player.connection.on(VoiceConnectionStatus.Disconnected, async () => {
                        try {
                            await Promise.race([
                                entersState(player.connection, VoiceConnectionStatus.Signalling, 5_000),
                                entersState(player.connection, VoiceConnectionStatus.Connecting, 5_000),
                            ]);
                        } catch (error) {
                            logger.error('Connection lost, destroying player', error);
                            player.destroy();
                        }
                    });

                    player.connection.subscribe(player.audioPlayer);

                    await entersState(player.connection, VoiceConnectionStatus.Ready, 30_000);
                    player.state = 'CONNECTED';
                    logger.info('Connected to voice channel', { guild, voiceChannel });
                } catch (error) {
                    logger.error('Failed to connect to voice channel', error);
                    throw error;
                }
            },

            play: async () => {
                if (player.queue.tracks.length === 0) {
                    player.playing = false;
                    player.paused = false;
                    player.queue.current = null;
                    player.currentTrack = null;
                    this.client.emit('queueEnd', player);
                    return;
                }

                player.queue.current = player.queue.tracks.shift();
                player.currentTrack = player.queue.current;
                player.playing = true;
                player.paused = false;
                player.position = 0;

                try {
                    const perf = logger.perf('Play Track');
                    perf.start();
                    
                    logger.debug('Attempting to play track', {
                        title: player.currentTrack?.title,
                        uri: player.currentTrack?.uri
                    });

                    if (!player.currentTrack || !player.currentTrack.uri) {
                        throw new Error('Invalid track: missing URI');
                    }
                    
                    const videoId = this.extractVideoId(player.currentTrack.uri);
                    
                    logger.debug('Fetching stream from YouTubei.js', { videoId });
                    const info = await this.youtube.getInfo(videoId);
                    
                    logger.debug('Downloading audio stream...');
                    const stream = await this.youtube.download(videoId, {
                        type: 'audio',
                        quality: 'best',
                        format: 'mp4'
                    });
                    
                    logger.info('Stream ready', { 
                        title: player.currentTrack.title,
                        duration: `${(player.currentTrack.duration / 1000).toFixed(0)}s`
                    });
                    
                    perf.end();
                    
                    const resource = createAudioResource(stream, {
                        inputType: StreamType.Arbitrary,
                        inlineVolume: true
                    });

                    resource.volume?.setVolume(0.5);

                    player.audioPlayer.play(resource);
                    
                    this.client.emit('trackStart', player, player.currentTrack);

                    const errorHandler = (error) => {
                        logger.error('Audio player error', error);
                        if (player.queue.tracks.length > 0) {
                            logger.info('Skipping to next track due to error');
                            player.play();
                        } else {
                            this.client.emit('queueEnd', player);
                        }
                    };

                    player.audioPlayer.once('error', errorHandler);

                    player.audioPlayer.once(AudioPlayerStatus.Idle, () => {
                        player.audioPlayer.removeListener('error', errorHandler);
                        this.client.emit('trackEnd', player, player.currentTrack);
                        
                        const loopMode = player.data?.loop || 'none';
                        
                        if (loopMode === 'track' && player.currentTrack) {
                            player.queue.tracks.unshift(player.currentTrack);
                            player.play();
                        } else if (loopMode === 'queue' && player.currentTrack) {
                            player.queue.tracks.push(player.currentTrack);
                            if (player.queue.tracks.length > 0) {
                                player.play();
                            }
                        } else if (player.queue.tracks.length > 0) {
                            player.play();
                        } else if (player.data?.autoplay) {
                            logger.info('Attempting autoplay...');
                        } else {
                            player.playing = false;
                            player.paused = false;
                            player.queue.current = null;
                            player.currentTrack = null;
                            this.client.emit('queueEnd', player);
                        }
                    });

                } catch (error) {
                    logger.error('Error playing track', error);
                    logger.debug('Failed track URI', { uri: player.currentTrack?.uri });
                    if (player.queue.tracks.length > 0) {
                        logger.info('Skipping to next track after error');
                        player.play();
                    } else {
                        player.playing = false;
                        player.paused = false;
                        player.queue.current = null;
                        player.currentTrack = null;
                        this.client.emit('queueEnd', player);
                    }
                }
            },

            stop: () => {
                player.audioPlayer.stop();
                player.playing = false;
            },

            skip: () => {
                player.previousTrack = player.currentTrack;
                player.audioPlayer.stop();
            },

            pause: (pause) => {
                if (pause) {
                    player.audioPlayer.pause();
                    player.paused = true;
                } else {
                    player.audioPlayer.unpause();
                    player.paused = false;
                }
            },

            destroy: () => {
                player.audioPlayer.stop();
                if (player.connection) {
                    player.connection.destroy();
                }
                if (player.preloadTimer) {
                    clearTimeout(player.preloadTimer);
                    player.preloadTimer = null;
                }
                this.players.delete(guild);
            },

            setVolume: (volume) => {
                player.volume = volume / 100;
                if (player.audioPlayer && player.audioPlayer.state.resource) {
                    const resource = player.audioPlayer.state.resource;
                    if (resource.volume) {
                        resource.volume.setVolume(volume / 100);
                    }
                }
            }
        };

        this.players.set(guild, player);
        return player;
    }

    get(guild) {
        return this.players.get(guild);
    }

    async search(query, requester) {
        try {
            const perf = logger.perf('Search Track');
            perf.start();
            
            logger.debug('Searching for track', { query });

            const isURL = query.includes('youtube.com') || query.includes('youtu.be');
            
            if (isURL) {
                logger.debug('Valid YouTube URL detected');
                const videoId = this.extractVideoId(query);
                const info = await this.youtube.getInfo(videoId);
                
                const track = {
                    title: info.basic_info.title || 'Unknown',
                    author: info.basic_info.author || 'Unknown',
                    uri: `https://www.youtube.com/watch?v=${videoId}`,
                    duration: info.basic_info.duration * 1000,
                    thumbnail: info.basic_info.thumbnail?.[0]?.url || '',
                    requester: requester
                };
                logger.info('Found video track', { title: track.title });
                perf.end();
                return {
                    loadType: 'TRACK_LOADED',
                    tracks: [track]
                };
            } else {
                const search = await this.youtube.search(query, { type: 'video' });
                logger.debug('Search results found', { count: search.videos?.length || 0 });
                
                if (!search.videos || search.videos.length === 0) {
                    perf.end();
                    return { loadType: 'NO_MATCHES' };
                }
                
                const video = search.videos[0];
                const track = {
                    title: video.title.text || 'Unknown',
                    author: video.author?.name || 'Unknown',
                    uri: `https://www.youtube.com/watch?v=${video.id}`,
                    duration: video.duration?.seconds * 1000 || 0,
                    thumbnail: video.thumbnails?.[0]?.url || '',
                    requester: requester
                };
                logger.info('Created track from search', { title: track.title });
                perf.end();
                return {
                    loadType: 'TRACK_LOADED',
                    tracks: [track]
                };
            }
        } catch (error) {
            logger.error('Search error', error);
            return { loadType: 'LOAD_FAILED' };
        }
    }
    
    extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : url;
    }

    async youtubeSearch(query) {
        try {
            const searchQuery = encodeURIComponent(query);
            const searchURL = `https://www.youtube.com/results?search_query=${searchQuery}`;
            
            const response = await fetch(searchURL);
            const html = await response.text();
            
            const videoRegex = /"videoId":"([^"]+)"/g;
            const titleRegex = /"title":{"runs":\[{"text":"([^"]+)"/g;
            const durationRegex = /"lengthText":{"simpleText":"([^"]+)"/g;
            const thumbnailRegex = /"url":"(https:\/\/i\.ytimg\.com\/vi\/[^"]+)"/g;
            
            const videoIds = [...html.matchAll(videoRegex)].map(match => match[1]).slice(0, 1);
            const titles = [...html.matchAll(titleRegex)].map(match => match[1]).slice(0, 1);
            const durations = [...html.matchAll(durationRegex)].map(match => match[1]).slice(0, 1);
            const thumbnails = [...html.matchAll(thumbnailRegex)].map(match => match[1]).slice(0, 1);
            
            const results = videoIds.map((id, index) => ({
                title: titles[index] || 'Unknown',
                author: 'YouTube',
                url: `https://www.youtube.com/watch?v=${id}`,
                duration: this.parseDuration(durations[index] || '0:00'),
                thumbnail: thumbnails[index] || ''
            }));
            
            return results;
        } catch (error) {
            console.error('❌ YouTube search error:', error.message);
            return [];
        }
    }

    parseDuration(duration) {
        const parts = duration.split(':').reverse();
        let seconds = 0;
        
        if (parts[0]) seconds += parseInt(parts[0]);
        if (parts[1]) seconds += parseInt(parts[1]) * 60;
        if (parts[2]) seconds += parseInt(parts[2]) * 3600;
        
        return seconds;
    }

    formatTrack(video, requester) {
        return {
            title: video.title || 'Unknown Title',
            author: video.author || 'Unknown',
            uri: video.url || video.video_url,
            duration: (video.duration || 0) * 1000,
            thumbnail: video.thumbnail || '',
            requester: requester
        };
    }

    async init() {
        try {
            const perf = logger.perf('Initialize YouTubei.js');
            perf.start();
            
            const poToken = process.env.YOUTUBE_PO_TOKEN;
            const visitorData = process.env.YOUTUBE_VISITOR_DATA;

            if (!poToken || !visitorData) {
                logger.warn('YouTube authentication tokens not found', {
                    hint: 'Run: node get-potoken.js to generate tokens'
                });
            }

            this.youtube = await Innertube.create({
                po_token: poToken,
                visitor_data: visitorData,
                generate_session_locally: true
            });
            
            logger.info('DirectStreamPlayer initialized successfully');
            logger.debug('Authentication tokens loaded', {
                hasPoToken: !!poToken,
                hasVisitorData: !!visitorData
            });
            
            perf.end();
        } catch (error) {
            logger.error('Failed to initialize YouTubei.js', error);
            throw error;
        }
    }

    parseCookieString(cookieString) {
        const cookieArray = [];
        const cookies = cookieString.split(';').map(c => c.trim());
        
        for (const cookie of cookies) {
            const [name, value] = cookie.split('=');
            if (name && value) {
                cookieArray.push({
                    name: name.trim(),
                    value: value.trim()
                });
            }
        }
        
        logger.debug(`Parsed ${cookieArray.length} cookies from string`);
        return cookieArray;
    }
}

module.exports = DirectStreamPlayer;
