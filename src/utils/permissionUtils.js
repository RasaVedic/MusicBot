const { PermissionFlagsBits } = require('discord.js');

function isBotOwner(userId) {
    return userId === process.env.OWNER_ID;
}

function hasAdminPermission(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

function canUseAdminCommand(userId, member) {
    if (isBotOwner(userId)) {
        return true;
    }
    return hasAdminPermission(member);
}

function canUseCommand(userId, member, requiredPermission = null) {
    if (isBotOwner(userId)) {
        return true;
    }
    
    if (!requiredPermission) {
        return true;
    }
    
    return member.permissions.has(requiredPermission);
}

module.exports = {
    isBotOwner,
    hasAdminPermission,
    canUseAdminCommand,
    canUseCommand
};
