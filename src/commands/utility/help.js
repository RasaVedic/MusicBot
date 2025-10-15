const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');
const { getIndianTimestamp } = require('../../utils/timeUtils');
const fs = require('fs');
const path = require('path');

function getAllCategories() {
    const commandsPath = path.join(__dirname, '..');
    const categories = {};
    
    const categoryDirs = fs.readdirSync(commandsPath).filter(item => {
        const itemPath = path.join(commandsPath, item);
        return fs.statSync(itemPath).isDirectory();
    });
    
    for (const category of categoryDirs) {
        const categoryPath = path.join(commandsPath, category);
        const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
        
        if (commandFiles.length > 0) {
            categories[category] = [];
            for (const file of commandFiles) {
                if (category === 'utility' && file === 'help.js') continue;
                
                try {
                    const cmd = require(path.join(categoryPath, file));
                    categories[category].push({
                        name: cmd.name,
                        aliases: cmd.aliases || [],
                        description: cmd.description || 'No description'
                    });
                } catch (error) {
                    console.error(`Error loading command ${file}:`, error);
                }
            }
        }
    }
    
    return categories;
}

module.exports = {
    name: 'help',
    category: 'utility',
    aliases: ['h', 'commands'],
    description: 'Show all available commands organized by category',
    async execute(client, message, args, serverSettings) {
        const prefix = await serverSettings.getPrefix(message.guild.id);
        const categories = getAllCategories();
        
        const totalCommands = Object.values(categories).reduce((sum, cmds) => sum + cmds.length, 0);
        
        const categoryOrder = ['music', 'admin', 'utility'];
        const categoryEmojis = {
            'music': emoji.music || '🎵',
            'admin': emoji.warning || '🔨',
            'utility': emoji.info || '🛠️'
        };
        
        const categoryDescriptions = {
            'music': 'Control music playback, queue management, and audio settings',
            'admin': 'Moderation and server management commands (requires permissions)',
            'utility': 'General bot utilities, information, and entertainment'
        };

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emoji.music} ${client.user.username} - Command Help`)
            .setDescription(
                `**Current Prefix:** \`${prefix}\`\n` +
                `**Total Commands:** ${totalCommands}\n\n` +
                `**Select a category to explore:**\n` +
                `Click the buttons below to view commands in each category.`
            )
            .setThumbnail(client.user.displayAvatarURL());

        for (const category of categoryOrder) {
            if (categories[category] && categories[category].length > 0) {
                const categoryEmoji = categoryEmojis[category] || emoji.info;
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                const description = categoryDescriptions[category] || '';
                const commandCount = categories[category].length;
                
                embed.addFields({
                    name: `${categoryEmoji} ${categoryName}`,
                    value: `${description}\n**Commands:** ${commandCount}`,
                    inline: true
                });
            }
        }

        embed.setFooter({ 
            text: `Requested by ${message.author.username}`, 
            iconURL: message.author.displayAvatarURL() 
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('📚 Select a category to view commands');

        for (const category of categoryOrder) {
            if (categories[category] && categories[category].length > 0) {
                const categoryEmoji = categoryEmojis[category] || emoji.info;
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                const description = categoryDescriptions[category] || '';
                
                selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(categoryName)
                        .setDescription(description.substring(0, 100))
                        .setValue(category)
                        .setEmoji(categoryEmoji)
                );
            }
        }

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const reply = await message.reply({ embeds: [embed], components: [row] });
        
        if (!client.helpCollectors) {
            client.helpCollectors = new Map();
        }

        client.helpCollectors.set(reply.id, {
            categories,
            prefix,
            requestedBy: message.author.id
        });

        setTimeout(() => {
            client.helpCollectors.delete(reply.id);
            safeDeleteMultiple([reply], 0);
        }, config.autoDeleteTime * 3);
    }
};
