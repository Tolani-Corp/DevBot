import { Client, GatewayIntentBits, Events } from 'discord.js';
import { answerQuestion } from '../ai/claude';
import { postTweet } from '../twitter/bot';

export function startDiscordBot(token: string) {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    client.once(Events.ClientReady, (c) => {
        console.log(`Ready! Logged in as ${c.user.tag}`);
    });

    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return;

        // Check if the bot is mentioned
        if (message.mentions.has(client.user!.id)) {
            try {
                // Command: !tweet [content]
                if (message.content.includes('!tweet')) {
                    const content = message.content.replace(/<@\d+>/g, '').replace('!tweet', '').trim();
                    if (!content) {
                        await message.reply("❌ Usage: `@FunBot !tweet Hello world`");
                        return;
                    }
                    const result = await postTweet(content);
                    if (result?.success) {
                        await message.reply(`✅ Tweet posted!`);
                    } else {
                        await message.reply(`❌ Failed to post tweet. Check logs.`);
                    }
                    return;
                }

                const response = await answerQuestion(message.content);
                await message.reply(response || "I'm sorry, I couldn't process that request.");
            } catch (error) {
                console.error('Error handling message:', error);
                await message.reply('An error occurred while processing your request.');
            }
        }
    });

    client.login(token).catch(err => console.error("Discord login failed:", err));
}
