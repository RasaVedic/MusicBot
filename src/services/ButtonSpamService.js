const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const firebaseState = require('./FirebaseStateManager');
const config = require('../config/config.json');
const emoji = require('../config/emoji.json');
const logger = require('../modules/@rasavedic').createModuleLogger('ButtonSpamService');

class ButtonSpamService {
    constructor() {
        this.userLastMessages = new Map();
    }

    async checkAndHandleSpam(interaction, buttonId) {
        if (!config.buttonSpam.enabled) {
            return { isSpam: false };
        }

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const member = interaction.member;

        const isMuted = await firebaseState.getMutedUser(guildId, userId);
        if (isMuted) {
            return { 
                isSpam: true, 
                isMuted: true,
                muteData: isMuted
            };
        }

        await firebaseState.trackButtonClick(guildId, userId, buttonId);

        const recentClicks = await firebaseState.getButtonClicks(
            guildId, 
            userId, 
            config.buttonSpam.timeWindow
        );

        if (recentClicks.length >= config.buttonSpam.maxClicks) {
            await this.handleSpammer(interaction, recentClicks.length);
            return { 
                isSpam: true, 
                clickCount: recentClicks.length,
                shouldMute: true
            };
        }

        return { 
            isSpam: false, 
            clickCount: recentClicks.length 
        };
    }

    async handleSpammer(interaction, clickCount) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const member = interaction.member;
        const guild = interaction.guild;

        const canMute = guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers);
        
        const durationMinutes = Math.floor(config.buttonSpam.muteDuration / 60000);
        const reason = `Auto-muted: Button spam detected (${clickCount} clicks in ${config.buttonSpam.timeWindow / 1000}s)`;

        // Send DM to user instead of spamming channel
        const dmEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`${emoji.warning} Button Spam Detected`)
            .setDescription(
                `You've been clicking buttons too quickly!\n\n` +
                `**Action:** ${canMute ? 'Temporarily Muted' : 'Warning'}\n` +
                `**Duration:** ${canMute ? durationMinutes + ' minutes' : 'N/A'}\n` +
                `**Button Clicks:** ${clickCount} in ${config.buttonSpam.timeWindow / 1000}s\n\n` +
                `Please wait before clicking buttons again.`
            )
            .setTimestamp();

        if (canMute) {
            try {
                await member.timeout(config.buttonSpam.muteDuration, reason);
                
                await firebaseState.saveMutedUser(
                    guildId, 
                    userId, 
                    reason, 
                    config.buttonSpam.muteDuration,
                    'AutoMod'
                );

                logger.info(`Auto-muted user ${userId} in guild ${guildId} for button spam`);

                // Try to DM the user
                try {
                    await member.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    logger.debug('Could not DM user about button spam');
                }

                setTimeout(async () => {
                    await firebaseState.removeMutedUser(guildId, userId);
                    await firebaseState.clearButtonSpam(guildId, userId);
                    logger.info(`Unmuted user ${userId} in guild ${guildId} after timeout`);
                }, config.buttonSpam.muteDuration);

            } catch (error) {
                logger.error('Failed to mute user for button spam:', error);
            }
        } else {
            // Just log and DM, don't spam channel
            logger.warn(`User ${userId} button spamming in guild ${guildId} but bot cannot mute`);
            try {
                await member.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                logger.debug('Could not DM user about button spam');
            }
        }
    }

    async deleteOldButtonMessage(interaction) {
        if (!config.buttonSpam.autoDeleteOldMessages) {
            return;
        }

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const key = `${guildId}_${userId}`;

        const oldMessage = this.userLastMessages.get(key);
        if (oldMessage) {
            try {
                await oldMessage.delete().catch(() => {});
            } catch (error) {
            }
        }
    }

    setLastMessage(interaction, message) {
        if (!config.buttonSpam.autoDeleteOldMessages) {
            return;
        }

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const key = `${guildId}_${userId}`;

        this.userLastMessages.set(key, message);

        setTimeout(() => {
            this.userLastMessages.delete(key);
        }, 30000);
    }

    async isUserMuted(guildId, userId) {
        const muteData = await firebaseState.getMutedUser(guildId, userId);
        return muteData !== null;
    }
}

module.exports = new ButtonSpamService();
