const { Client, GatewayIntentBits } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const ServerSettings = require('./classes/ServerSettings');
const MusicPlayer = require('./modules/MusicPlayer');
const MusicManager = require('./modules/MusicManager');
const config = require('./config/config.json');
require('dotenv').config();

const debugLogger = require('./modules/@rasavedic');
const errorHandler = require('./modules/@rasavedic/errorHandler');
const dataManager = require('./modules/@rasavedic/dataManager');
const logger = debugLogger.createModuleLogger('BotMain');

const localStorage = require('./services/LocalStorageManager');
const voiceConnectionManager = require('./services/VoiceConnectionManager');
const crashRecovery = require('./services/CrashRecoveryService');
const messageCleanup = require('./services/MessageCleanupService');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

logger.info('Initializing Discord bot...');

client.serverSettings = new ServerSettings();
client.musicPlayer = new MusicPlayer(client);
client.debugLogger = debugLogger;
client.errorHandler = errorHandler;
client.dataManager = dataManager;
client.localStorage = localStorage;
client.voiceConnectionManager = voiceConnectionManager;

const musicManager = new MusicManager(client, config);
client.manager = musicManager;

logger.info('Loading commands and events...');
loadCommands(client);
loadEvents(client);

async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
        voiceConnectionManager.clearAllHandlers();
        
        localStorage.clear();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('beforeExit', () => gracefulShutdown('beforeExit'));

client.once('clientReady', async () => {
    logger.info(`Bot logged in as ${client.user.tag}`);
    
    // Initialize local storage and cleanup old data
    localStorage.init();
    
    // Attempt to recover any active player states after crash/restart
    logger.info('Checking for active states to recover...');
    setTimeout(async () => {
        try {
            await crashRecovery.recoverAllActiveStates(client);
        } catch (error) {
            logger.error('Failed to recover active states', error);
        }
    }, 5000);
    
    // Start auto cleanup of old messages every 30 minutes
    messageCleanup.startAutoCleanup(client, 30 * 60 * 1000);
    
    logger.info('✅ Bot initialized successfully');
});

logger.info('Logging in to Discord...');
client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    logger.error('Failed to login to Discord', err);
    console.log('\n⚠️  Please set your DISCORD_BOT_TOKEN in Replit Secrets');
    process.exit(1);
});
