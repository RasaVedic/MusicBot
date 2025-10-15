const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { canUseAdminCommand } = require('../../utils/permissionUtils');

module.exports = {
    name: 'removeuser',
    category: 'music',
    aliases: ['rmuser', 'clearuser'],
    description: 'Remove all songs added by a specific user from queue (Admin only)',
    async execute(client, message, args) {
        if (!canUseAdminCommand(message.author.id, message.member)) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} This command is restricted to administrators only.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const player = client.manager.get(message.guild.id);

        if (!player || player.queue.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} The queue is empty.`);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const targetUser = message.mentions.users.first();
        
        if (!targetUser) {
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(`${emoji.error} Please mention a user to remove their songs.\n**Usage:** \`removeuser @user\``);
            
            const reply = await message.reply({ embeds: [embed] });
            safeDeleteMultiple([reply], config.autoDeleteTime);
            return;
        }

        const originalQueueLength = player.queue.length;
        const newQueue = [];
        
        for (let i = 0; i < player.queue.length; i++) {
            const track = player.queue[i];
            if (track.requester?.id !== targetUser.id) {
                newQueue.push(track);
            }
        }

        player.queue.clear();
        newQueue.forEach(track => player.queue.add(track));

        const removedCount = originalQueueLength - newQueue.length;

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(
                removedCount > 0 
                    ? `${emoji.success} Removed **${removedCount}** song(s) added by ${targetUser.username} from the queue.`
                    : `${emoji.info} No songs from ${targetUser.username} found in the queue.`
            );

        const reply = await message.reply({ embeds: [embed] });
        safeDeleteMultiple([reply], config.autoDeleteTime);
    }
};
