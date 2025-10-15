const { EmbedBuilder } = require('discord.js');
const emoji = require('../../config/emoji.json');
const config = require('../../config/config.json');
const { safeDeleteMultiple } = require('../../utils/messageUtils');

module.exports = {
    name: 'meme',
    category: 'utility',
    aliases: ['m', 'randommeme'],
    description: 'Get a random meme from Reddit',
    async execute(client, message, args) {
        await message.channel.sendTyping();
        
        const subreddits = ['memes', 'dankmemes', 'wholesomememes', 'me_irl', 'funny', 'ProgrammerHumor', 'terriblefacebookmemes'];
        const maxRetries = 5;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const fetch = (await import('node-fetch')).default;
                const randomSubreddit = subreddits[Math.floor(Math.random() * subreddits.length)];
                
                const response = await fetch(`https://meme-api.com/gimme/${randomSubreddit}`, {
                    headers: {
                        'User-Agent': 'DiscordBot/1.0'
                    },
                    timeout: 5000
                });
                
                if (!response.ok) {
                    if (attempt < maxRetries - 1) continue;
                    throw new Error(`API request failed with status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data || !data.url) {
                    if (attempt < maxRetries - 1) continue;
                    throw new Error('Invalid API response');
                }
                
                if (data.nsfw) {
                    if (attempt < maxRetries - 1) continue;
                    const embed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setDescription(`${emoji.info} That meme wasn't suitable. Try again!`);
                    
                    const reply = await message.reply({ embeds: [embed] });
                    safeDeleteMultiple([reply], config.autoDeleteTime);
                    return;
                }
                
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setTitle(data.title && data.title.length > 256 ? data.title.substring(0, 253) + '...' : data.title || 'Random Meme')
                    .setImage(data.url)
                    .setFooter({ text: `👍 ${data.ups || 0} upvotes | r/${data.subreddit || randomSubreddit}` })
                    .setURL(data.postLink || `https://reddit.com/r/${randomSubreddit}`)
                    .setTimestamp();
                
                const reply = await message.reply({ embeds: [embed] });
                safeDeleteMultiple([reply], config.autoDeleteTime * 4);
                return;
                
            } catch (error) {
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                
                console.error('Error fetching meme after all retries:', error.message);
                
                const embed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setDescription(`${emoji.error} Failed to fetch a meme. Reddit API might be down. Try again later!`);
                
                const reply = await message.reply({ embeds: [embed] });
                safeDeleteMultiple([reply], config.autoDeleteTime);
            }
        }
    }
};
