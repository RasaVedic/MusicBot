const { db } = require('../config/firebase');
const logger = require('../modules/@rasavedic').createModuleLogger('FirebaseStateManager');

class FirebaseStateManager {
    constructor() {
        this.collections = {
            playerStates: 'playerStates',
            queues: 'queues',
            messages: 'messages',
            userActivity: 'userActivity',
            previousTracks: 'previousTracks',
            disconnectHistory: 'disconnectHistory',
            guildConfig: 'guildConfig',
            buttonSpam: 'buttonSpam',
            mutedUsers: 'mutedUsers',
            moderationLogs: 'moderationLogs',
            guildLeaves: 'guildLeaves'
        };
    }
    
    async logModerationAction(guildId, actionData) {
        try {
            const logData = {
                guildId,
                type: actionData.type,
                targetUserId: actionData.targetUserId,
                targetUserTag: actionData.targetUserTag,
                moderatorId: actionData.moderatorId,
                moderatorTag: actionData.moderatorTag,
                reason: actionData.reason || 'No reason provided',
                duration: actionData.duration || null,
                timestamp: Date.now(),
                active: actionData.active !== undefined ? actionData.active : true,
                expiresAt: actionData.expiresAt || null
            };
            
            const docRef = await db.collection(this.collections.moderationLogs).add(logData);
            logger.debug(`Logged moderation action: ${actionData.type} for user ${actionData.targetUserId} in guild ${guildId}`);
            return docRef.id;
        } catch (error) {
            logger.error(`Failed to log moderation action`, error);
            return null;
        }
    }
    
    async getModerationLogs(guildId, options = {}) {
        try {
            let query = db.collection(this.collections.moderationLogs)
                .where('guildId', '==', guildId);
            
            if (options.type) {
                query = query.where('type', '==', options.type);
            }
            
            if (options.targetUserId) {
                query = query.where('targetUserId', '==', options.targetUserId);
            }
            
            if (options.activeOnly) {
                query = query.where('active', '==', true);
            }
            
            query = query.orderBy('timestamp', 'desc');
            
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            const snapshot = await query.get();
            const logs = [];
            
            snapshot.forEach(doc => {
                logs.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return logs;
        } catch (error) {
            logger.error(`Failed to get moderation logs`, error);
            return [];
        }
    }
    
    async deactivateModerationLog(logId) {
        try {
            await db.collection(this.collections.moderationLogs)
                .doc(logId)
                .update({ active: false, deactivatedAt: Date.now() });
            logger.debug(`Deactivated moderation log: ${logId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to deactivate moderation log`, error);
            return false;
        }
    }
    
    async logGuildLeave(guildId, guildName, reason, memberCount) {
        try {
            const leaveData = {
                guildId,
                guildName,
                reason: reason || 'Unknown',
                memberCount: memberCount || 0,
                leftAt: Date.now(),
                timestamp: new Date().toISOString()
            };
            
            await db.collection(this.collections.guildLeaves).add(leaveData);
            logger.info(`Logged guild leave: ${guildName} (${guildId}) - Reason: ${reason}`);
            return true;
        } catch (error) {
            logger.error(`Failed to log guild leave`, error);
            return false;
        }
    }
    
    async getGuildLeaveHistory(limit = 50) {
        try {
            const snapshot = await db.collection(this.collections.guildLeaves)
                .orderBy('leftAt', 'desc')
                .limit(limit)
                .get();
            
            const history = [];
            snapshot.forEach(doc => {
                history.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return history;
        } catch (error) {
            logger.error(`Failed to get guild leave history`, error);
            return [];
        }
    }

    async savePlayerState(guildId, playerState) {
        try {
            // Helper function to remove undefined values deeply
            const removeUndefined = (obj) => {
                if (obj === null || obj === undefined) {
                    return null;
                }
                
                if (typeof obj !== 'object') {
                    return obj;
                }
                
                if (Array.isArray(obj)) {
                    return obj.map(item => removeUndefined(item)).filter(item => item !== undefined && item !== null);
                }
                
                const cleaned = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (value !== undefined && value !== null) {
                        if (typeof value === 'object') {
                            const cleanedValue = removeUndefined(value);
                            // Keep empty arrays and objects, only reject null/undefined
                            if (cleanedValue !== null && cleanedValue !== undefined) {
                                cleaned[key] = cleanedValue;
                            } else if (Array.isArray(value) && value.length === 0) {
                                cleaned[key] = [];
                            } else if (!Array.isArray(value) && typeof value === 'object' && Object.keys(value).length === 0) {
                                cleaned[key] = {};
                            }
                        } else {
                            cleaned[key] = value;
                        }
                    }
                }
                return cleaned;
            };

            // Build currentTrack object safely
            let currentTrack = null;
            if (playerState.currentTrack) {
                const track = playerState.currentTrack;
                currentTrack = {
                    title: track.title || 'Unknown',
                    uri: track.uri || track.url || '',
                    author: track.author || 'Unknown',
                    length: track.length || track.duration || 0,
                    thumbnail: track.thumbnail || track.artworkUrl || '',
                    sourceName: track.sourceName || track.source || 'YouTube',
                    identifier: track.identifier || ''
                };

                // Only add requester if it exists and has valid data
                if (track.requester && (track.requester.id || track.requester.username)) {
                    currentTrack.requester = {
                        id: track.requester.id || 'system',
                        username: track.requester.username || 'System',
                        tag: track.requester.tag || track.requester.username || 'System'
                    };
                }
            }

            const state = {
                guildId,
                voiceChannelId: playerState.voiceChannelId || playerState.voiceChannel || playerState.voiceId || '',
                textChannelId: playerState.textChannelId || playerState.textChannel || playerState.textId || '',
                volume: playerState.volume || 50,
                paused: playerState.paused === true,
                autoplay: playerState.data?.autoplay === true,
                loop: playerState.data?.loop || 'none',
                equalizer: playerState.data?.equalizer || 'flat',
                currentTrack: currentTrack,
                position: playerState.position || 0,
                lastUpdated: new Date().toISOString(),
                active: true
            };

            // Remove any remaining undefined values
            const cleanedState = removeUndefined(state);

            if (!cleanedState || !cleanedState.guildId) {
                logger.error('Invalid state data, skipping save');
                return false;
            }

            await db.collection(this.collections.playerStates).doc(guildId).set(cleanedState);
            logger.debug(`Saved player state for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to save player state for guild ${guildId}`, error);
            logger.warn('⚠️ Firebase may not be configured. Music will still work but state won\'t persist after restart.');
            return false;
        }
    }

    async getPlayerState(guildId) {
        try {
            const doc = await db.collection(this.collections.playerStates).doc(guildId).get();
            if (doc.exists) {
                const state = doc.data();
                // Check if state is not too old (older than 24 hours)
                const lastUpdated = new Date(state.lastUpdated);
                const now = new Date();
                const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);
                
                if (hoursDiff > 24 || !state.active) {
                    logger.debug(`Player state for guild ${guildId} is too old or inactive`);
                    return null;
                }
                
                return state;
            }
            return null;
        } catch (error) {
            logger.error(`Failed to get player state for guild ${guildId}`, error);
            return null;
        }
    }

    async deletePlayerState(guildId) {
        try {
            await db.collection(this.collections.playerStates).doc(guildId).update({ active: false });
            logger.debug(`Marked player state as inactive for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete player state for guild ${guildId}`, error);
            return false;
        }
    }

    async saveQueue(guildId, queue) {
        try {
            // Convert queue to proper array and filter out undefined/null values
            const queueArray = [];
            if (queue && queue.length > 0) {
                for (let i = 0; i < queue.length; i++) {
                    const track = queue[i];
                    if (track && typeof track === 'object') {
                        queueArray.push(track);
                    }
                }
            }
            
            // Safely map queue tracks and remove undefined values
            const tracks = queueArray.map(track => {
                const safeTrack = {
                    title: track.title || 'Unknown',
                    uri: track.uri || track.url || '',
                    author: track.author || 'Unknown',
                    length: track.length || track.duration || 0,
                    thumbnail: track.thumbnail || track.artworkUrl || '',
                    sourceName: track.sourceName || track.source || 'YouTube',
                    identifier: track.identifier || ''
                };

                // Only add requester if valid
                if (track.requester && (track.requester.id || track.requester.username)) {
                    safeTrack.requester = {
                        id: track.requester.id || 'system',
                        username: track.requester.username || 'System',
                        tag: track.requester.tag || track.requester.username || 'System'
                    };
                }

                return safeTrack;
            }).filter(track => track && track.title && track.uri);

            const queueData = {
                guildId,
                tracks: tracks,
                totalTracks: tracks.length,
                lastUpdated: new Date().toISOString()
            };

            await db.collection(this.collections.queues).doc(guildId).set(queueData);
            logger.debug(`Saved queue for guild ${guildId} with ${tracks.length} tracks`);
            return true;
        } catch (error) {
            logger.error(`Failed to save queue for guild ${guildId}`, error);
            return false;
        }
    }

    async getQueue(guildId) {
        try {
            const doc = await db.collection(this.collections.queues).doc(guildId).get();
            if (doc.exists) {
                return doc.data().tracks || [];
            }
            return [];
        } catch (error) {
            logger.error(`Failed to get queue for guild ${guildId}`, error);
            return [];
        }
    }

    async deleteQueue(guildId) {
        try {
            await db.collection(this.collections.queues).doc(guildId).delete();
            logger.debug(`Deleted queue for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete queue for guild ${guildId}`, error);
            return false;
        }
    }

    async saveMessage(guildId, messageType, messageData) {
        try {
            const docId = `${guildId}_${messageType}`;
            const data = {
                guildId,
                messageType,
                messageId: messageData.id,
                channelId: messageData.channelId || messageData.channel?.id,
                content: messageData.content || null,
                timestamp: new Date().toISOString()
            };

            await db.collection(this.collections.messages).doc(docId).set(data);
            logger.debug(`Saved ${messageType} message for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to save message for guild ${guildId}`, error);
            return false;
        }
    }

    async getMessage(guildId, messageType) {
        try {
            const docId = `${guildId}_${messageType}`;
            const doc = await db.collection(this.collections.messages).doc(docId).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            logger.error(`Failed to get message for guild ${guildId}`, error);
            return null;
        }
    }

    async deleteMessage(guildId, messageType) {
        try {
            const docId = `${guildId}_${messageType}`;
            await db.collection(this.collections.messages).doc(docId).delete();
            logger.debug(`Deleted ${messageType} message for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete message for guild ${guildId}`, error);
            return false;
        }
    }

    async saveUserActivity(userId, guildId, activity) {
        try {
            const docId = `${guildId}_${userId}`;
            const data = {
                userId,
                guildId,
                lastTrackPlayed: activity.trackTitle || null,
                lastTrackUri: activity.trackUri || null,
                totalTracksPlayed: activity.totalTracksPlayed || 0,
                lastActive: new Date().toISOString()
            };

            await db.collection(this.collections.userActivity).doc(docId).set(data, { merge: true });
            logger.debug(`Saved user activity for user ${userId} in guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to save user activity`, error);
            return false;
        }
    }

    async getUserActivity(userId, guildId) {
        try {
            const docId = `${guildId}_${userId}`;
            const doc = await db.collection(this.collections.userActivity).doc(docId).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            logger.error(`Failed to get user activity`, error);
            return null;
        }
    }

    async getAllActivePlayerStates() {
        try {
            const snapshot = await db.collection(this.collections.playerStates)
                .where('active', '==', true)
                .get();
            
            const states = [];
            snapshot.forEach(doc => {
                states.push(doc.data());
            });
            
            return states;
        } catch (error) {
            logger.error('Failed to get all active player states', error);
            return [];
        }
    }

    async cleanupOldData(hoursOld = 24) {
        try {
            const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();
            let totalDeleted = 0;
            
            // Cleanup old player states
            const playerStatesSnapshot = await db.collection(this.collections.playerStates)
                .where('lastUpdated', '<', cutoffTime)
                .get();
            
            const batch1 = db.batch();
            playerStatesSnapshot.forEach(doc => {
                batch1.delete(doc.ref);
            });
            await batch1.commit();
            totalDeleted += playerStatesSnapshot.size;
            
            // Cleanup old queues
            const queuesSnapshot = await db.collection(this.collections.queues)
                .where('lastUpdated', '<', cutoffTime)
                .get();
            
            const batch2 = db.batch();
            queuesSnapshot.forEach(doc => {
                batch2.delete(doc.ref);
            });
            await batch2.commit();
            totalDeleted += queuesSnapshot.size;
            
            // Cleanup old messages
            const messagesSnapshot = await db.collection(this.collections.messages)
                .where('timestamp', '<', cutoffTime)
                .get();
            
            const batch3 = db.batch();
            messagesSnapshot.forEach(doc => {
                batch3.delete(doc.ref);
            });
            await batch3.commit();
            totalDeleted += messagesSnapshot.size;
            
            // Cleanup old user activity (older than 30 days)
            const userActivityCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const userActivitySnapshot = await db.collection(this.collections.userActivity)
                .where('lastActive', '<', userActivityCutoff)
                .get();
            
            const batch4 = db.batch();
            userActivitySnapshot.forEach(doc => {
                batch4.delete(doc.ref);
            });
            await batch4.commit();
            totalDeleted += userActivitySnapshot.size;
            
            logger.info(`Cleaned up old data: ${totalDeleted} documents deleted`);
            return true;
        } catch (error) {
            logger.error('Failed to cleanup old data', error);
            return false;
        }
    }

    async getGuildStats(guildId) {
        try {
            const playerState = await this.getPlayerState(guildId);
            const queue = await this.getQueue(guildId);
            
            return {
                hasActivePlayer: !!playerState,
                queueLength: queue.length,
                currentTrack: playerState?.currentTrack || null,
                lastUpdated: playerState?.lastUpdated || null
            };
        } catch (error) {
            logger.error(`Failed to get guild stats for ${guildId}`, error);
            return null;
        }
    }

    async savePreviousTrack(guildId, track) {
        try {
            const docId = `${guildId}`;
            const doc = await db.collection(this.collections.previousTracks).doc(docId).get();
            
            let tracks = [];
            if (doc.exists) {
                tracks = doc.data().tracks || [];
            }
            
            // Build safe track object
            const safeTrack = {
                title: track.title || 'Unknown',
                uri: track.uri || track.url || '',
                author: track.author || 'Unknown',
                length: track.length || track.duration || 0,
                thumbnail: track.thumbnail || track.artworkUrl || '',
                playedAt: new Date().toISOString()
            };

            // Only add requester if valid
            if (track.requester && (track.requester.id || track.requester.username)) {
                safeTrack.requester = {
                    id: track.requester.id || 'system',
                    username: track.requester.username || 'System',
                    tag: track.requester.tag || track.requester.username || 'System'
                };
            }

            tracks.unshift(safeTrack);
            
            if (tracks.length > 50) {
                tracks = tracks.slice(0, 50);
            }
            
            await db.collection(this.collections.previousTracks).doc(docId).set({ 
                guildId, 
                tracks,
                lastUpdated: new Date().toISOString()
            });
            
            logger.debug(`Saved previous track for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to save previous track for guild ${guildId}`, error);
            return false;
        }
    }

    async getPreviousTrack(guildId) {
        try {
            const doc = await db.collection(this.collections.previousTracks).doc(guildId).get();
            if (doc.exists) {
                const tracks = doc.data().tracks || [];
                return tracks.length > 0 ? tracks[0] : null;
            }
            return null;
        } catch (error) {
            logger.error(`Failed to get previous track for guild ${guildId}`, error);
            return null;
        }
    }

    async getPreviousTracks(guildId, limit = 10) {
        try {
            const doc = await db.collection(this.collections.previousTracks).doc(guildId).get();
            if (doc.exists) {
                const tracks = doc.data().tracks || [];
                return tracks.slice(0, limit);
            }
            return [];
        } catch (error) {
            logger.error(`Failed to get previous tracks for guild ${guildId}`, error);
            return [];
        }
    }

    async saveDisconnectHistory(guildId, reason, additionalInfo = {}) {
        try {
            // Safely build currentTrack if it exists
            let currentTrack = null;
            if (additionalInfo.currentTrack && additionalInfo.currentTrack.title) {
                currentTrack = {
                    title: additionalInfo.currentTrack.title || 'Unknown',
                    uri: additionalInfo.currentTrack.uri || '',
                    author: additionalInfo.currentTrack.author || 'Unknown'
                };
            }

            const disconnectData = {
                guildId,
                timestamp: new Date().toISOString(),
                reason: reason || 'unknown',
                voiceChannelId: additionalInfo.voiceChannelId || '',
                textChannelId: additionalInfo.textChannelId || '',
                currentTrack: currentTrack,
                position: additionalInfo.position || 0,
                queueLength: additionalInfo.queueLength || 0,
                wasPlaying: additionalInfo.wasPlaying === true,
                errorMessage: additionalInfo.errorMessage || ''
            };
            
            await db.collection(this.collections.disconnectHistory).add(disconnectData);
            logger.debug(`Saved disconnect history for guild ${guildId}: ${reason}`);
            return true;
        } catch (error) {
            logger.error(`Failed to save disconnect history for guild ${guildId}`, error);
            return false;
        }
    }

    async getDisconnectHistory(guildId, limit = 20) {
        try {
            const snapshot = await db.collection(this.collections.disconnectHistory)
                .where('guildId', '==', guildId)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            const history = [];
            snapshot.forEach(doc => {
                history.push(doc.data());
            });
            
            return history;
        } catch (error) {
            logger.error(`Failed to get disconnect history for guild ${guildId}`, error);
            return [];
        }
    }

    async saveMessageWithUser(guildId, messageType, messageData, userId) {
        try {
            const docId = `${guildId}_${messageType}`;
            const data = {
                guildId,
                messageType,
                messageId: messageData.id,
                channelId: messageData.channelId || messageData.channel?.id,
                userId: userId,
                content: messageData.content || null,
                hasButtons: messageData.components && messageData.components.length > 0,
                timestamp: new Date().toISOString()
            };

            await db.collection(this.collections.messages).doc(docId).set(data);
            logger.debug(`Saved ${messageType} message with user ID for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to save message with user for guild ${guildId}`, error);
            return false;
        }
    }

    async getAllMessagesForGuild(guildId) {
        try {
            const snapshot = await db.collection(this.collections.messages)
                .where('guildId', '==', guildId)
                .get();
            
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            
            return messages;
        } catch (error) {
            logger.error(`Failed to get all messages for guild ${guildId}`, error);
            return [];
        }
    }

    async deleteAllMessagesForGuild(guildId) {
        try {
            const snapshot = await db.collection(this.collections.messages)
                .where('guildId', '==', guildId)
                .get();
            
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            
            logger.debug(`Deleted all messages for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete all messages for guild ${guildId}`, error);
            return false;
        }
    }

    async saveGuildConfig(guildId, config) {
        try {
            const data = {
                guildId,
                ...config,
                lastUpdated: new Date().toISOString()
            };

            await db.collection(this.collections.guildConfig).doc(guildId).set(data, { merge: true });
            logger.debug(`Saved guild config for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to save guild config for guild ${guildId}`, error);
            return false;
        }
    }

    async getGuildConfig(guildId) {
        try {
            const doc = await db.collection(this.collections.guildConfig).doc(guildId).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            logger.error(`Failed to get guild config for guild ${guildId}`, error);
            return null;
        }
    }

    async trackButtonClick(guildId, userId, buttonId) {
        try {
            const docId = `${guildId}_${userId}`;
            const now = Date.now();
            
            const docRef = db.collection(this.collections.buttonSpam).doc(docId);
            const doc = await docRef.get();
            
            let clickData = {
                guildId,
                userId,
                clicks: [],
                lastUpdated: now
            };
            
            if (doc.exists) {
                clickData = doc.data();
                clickData.clicks = clickData.clicks || [];
            }
            
            clickData.clicks.push({ buttonId, timestamp: now });
            
            const oneHourAgo = now - (60 * 60 * 1000);
            clickData.clicks = clickData.clicks.filter(click => click.timestamp > oneHourAgo);
            
            clickData.lastUpdated = now;
            
            await docRef.set(clickData);
            logger.debug(`Tracked button click for user ${userId} in guild ${guildId}`);
            return clickData.clicks;
        } catch (error) {
            logger.error(`Failed to track button click`, error);
            return [];
        }
    }

    async getButtonClicks(guildId, userId, timeWindow) {
        try {
            const docId = `${guildId}_${userId}`;
            const doc = await db.collection(this.collections.buttonSpam).doc(docId).get();
            
            if (!doc.exists) {
                return [];
            }
            
            const data = doc.data();
            const now = Date.now();
            const recentClicks = (data.clicks || []).filter(
                click => (now - click.timestamp) < timeWindow
            );
            
            return recentClicks;
        } catch (error) {
            logger.error(`Failed to get button clicks`, error);
            return [];
        }
    }

    async saveMutedUser(guildId, userId, reason, duration, mutedBy) {
        try {
            const docId = `${guildId}_${userId}`;
            const now = Date.now();
            
            const muteData = {
                guildId,
                userId,
                reason,
                duration,
                mutedBy,
                mutedAt: now,
                expiresAt: now + duration,
                active: true
            };
            
            await db.collection(this.collections.mutedUsers).doc(docId).set(muteData);
            logger.debug(`Saved mute data for user ${userId} in guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to save mute data`, error);
            return false;
        }
    }

    async getMutedUser(guildId, userId) {
        try {
            const docId = `${guildId}_${userId}`;
            const doc = await db.collection(this.collections.mutedUsers).doc(docId).get();
            
            if (!doc.exists) {
                return null;
            }
            
            const data = doc.data();
            const now = Date.now();
            
            if (data.expiresAt < now) {
                await this.removeMutedUser(guildId, userId);
                return null;
            }
            
            return data;
        } catch (error) {
            logger.error(`Failed to get mute data`, error);
            return null;
        }
    }

    async removeMutedUser(guildId, userId) {
        try {
            const docId = `${guildId}_${userId}`;
            await db.collection(this.collections.mutedUsers).doc(docId).delete();
            logger.debug(`Removed mute data for user ${userId} in guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to remove mute data`, error);
            return false;
        }
    }

    async getAllMutedUsers(guildId) {
        try {
            const snapshot = await db.collection(this.collections.mutedUsers)
                .where('guildId', '==', guildId)
                .where('active', '==', true)
                .get();
            
            const mutedUsers = [];
            const now = Date.now();
            
            for (const doc of snapshot.docs) {
                const data = doc.data();
                if (data.expiresAt > now) {
                    mutedUsers.push(data);
                } else {
                    await this.removeMutedUser(guildId, data.userId);
                }
            }
            
            return mutedUsers;
        } catch (error) {
            logger.error(`Failed to get all muted users for guild ${guildId}`, error);
            return [];
        }
    }

    async clearButtonSpam(guildId, userId) {
        try {
            const docId = `${guildId}_${userId}`;
            await db.collection(this.collections.buttonSpam).doc(docId).delete();
            logger.debug(`Cleared button spam data for user ${userId} in guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to clear button spam data`, error);
            return false;
        }
    }
}

module.exports = new FirebaseStateManager();
