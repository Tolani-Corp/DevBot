# 🤖 DevBot Discord Bot Setup Guide

Complete guide to creating and configuring a Discord Bot for DevBot.

---

## Step 1: Create the Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. **Name:** `DevBot`
4. Click **Create**

---

## Step 2: Create a Bot User

1. In your application, go to **Bot** (left sidebar)
2. Click **Add Bot**
3. **Username:** `DevBot` (or your preferred name)
4. Under **Token**, click **Reset Token**
5. Copy the token → This is your `DISCORD_TOKEN` (keep it secret!)
6. Enable these options:
   - ✅ **Public Bot** (so others can invite it)
   - ✅ **Requires OAuth2 Code Grant** (for web-based OAuth)

---

## Step 3: Configure Bot Permissions

1. Go to **OAuth2** → **URL Generator** (left sidebar)
2. **Scopes:** Select `bot`
3. **Bot Permissions:** Select these permissions:

| Permission | Purpose |
| ---------- | ------- |
| ✅ Send Messages | Post responses in channels |
| ✅ Use Slash Commands | Handle /commands |
| ✅ Read Message History | See conversation context |
| ✅ Read Messages/View Channels | Access channel content |
| ✅ Mention Everyone | Use @everyone if needed |
| ✅ Use External Emojis | Rich emoji responses |
| ✅ Use External Stickers | Fun responses |
| ✅ Embed Links | Rich embed responses |
| ✅ Attach Files | Send files/logs |
| ✅ Read Message History | Context for replies |

1. Copy the generated URL at the bottom
2. Paste it in your browser to invite the bot to your server

---

## Step 4: Get Application Details

1. Go to **General Information** (left sidebar)
2. Copy **Application ID** → This is your `DISCORD_APP_ID`

3. Go to **Bot** section
4. Copy **Public Key** → This is your `DISCORD_PUBLIC_KEY` (for interactions)

---

## Step 5: Environment Variables

Add these to your `.env` file:

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_APP_ID=your_application_id_here
DISCORD_PUBLIC_KEY=your_public_key_here

# Optional: Webhook URLs for notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_GENERAL_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

---

## Step 6: Start the Bot

```bash
# Make sure DISCORD_TOKEN is set
pnpm start
```

You should see: `🤖 FunBot Discord integration enabled`

---

## Step 7: Test the Bot

In your Discord server:

1. **Mention the bot:** `@DevBot hello`
2. **Use commands:** `/help`
3. **Reply to bot messages:** Reply to any bot message

The bot should now respond to mentions AND replies! 🎉

---

## Troubleshooting

### Bot not responding?

- Check that `DISCORD_TOKEN` is set correctly
- Make sure the bot has proper permissions in your server
- Check console logs for errors

### Bot not responding to replies?

- The bot now handles replies automatically
- Make sure you're replying to the bot's messages (not other users)

### Permission errors?

- Re-invite the bot with the correct permissions
- Check that the bot role has proper channel access

---

## Advanced Configuration

### Custom Bot Name per Server

The bot supports custom names per Discord server:

- Mention the bot and say "rename bot" or "change name"
- Reply with your preferred name

### Agent Aliases

The bot responds to these aliases:

- `@shark` - Sports analytics focus
- `@ace` - High-performance mode
- `@ice` - Conservative analysis
- `@linemd` - Line movement tracking

### Feedback System

- `@DevBot feedback, [issue description]`
- `/feedback/status/[ticket_id]`

---

## Security Notes

- Never commit `DISCORD_TOKEN` to version control
- Use environment variables for all secrets
- Regularly rotate bot tokens
- Monitor bot permissions and usage
