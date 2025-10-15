/**
 * Utility functions for safe message handling
 */

/**
 * Safely delete a message or interaction reply with error handling
 * @param {Message|CommandInteraction} messageOrInteraction - The message or interaction to delete
 * @param {number} delay - Delay in milliseconds before deletion (default: 0)
 */
async function safeDelete(messageOrInteraction, delay = 0) {
    if (!messageOrInteraction) return;
    
    const deleteFunction = async () => {
        try {
            if (messageOrInteraction.deleteReply) {
                // It's an interaction
                await messageOrInteraction.deleteReply().catch(() => {});
            } else if (messageOrInteraction.delete) {
                // It's a message - only delete if it's from a bot
                if (messageOrInteraction.author && messageOrInteraction.author.bot) {
                    await messageOrInteraction.delete().catch(() => {});
                }
            }
        } catch (err) {
            // Silently ignore deletion errors
        }
    };
    
    if (delay > 0) {
        setTimeout(deleteFunction, delay);
    } else {
        await deleteFunction();
    }
}

/**
 * Safely delete multiple messages with error handling
 * @param {Array} messages - Array of messages to delete
 * @param {number} delay - Delay in milliseconds before deletion
 */
async function safeDeleteMultiple(messages, delay = 0) {
    if (!messages || !Array.isArray(messages)) return;
    
    const deleteFunction = async () => {
        for (const msg of messages) {
            try {
                if (msg && msg.delete && msg.author && msg.author.bot) {
                    await msg.delete().catch(() => {});
                }
            } catch (err) {
                // Silently ignore deletion errors
            }
        }
    };
    
    if (delay > 0) {
        setTimeout(deleteFunction, delay);
    } else {
        await deleteFunction();
    }
}

module.exports = {
    safeDelete,
    safeDeleteMultiple
};
