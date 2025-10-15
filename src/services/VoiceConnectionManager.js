const { VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const logger = require('../modules/@rasavedic').createModuleLogger('VoiceConnectionManager');
const firebaseState = require('./FirebaseStateManager');

class VoiceConnectionManager {
  constructor() {
    this.retryAttempts = new Map();
    this.maxRetries = 5;
    this.baseRetryDelay = 1000;
    this.maxRetryDelay = 30000;
    this.reconnectHandlers = new Map();
    this.disconnectReasons = new Map();
  }

  calculateRetryDelay(attemptNumber) {
    const exponentialDelay = this.baseRetryDelay * Math.pow(2, attemptNumber);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, this.maxRetryDelay);
  }

  async setupConnectionHandlers(connection, guildId, channelId, player) {
    const handlerId = `${guildId}_${channelId}`;
    
    if (this.reconnectHandlers.has(handlerId)) {
      this.clearConnectionHandlers(handlerId);
    }

    const disconnectHandler = async (oldState, newState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        const disconnectReason = newState.reason || 'Unknown reason';
        const handlerId = `${guildId}_${channelId}`;
        
        this.disconnectReasons.set(handlerId, {
          reason: disconnectReason,
          oldStatus: oldState.status,
          newStatus: newState.status,
          timestamp: Date.now()
        });
        
        logger.warn(`🔴 Voice connection disconnected`, {
          guild: guildId,
          channel: channelId,
          oldStatus: oldState.status,
          newStatus: newState.status,
          reason: disconnectReason,
          closeCode: newState.closeCode || 'N/A'
        });

        try {
          await firebaseState.saveDisconnectHistory(guildId, 'voice_disconnected', {
            voiceChannelId: channelId,
            reason: disconnectReason,
            oldStatus: oldState.status,
            newStatus: newState.status,
            closeCode: newState.closeCode,
            timestamp: Date.now()
          });
        } catch (error) {
          logger.error('Failed to save voice disconnect history', error);
        }

        await this.handleDisconnection(connection, guildId, channelId, player);
      } else if (newState.status === VoiceConnectionStatus.Destroyed) {
        logger.info(`🗑️ Voice connection destroyed in guild ${guildId}`);
        this.clearConnectionHandlers(handlerId);
      }
    };

    const readyHandler = async () => {
      logger.info(`Voice connection ready in guild ${guildId}`);
      this.retryAttempts.delete(handlerId);
    };

    const errorHandler = async (error) => {
      logger.error(`Voice connection error in guild ${guildId}`, error);
    };

    connection.on('stateChange', disconnectHandler);
    connection.on(VoiceConnectionStatus.Ready, readyHandler);
    connection.on('error', errorHandler);

    this.reconnectHandlers.set(handlerId, {
      disconnectHandler,
      readyHandler,
      errorHandler,
      connection
    });

    logger.debug(`Connection handlers setup for ${handlerId}`);
  }

  async handleDisconnection(connection, guildId, channelId, player) {
    const handlerId = `${guildId}_${channelId}`;
    const attemptNumber = this.retryAttempts.get(handlerId) || 0;
    const disconnectInfo = this.disconnectReasons.get(handlerId);

    if (attemptNumber >= this.maxRetries) {
      logger.error(`❌ Max retry attempts (${this.maxRetries}) reached for guild ${guildId}`, {
        totalAttempts: attemptNumber,
        disconnectReason: disconnectInfo?.reason || 'Unknown',
        action: 'Destroying player'
      });

      try {
        await firebaseState.saveDisconnectHistory(guildId, 'max_retries_reached', {
          voiceChannelId: channelId,
          retryAttempts: attemptNumber,
          disconnectReason: disconnectInfo?.reason,
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('Failed to save max retries history', error);
      }

      if (player && typeof player.destroy === 'function') {
        player.destroy();
      }
      
      this.retryAttempts.delete(handlerId);
      this.disconnectReasons.delete(handlerId);
      this.clearConnectionHandlers(handlerId);
      return;
    }

    this.retryAttempts.set(handlerId, attemptNumber + 1);
    const retryDelay = this.calculateRetryDelay(attemptNumber);

    logger.info(`🔄 Attempting reconnection (${attemptNumber + 1}/${this.maxRetries})`, {
      guild: guildId,
      delayMs: retryDelay,
      reason: disconnectInfo?.reason || 'Unknown'
    });

    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, retryDelay),
        entersState(connection, VoiceConnectionStatus.Connecting, retryDelay),
        entersState(connection, VoiceConnectionStatus.Ready, retryDelay)
      ]);
      
      logger.info(`✅ Reconnection successful for guild ${guildId}`, {
        attemptNumber: attemptNumber + 1,
        totalDelay: retryDelay
      });
      
      this.retryAttempts.delete(handlerId);
      this.disconnectReasons.delete(handlerId);

    } catch (error) {
      logger.error(`❌ Reconnection attempt ${attemptNumber + 1} failed`, {
        guild: guildId,
        error: error.message,
        nextRetryIn: retryDelay
      });
      
      setTimeout(() => {
        if (connection.state.status === VoiceConnectionStatus.Disconnected) {
          this.handleDisconnection(connection, guildId, channelId, player);
        }
      }, retryDelay);
    }
  }

  clearConnectionHandlers(handlerId) {
    const handlers = this.reconnectHandlers.get(handlerId);
    if (handlers) {
      const { connection, disconnectHandler, readyHandler, errorHandler } = handlers;
      
      connection.off('stateChange', disconnectHandler);
      connection.off(VoiceConnectionStatus.Ready, readyHandler);
      connection.off('error', errorHandler);
      
      this.reconnectHandlers.delete(handlerId);
      this.retryAttempts.delete(handlerId);
      this.disconnectReasons.delete(handlerId);
      
      logger.debug(`🧹 Cleared connection handlers for ${handlerId}`);
    }
  }

  clearAllHandlers() {
    for (const [handlerId] of this.reconnectHandlers) {
      this.clearConnectionHandlers(handlerId);
    }
    logger.info('Cleared all voice connection handlers');
  }

  getRetryAttempts(guildId, channelId) {
    const handlerId = `${guildId}_${channelId}`;
    return this.retryAttempts.get(handlerId) || 0;
  }

  resetRetryAttempts(guildId, channelId) {
    const handlerId = `${guildId}_${channelId}`;
    this.retryAttempts.delete(handlerId);
    logger.debug(`Reset retry attempts for ${handlerId}`);
  }
}

module.exports = new VoiceConnectionManager();
