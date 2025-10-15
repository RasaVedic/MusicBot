const LavalinkManager = require('./LavalinkManager');
const logger = require('./@rasavedic').createModuleLogger('MusicManager');

class MusicManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        
        this.lavalinkManager = new LavalinkManager(client, config);
        logger.info('MusicManager initialized with Lavalink');
    }

    async init() {
        logger.info('MusicManager initialization complete');
    }

    get players() {
        return this.lavalinkManager.kazagumo.players;
    }

    create(options) {
        const { guild, voiceChannel, textChannel, selfDeafen } = options;
        
        return this.lavalinkManager.kazagumo.createPlayer({
            guildId: guild,
            textId: textChannel,
            voiceId: voiceChannel,
            volume: this.config.music.defaultVolume || 80,
            deaf: selfDeafen !== false
        });
    }

    get(guildId) {
        return this.lavalinkManager.kazagumo.players.get(guildId);
    }

    async search(query, requester) {
        try {
            const result = await this.lavalinkManager.kazagumo.search(query, { requester });
            return result;
        } catch (error) {
            logger.error('Search failed', error);
            throw error;
        }
    }
}

module.exports = MusicManager;
