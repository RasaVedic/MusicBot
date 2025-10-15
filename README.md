# Discord Music Bot 🎵

A production-ready Discord music bot with **Lavalink streaming**, advanced error handling, and crash recovery system.

## 🌟 Key Features

- 🎵 **High-Quality Streaming**: Lavalink-powered playback with automatic node failover
- 🔄 **Multi-Server Support**: Individual settings and configurations per server
- 🎨 **Custom UI**: Beautiful embeds with #FF4B32 color scheme
- 🎮 **Interactive Controls**: Button-based music controls (Previous, Halt, Skip, Auto, Stop)
- 🗑️ **Clean Chat**: Auto-delete messages for clutter-free experience
- ⚙️ **Customizable**: Per-server prefix configuration
- 👑 **Owner Privileges**: Bot owner can use commands without prefix
- 💾 **Persistent Storage**: Firebase database for settings and state recovery
- 📝 **Advanced Queue**: Full queue management with shuffle, skip, and autoplay
- 🌐 **Multi-Platform**: Spotify, SoundCloud, Apple Music metadata extraction
- 🔧 **Crash Recovery**: Automatic state recovery after restarts
- 📊 **Detailed Logging**: IST timestamps with comprehensive error tracking
- 🛡️ **Error Handling**: Automatic reconnection with exponential backoff
- 🎯 **Lyrics Support**: Live synced lyrics and text-based lyrics

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── config.json          # Bot configuration
│   │   ├── emoji.json           # Custom emoji configuration
│   │   └── firebase.js          # Firebase initialization
│   ├── classes/
│   │   └── ServerSettings.js    # Server settings management
│   ├── modules/
│   │   ├── MusicPlayer.js       # Music player utilities
│   │   ├── MusicManager.js      # Music manager
│   │   └── DirectStreamPlayer.js # Direct streaming player
│   ├── handlers/
│   │   ├── commandHandler.js    # Command handling logic
│   │   └── eventHandler.js      # Event handling logic
│   ├── commands/
│   │   ├── music/              # Music commands (play, queue, skip, etc.)
│   │   └── utility/            # Utility commands (help, prefix)
│   ├── events/
│   │   ├── ready.js            # Bot ready event
│   │   ├── messageCreate.js    # Message handling
│   │   └── interactionCreate.js # Button interactions
│   └── index.js                 # Main bot file
└── index.js                     # Entry point
```

## Quick Setup

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Configure Bot Token**
   - Get your Discord Bot Token from [Discord Developer Portal](https://discord.com/developers/applications)
   - Add it as a secret (DISCORD_BOT_TOKEN) in Replit

3. **Run the Bot**
   ```bash
   node index.js
   ```

4. **Invite Bot to Server**
   - Use Discord Developer Portal to generate invite link
   - Ensure proper permissions (see below)

## Music Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `play <song>` | `p`, `j`, `join` | Play a song or add to queue |
| `pfsp -platform <query>` | `pf`, `playform` | Play from specific platform (Admin only) |
| `pause` | `pa` | Pause the current song |
| `resume` | `r`, `unpause` | Resume the paused song |
| `queue` | `q` | Show current queue |
| `nowplaying` | `np`, `current` | Show current song |
| `skip` | `s` | Skip current song |
| `skipto <position>` | `st`, `jumpto` | Skip to specific position in queue (Admin only) |
| `shuffle` | `sh`, `mix` | Shuffle the queue |
| `autoplay` | `ap` | Toggle autoplay mode |
| `dmsong` | `dm`, `sendsong` | Send current playing song to your DM |
| `removeuser @user` | `rmuser`, `clearuser` | Remove all songs by a user from queue (Admin only) |
| `stop` | `disconnect`, `dc` | Stop playback and clear queue |

### Platform-Specific Play (pfsp)
Search and play from specific platforms (Admin only, Owner unrestricted):
- `-sc` or `-soundcloud` - SoundCloud
- `-sp` or `-spotify` - Spotify
- `-yt` or `-youtube` - YouTube
- `-ytm` or `-youtubemusic` - YouTube Music
- `-am` or `-applemusic` - Apple Music
- `-dz` or `-deezer` - Deezer

**Example:** `pfsp -sc ocean eyes` or `pfsp -spotify starboy`

## Utility Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `help` | `h`, `commands` | Show help menu with categories (Music first) |
| `prefix [new]` | `setprefix` | View or set server prefix |
| `ping` | `latency` | Check bot latency and API response time |
| `uptime` | `up`, `botuptime` | Check how long the bot has been online |
| `stats` | `botstats`, `info` | Show bot statistics and information |
| `terms` | `tos`, `termsofservice` | View bot's Terms of Service |
| `privacy` | `privacypolicy`, `gdpr`, `data` | View Privacy Policy and data handling info |
| `joke` | `j`, `funny` | Get a random joke from the internet |
| `meme` | `m`, `randommeme` | Get random memes (uses free API) |

## Admin Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `announce <message>` | `ann`, `broadcast` | Send an announcement to current channel (Admin only) |
| `ban @user [reason]` | `b` | Ban a member from the server |
| `unban <userId> [reason]` | `ub`, `pardon` | Unban a previously banned user |
| `kick @user [reason]` | `k` | Kick a member from the server |
| `mute @user <duration>` | `timeout` | Timeout a member (e.g., 10m, 2h, 1d) |
| `unmute @user` | `untimeout` | Remove timeout from a member |
| `warn @user [reason]` | `w` | Warn a member |
| `modhistory [@user] [type]` | `history`, `modhist`, `actionlog` | View moderation history (bans, mutes, kicks, warns) |
| `modlogs [type]` | `logs`, `modlog` | View server moderation logs |
| `purge <amount>` | `clear`, `prune` | Delete multiple messages (1-100) |
| `lock` | - | Lock the current channel |
| `unlock` | - | Unlock the current channel |
| `slowmode <seconds>` | `sm` | Set slowmode for channel |

## Button Controls

- **Previous** - Play previous track
- **Halt** - Pause/Resume playback
- **Skip** - Skip to next track
- **Auto** - Toggle autoplay
- **Stop** - Stop and disconnect

## 🐛 Debug System

The bot includes a comprehensive debug logging system that tracks all bot activity with message IDs, user actions, and detailed reasons.

### Debug Configuration

All debug settings are controlled via `src/config/debugSettings.json`:

```json
{
  "debugMode": {
    "enabled": true,           // Master switch for all debug logging
    "logToFile": false,        // Save logs to file
    "logFilePath": "./logs/debug.log"
  },
  "commands": {
    "enabled": true,           // Log command execution
    "logInput": true,          // Log user input
    "logOutput": true,         // Log bot responses
    "includeMessageId": true   // Include message IDs
  },
  "buttons": {
    "enabled": true,           // Log button interactions
    "logPlayerState": true     // Include player state
  },
  "musicEvents": {
    "enabled": true,           // Log music events
    "logAutoplay": true        // Log autoplay triggers/blocks
  }
}
```

### What Gets Logged

- ✅ **Commands**: Input, output, execution time, errors
- ✅ **Buttons**: Click events, actions, player state changes
- ✅ **Music Events**: Track start/end, autoplay triggers, queue changes
- ✅ **Messages**: Message creation, deletion with IDs
- ✅ **Voice Events**: Join, leave, state changes
- ✅ **Errors**: Full stack traces with context
- ✅ **Performance**: Slow commands detection

### Debug Output Format

```
[DD/MM HH:MM:SS.ms] [CATEGORY] [TYPE] Message
{
  "messageId": "123456789",
  "userId": "987654321",
  "input": "!play song name",
  "reason": "command_executed"
}
```

### Enabling/Disabling Debug

To disable all debug logging, set `debugMode.enabled` to `false` in `debugSettings.json`.

To disable specific categories, set the category's `enabled` to `false`:

```json
{
  "buttons": {
    "enabled": false  // Disables button debug logging
  }
}
```

## Special Features

- **Bot Owner Privilege**: Owner can use all commands without prefix
- **Auto-delete Messages**: All bot messages auto-delete after 30 seconds
- **Custom Embeds**: All embeds use #FF4B32 color with custom emojis
- **Multi-server Settings**: Each server can have its own prefix and settings
- **Platform Support**: Search and extract metadata from Spotify, SoundCloud, and more - plays from YouTube

## Required Bot Permissions

- Read Messages/View Channels
- Send Messages
- Embed Links
- Connect
- Speak
- Use Voice Activity
- Manage Messages (for auto-delete)

## Legal & Compliance

This bot complies with Discord's Terms of Service, Developer Policy, and Community Guidelines.

- 📋 **[Terms of Service](TERMS_OF_SERVICE.md)** - Read our terms and usage policies
- 🔒 **[Privacy Policy](PRIVACY_POLICY.md)** - Learn how we handle your data

**Data Collection**: We only collect minimal data necessary for bot functionality (server settings, command usage). No personal information, message content, or voice data is stored.

**Discord Compliance**: This bot follows all Discord policies and guidelines to ensure safe and compliant operation.

## 🔧 Troubleshooting Guide

### Voice Channel Disconnections

**Problem**: Bot disconnects from voice channel without reason

**Common Causes & Solutions**:

1. **Lavalink Server Issues (502/503 errors)**
   - Check logs for "Lavalink node error: Unexpected server response: 502/503"
   - Solution: Bot automatically switches to alternate Lavalink nodes
   - Verify Lavalink nodes in `src/config/config.json`
   - Add more reliable Lavalink nodes if available

2. **Network/Connection Issues (Code 1006)**
   - Log message: "Abnormal Closure (No close frame)"
   - Bot will auto-retry up to 5 times with exponential backoff
   - Check your internet connection and firewall settings

3. **Empty Voice Channel**
   - Bot leaves after 60 seconds if alone (configurable in config.json)
   - Set `leaveOnEmpty: false` to disable this behavior

4. **Max Retries Reached**
   - Bot destroys player after 5 failed reconnection attempts
   - Check Firebase disconnect history for detailed logs

### Debugging Steps

1. **Enable Debug Logging**
   ```bash
   DEBUG_LEVEL=DEBUG DEBUG_MODULES=* node index.js
   ```

2. **Check Lavalink Status**
   - Logs show connection status with ✅ (ready) or ❌ (error)
   - Look for "Lavalink node is ready" messages

3. **Monitor Voice Connection**
   - 🔴 Voice connection disconnected - indicates disconnect
   - 🔄 Attempting reconnection - retry in progress
   - ✅ Reconnection successful - connection restored

4. **Review Firebase Logs**
   - Disconnect history stored with timestamps and reasons
   - Check `disconnectHistory` collection for patterns

### Configuration Tips

**Optimize Reconnection Settings** (`src/services/VoiceConnectionManager.js`):
```javascript
this.maxRetries = 5;          // Increase for unstable connections
this.baseRetryDelay = 1000;   // Initial retry delay (ms)
this.maxRetryDelay = 30000;   // Maximum retry delay (ms)
```

**Lavalink Configuration** (`src/config/config.json`):
```json
{
  "lavalink": {
    "nodes": [
      {
        "name": "Primary Node",
        "url": "lavalink.example.com:443",
        "auth": "youshallnotpass",
        "secure": true
      },
      {
        "name": "Backup Node",
        "url": "backup.example.com:443",
        "auth": "password",
        "secure": true
      }
    ]
  }
}
```

### Performance Optimization

- **Memory Usage**: Automatic state cleanup every 24 hours
- **Message Cleanup**: Auto-delete after 10 seconds (configurable)
- **Periodic State Save**: Every 10 seconds during playback
- **Preloading**: Next track loads 2 seconds before current ends

### Environment Variables

```bash
# Required
DISCORD_BOT_TOKEN=your_bot_token_here

# Optional (Firebase)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Optional (Spotify - for enhanced search)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Debugging
DEBUG_LEVEL=INFO          # ERROR | WARN | INFO | DEBUG | TRACE
DEBUG_MODULES=*           # Specific modules or * for all
DEBUG_ERROR_STACK=true    # Show full error stack traces
```

### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `502 Bad Gateway` | Lavalink server unavailable | Auto-switches to backup node |
| `1006 Abnormal Closure` | Network connection lost | Auto-reconnects with backoff |
| `Max retry attempts reached` | Connection permanently lost | Player destroyed, check network |
| `Player already destroyed` | Duplicate destroy call | Normal, can be ignored |
| `Failed to save state` | Firebase write error | Check Firebase credentials |

### Log Format

Logs now use **Indian Standard Time (IST)** with compact format:
```
[13/10 21:35:42] +120.5s [INFO] [LavalinkManager] ✅ Lavalink node ready
[13/10 21:35:45] +123.2s [WARN] [VoiceConnectionManager] 🔴 Voice disconnected
[13/10 21:35:47] +125.1s [INFO] [VoiceConnectionManager] ✅ Reconnection successful
```

### Getting Help

1. Check logs for detailed error messages with timestamps
2. Review Firebase `disconnectHistory` collection
3. Verify Lavalink node status in logs
4. Enable debug mode for verbose logging
5. Check Discord bot permissions (Connect, Speak, View Channels)

---

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t discord-music-bot .

# Run container
docker run -d \
  --name discord-bot \
  --env-file .env \
  --restart unless-stopped \
  discord-music-bot

# View logs
docker logs -f discord-bot
```

### Production Checklist
- ✅ Set `DEBUG_LEVEL=WARN` or `ERROR` in production
- ✅ Configure multiple Lavalink nodes for failover
- ✅ Set up Firebase for persistence
- ✅ Enable auto-restart (Docker/PM2)
- ✅ Monitor logs regularly
- ✅ Keep dependencies updated

---

Enjoy your music! 🎵

**Built with ❤️ by Rasavedic Team** | [Report Issues](https://github.com/yourusername/discord-bot/issues)
