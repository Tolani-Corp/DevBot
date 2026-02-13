import { Client, GatewayIntentBits, Events } from 'discord.js';
import { answerQuestion } from '../ai/claude';
import { postTweet } from '../twitter/bot';
import {
  needsOnboarding,
  ensureWorkspace,
  completeOnboarding,
  getBotName,
  updateBotName,
  getOnboardingMessage,
  getNameConfirmationMessage,
  getHelpMessage,
} from '@/services/onboarding';

// Store pending onboarding and rename states
const pendingOnboarding = new Set<string>();
const pendingRename = new Set<string>();

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

        const guildId = message.guildId;
        if (!guildId) return;

        // Check if the bot is mentioned
        if (message.mentions.has(client.user!.id)) {
            try {
                // Check if onboarding is needed
                const requiresOnboarding = await needsOnboarding({
                    platformType: 'discord',
                    guildId,
                });

                if (requiresOnboarding) {
                    await ensureWorkspace({
                        platformType: 'discord',
                        guildId,
                    });
                    
                    pendingOnboarding.add(guildId);
                    await message.reply(getOnboardingMessage());
                    return;
                }

                // Get custom bot name for this server
                const botName = await getBotName({
                    platformType: 'discord',
                    guildId,
                });

                const content = message.content.replace(/<@\d+>/g, '').trim();

                // Check for rename command
                if (content.toLowerCase().includes('rename bot') || content.toLowerCase().includes('change name')) {
                    pendingRename.add(guildId);
                    await message.reply(`Sure! What would you like to call me instead of **${botName}**? Just reply with your preferred name.`);
                    return;
                }

                if (!content) {
                    await message.reply(getHelpMessage(botName));
                    return;
                }

                // Command: !tweet [content]
                if (content.includes('!tweet')) {
                    const tweetContent = content.replace('!tweet', '').trim();
                    if (!tweetContent) {
                        await message.reply("❌ Usage: `@" + botName.replace(/\s+/g, "") + " !tweet Hello world`");
                        return;
                    }
                    const result = await postTweet(tweetContent);
                    if (result?.success) {
                        await message.reply(`✅ Tweet posted!`);
                    } else {
                        await message.reply(`❌ Failed to post tweet. Check logs.`);
                    }
                    return;
                }

                const response = await answerQuestion(content);
                await message.reply(response || "I'm sorry, I couldn't process that request.");
            } catch (error) {
                console.error('Error handling message:', error);
                await message.reply('An error occurred while processing your request.');
            }
        } else {
            // Check if this is a response to onboarding or rename prompt
            if (pendingOnboarding.has(guildId)) {
                const customName = message.content.trim();
                
                if (customName && customName.length > 0 && customName.length <= 50) {
                    const finalName = customName.toLowerCase().includes('keep') ? 'DevBot' : customName;
                    
                    await completeOnboarding(
                        {
                            platformType: 'discord',
                            guildId,
                        },
                        finalName
                    );
                    
                    pendingOnboarding.delete(guildId);
                    await message.reply(getNameConfirmationMessage(finalName));
                } else {
                    await message.reply("Please provide a valid name (1-50 characters) or say 'keep DevBot' to use the default name.");
                }
                return;
            }

            if (pendingRename.has(guildId)) {
                const customName = message.content.trim();
                
                if (customName && customName.length > 0 && customName.length <= 50) {
                    await updateBotName(
                        {
                            platformType: 'discord',
                            guildId,
                        },
                        customName
                    );
                    
                    pendingRename.delete(guildId);
                    await message.reply(getNameConfirmationMessage(customName));
                } else {
                    await message.reply("Please provide a valid name (1-50 characters).");
                }
                return;
            }
        }
    });

    client.login(token).catch(err => console.error("Discord login failed:", err));
}
