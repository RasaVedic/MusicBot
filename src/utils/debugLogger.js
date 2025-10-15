const debugSettings = require('../config/debugSettings.json');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class DebugLogger {
    constructor() {
        this.settings = debugSettings;
        this.logBuffer = [];
        
        if (this.settings.debugMode.logToFile) {
            const logDir = path.dirname(this.settings.debugMode.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
    }

    formatTimestamp() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + istOffset);
        
        const day = String(istTime.getUTCDate()).padStart(2, '0');
        const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
        const hours = String(istTime.getUTCHours()).padStart(2, '0');
        const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
        const ms = String(istTime.getUTCMilliseconds()).padStart(3, '0');
        
        return `${day}/${month} ${hours}:${minutes}:${seconds}.${ms}`;
    }

    log(category, type, message, data = {}) {
        if (!this.settings.debugMode.enabled) return;
        
        const categorySettings = this.settings[category];
        if (!categorySettings || !categorySettings.enabled) return;

        const timestamp = this.formatTimestamp();
        const logEntry = {
            timestamp,
            category,
            type,
            message,
            ...data
        };

        const coloredMessage = this.colorize(category, type, message, data);
        console.log(coloredMessage);

        if (this.settings.debugMode.logToFile) {
            this.writeToFile(logEntry);
        }
    }

    colorize(category, type, message, data) {
        const timestamp = chalk.magenta(`[${this.formatTimestamp()}]`);
        const categoryTag = chalk.cyan(`[${category.toUpperCase()}]`);
        const typeTag = this.getTypeColor(type)(`[${type}]`);
        
        let output = `${timestamp} ${categoryTag} ${typeTag} ${message}`;
        
        if (Object.keys(data).length > 0) {
            const dataStr = JSON.stringify(data, null, 2);
            output += `\n${chalk.gray(dataStr)}`;
        }
        
        return output;
    }

    getTypeColor(type) {
        const colors = {
            'INPUT': chalk.blue,
            'OUTPUT': chalk.green,
            'ERROR': chalk.red.bold,
            'WARNING': chalk.yellow,
            'INFO': chalk.white,
            'SUCCESS': chalk.green.bold,
            'INTERACTION': chalk.magenta,
            'STATE': chalk.cyan
        };
        return colors[type] || chalk.white;
    }

    writeToFile(logEntry) {
        const logLine = JSON.stringify(logEntry) + '\n';
        fs.appendFileSync(this.settings.debugMode.logFilePath, logLine, 'utf8');
    }

    logCommand(commandName, user, message, data = {}) {
        if (!this.settings.commands.enabled) return;

        const logData = {};
        
        if (this.settings.commands.includeMessageId) {
            logData.messageId = message.id;
        }
        if (this.settings.commands.includeUserId) {
            logData.userId = user.id;
            logData.username = user.tag;
        }
        if (this.settings.commands.includeGuildId) {
            logData.guildId = message.guild?.id;
            logData.guildName = message.guild?.name;
        }
        if (this.settings.commands.logInput) {
            logData.input = message.content;
            logData.args = message.content.split(' ').slice(1);
        }

        this.log('commands', 'INPUT', `Command executed: ${commandName}`, { ...logData, ...data });
    }

    logCommandOutput(commandName, result, message, data = {}) {
        if (!this.settings.commands.enabled || !this.settings.commands.logOutput) return;

        const logData = {
            command: commandName,
            success: result.success !== false,
            messageId: message.id
        };

        if (result.embed) {
            logData.embedTitle = result.embed.data?.title;
            logData.embedDescription = result.embed.data?.description;
        }

        if (result.content) {
            logData.content = result.content;
        }

        this.log('commands', 'OUTPUT', `Command response: ${commandName}`, { ...logData, ...data });
    }

    logCommandError(commandName, error, message, data = {}) {
        if (!this.settings.commands.enabled || !this.settings.commands.logErrors) return;

        const logData = {
            command: commandName,
            error: error.message,
            stack: error.stack,
            messageId: message.id,
            userId: message.author.id,
            guildId: message.guild?.id
        };

        this.log('commands', 'ERROR', `Command error: ${commandName}`, { ...logData, ...data });
    }

    logButton(buttonId, user, interaction, data = {}) {
        if (!this.settings.buttons.enabled) return;

        const logData = {};
        
        if (this.settings.buttons.includeMessageId) {
            logData.messageId = interaction.message.id;
        }
        if (this.settings.buttons.includeUserId) {
            logData.userId = user.id;
            logData.username = user.tag;
        }
        if (this.settings.buttons.logButtonId) {
            logData.buttonId = buttonId;
            logData.customId = interaction.customId;
        }

        this.log('buttons', 'INTERACTION', `Button clicked: ${buttonId}`, { ...logData, ...data });
    }

    logButtonAction(buttonId, action, player, data = {}) {
        if (!this.settings.buttons.enabled || !this.settings.buttons.logUserAction) return;

        const logData = {
            button: buttonId,
            action: action
        };

        if (this.settings.buttons.logPlayerState && player) {
            logData.playerState = {
                playing: player.playing,
                paused: player.paused,
                queueLength: player.queue?.length || 0,
                autoplay: player.data?.autoplay,
                loop: player.data?.loop,
                currentTrack: player.queue?.current?.title
            };
        }

        this.log('buttons', 'STATE', `Button action: ${action}`, { ...logData, ...data });
    }

    logBotReply(message, channel, reason, data = {}) {
        if (!this.settings.botReplies.enabled) return;

        const logData = {};
        
        if (this.settings.botReplies.includeMessageId) {
            logData.messageId = message.id;
        }
        if (this.settings.botReplies.includeChannelId) {
            logData.channelId = channel.id;
            logData.channelName = channel.name;
        }
        if (this.settings.botReplies.logContent && message.content) {
            logData.content = message.content.substring(0, 200);
        }
        if (this.settings.botReplies.logEmbed && message.embeds?.length > 0) {
            logData.embedCount = message.embeds.length;
            logData.embedTitles = message.embeds.map(e => e.title).filter(Boolean);
        }
        if (this.settings.botReplies.logReason) {
            logData.reason = reason;
        }

        this.log('botReplies', 'OUTPUT', 'Bot sent message', { ...logData, ...data });
    }

    logMusicEvent(eventType, player, track, data = {}) {
        if (!this.settings.musicEvents.enabled) return;

        const logData = {
            event: eventType,
            guildId: player.guildId
        };

        if (this.settings.musicEvents.includeTrackDetails && track) {
            logData.track = {
                title: track.title,
                author: track.author,
                duration: track.length,
                uri: track.uri
            };
        }

        if (this.settings.musicEvents.logPlayerState) {
            logData.playerState = {
                playing: player.playing,
                paused: player.paused,
                position: player.position,
                queueLength: player.queue?.length || 0,
                autoplay: player.data?.autoplay,
                manualSkip: player.data?.manualSkip
            };
        }

        this.log('musicEvents', 'INFO', `Music event: ${eventType}`, { ...logData, ...data });
    }

    logMessageEvent(eventType, message, data = {}) {
        if (!this.settings.messageEvents.enabled) return;

        const eventEnabled = this.settings.messageEvents[`log${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`];
        if (!eventEnabled) return;

        const logData = {
            event: eventType
        };

        if (this.settings.messageEvents.includeMessageId) {
            logData.messageId = message.id;
        }
        if (this.settings.messageEvents.includeMessageContent && message.content) {
            logData.content = message.content.substring(0, 200);
        }
        
        logData.authorId = message.author?.id;
        logData.authorTag = message.author?.tag;
        logData.channelId = message.channel?.id;
        logData.guildId = message.guild?.id;

        this.log('messageEvents', 'INFO', `Message event: ${eventType}`, { ...logData, ...data });
    }

    logVoiceEvent(eventType, oldState, newState, data = {}) {
        if (!this.settings.voiceEvents.enabled) return;

        const logData = {
            event: eventType,
            userId: newState.id,
            username: newState.member?.user?.tag
        };

        if (this.settings.voiceEvents.includeChannelInfo) {
            if (oldState.channel) {
                logData.oldChannel = {
                    id: oldState.channel.id,
                    name: oldState.channel.name
                };
            }
            if (newState.channel) {
                logData.newChannel = {
                    id: newState.channel.id,
                    name: newState.channel.name
                };
            }
        }

        this.log('voiceEvents', 'INFO', `Voice event: ${eventType}`, { ...logData, ...data });
    }

    logError(error, context, data = {}) {
        if (!this.settings.errors.enabled) return;

        const logData = {
            errorMessage: error.message,
            errorName: error.name
        };

        if (this.settings.errors.logStackTrace) {
            logData.stack = error.stack;
        }
        if (this.settings.errors.logErrorContext) {
            logData.context = context;
        }

        this.log('errors', 'ERROR', `Error occurred: ${error.message}`, { ...logData, ...data });
    }

    logPerformance(operation, duration, data = {}) {
        if (!this.settings.performance.enabled) return;

        const isSlow = duration > this.settings.performance.slowCommandThreshold;
        
        if (this.settings.performance.logSlowCommands && isSlow) {
            this.log('performance', 'WARNING', `Slow operation: ${operation} (${duration}ms)`, { duration, ...data });
        } else {
            this.log('performance', 'INFO', `Operation: ${operation} (${duration}ms)`, { duration, ...data });
        }
    }

    logFirebase(operation, success, data = {}) {
        if (!this.settings.firebase.enabled) return;

        const logData = {
            operation,
            success
        };

        const type = success ? 'INFO' : 'ERROR';
        this.log('firebase', type, `Firebase ${operation}`, { ...logData, ...data });
    }

    logSpam(userId, action, data = {}) {
        if (!this.settings.spam.enabled) return;

        const logData = {
            action
        };

        if (this.settings.spam.includeUserInfo) {
            logData.userId = userId;
        }

        this.log('spam', 'WARNING', `Spam detection: ${action}`, { ...logData, ...data });
    }
}

module.exports = new DebugLogger();
