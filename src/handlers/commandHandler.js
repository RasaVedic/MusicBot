const fs = require('fs');
const path = require('path');
const logger = require('../modules/@rasavedic').createModuleLogger('CommandHandler');
const debugLogger = require('../utils/debugLogger');
const cooldownHandler = require('../utils/cooldownHandler');

function loadCommands(client) {
    client.commands = new Map();
    
    const commandFolders = fs.readdirSync('./src/commands');
    
    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(`./src/commands/${folder}`).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = require(`../commands/${folder}/${file}`);
            client.commands.set(command.name, command);
            
            if (command.aliases) {
                command.aliases.forEach(alias => {
                    client.commands.set(alias, command);
                });
            }
            
            logger.info(`Loaded command: ${command.name}`);
        }
    }
}

async function handleCommand(client, message, serverSettings) {
    const botOwnerId = process.env.OWNER_ID;
    let prefix = await serverSettings.getPrefix(message.guild.id);
    
    let content = message.content;
    let usedPrefix = prefix;
    
    if (message.author.id === botOwnerId) {
        if (!message.content.startsWith(prefix)) {
            usedPrefix = '';
        }
    } else {
        if (!message.content.startsWith(prefix)) return;
    }
    
    const args = content.slice(usedPrefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = client.commands.get(commandName);
    
    if (!command) return;
    
    // Check cooldown (skip for bot owner)
    if (message.author.id !== botOwnerId) {
        const cooldownCheck = cooldownHandler.checkCooldown(
            message.author.id,
            command.name,
            command.category
        );
        
        if (cooldownCheck.onCooldown) {
            const { EmbedBuilder } = require('discord.js');
            const emoji = require('../config/emoji.json');
            const config = require('../config/config.json');
            
            const cooldownEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please wait **${cooldownCheck.timeLeft}s** before using this command again.`);
            
            const reply = await message.reply({ embeds: [cooldownEmbed] });
            
            setTimeout(async () => {
                try {
                    await reply.delete();
                    await message.delete();
                } catch (err) {}
            }, 3000);
            
            return;
        }
    }
    
    const startTime = Date.now();
    
    debugLogger.logCommand(commandName, message.author, message, {
        prefix: usedPrefix,
        args: args,
        actualCommand: command.name
    });
    
    try {
        await command.execute(client, message, args, serverSettings);
        
        // Set cooldown after successful execution (skip for bot owner)
        if (message.author.id !== botOwnerId) {
            cooldownHandler.setCooldown(
                message.author.id,
                command.name,
                command.category
            );
        }
        
        const executionTime = Date.now() - startTime;
        
        debugLogger.logCommandOutput(commandName, { success: true }, message, {
            executionTime,
            category: command.category || 'unknown'
        });
        
        debugLogger.logPerformance(commandName, executionTime, {
            messageId: message.id,
            guildId: message.guild.id,
            userId: message.author.id
        });
    } catch (error) {
        const errorId = await client.errorHandler.handle(error, {
            type: 'command',
            commandName,
            guildId: message.guild.id,
            userId: message.author.id,
            channelId: message.channel.id
        });
        
        logger.error(`Error executing command ${commandName} (ID: ${errorId})`, error);
        
        debugLogger.logCommandError(commandName, error, message, {
            errorId,
            executionTime: Date.now() - startTime
        });
        
        const { EmbedBuilder } = require('discord.js');
        const emoji = require('../config/emoji.json');
        const config = require('../config/config.json');
        
        const errorMessage = process.env.DEBUG_SHOW_ERROR_DETAILS === 'true'
            ? `${emoji.error} An error occurred: ${error.message}\nError ID: ${errorId}`
            : `${emoji.error} An error occurred while executing this command.\nError ID: ${errorId}`;
        
        const errorEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(errorMessage);
        
        const reply = await message.reply({ embeds: [errorEmbed] });
        
        setTimeout(async () => {
            try {
                await reply.delete();
            } catch (err) {
                logger.warn('Failed to delete error message', { error: err.message });
            }
        }, config.autoDeleteTime);
    }
}

module.exports = { loadCommands, handleCommand };
