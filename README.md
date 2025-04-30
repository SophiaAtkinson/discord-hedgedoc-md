# Hedgedoc to Discord

## What does it do?

- Monitors Markdown content from multiple configurable URLs such as HedgeDoc, or any markdown source (designed and tested for HedgeDoc).
- Pushes polled markdown content to a Discord webhook.
- Checks for changes by comparing content against a local copy of the last known version (stored in /data/state.json).
- Automatically updates the Discord message when the Markdown changes.
- Logs markdown source errors (timeouts, HTTP errors, etc.) in the specified timezone (stored in /data/error.log).
- Truncates Markdown content to 2000 characters to comply with Discord limits.
- Recreates manually deleted messages on the next content change.

## Why use this?

- Collaborate with your staff to manage rules for your Discord server.
- Ensure your community always sees the most up-to-date information.
- It's not a bot, it uses webhooks, so it’s lightweight and easy to deploy.

## Requirments

- NodeJS 20+
- NPM

## How to set up

Start by downloading the code. You can clone the repository by running:

`git clone https://github.com/SophiaAtkinson/discord-hedgedoc-md.git`

Or download the ZIP directly from [GitHub](https://github.com/SophiaAtkinson/discord-hedgedoc-md/archive/refs/heads/main.zip).

Once downloaded, navigate into the directory:

`cd discord-hedgedoc-md`

Next, install the dependencies:

`npm install`

Copy the example config to get started:

`cp config.json.example config.json`

Then open config.json in your preferred text editor.

### Config options

- timezone: Set your preferred timezone. If left blank, it defaults to `UTC`.
- pollingRate: Recommended to keep at the default `30000` (30 seconds). You can increase this, but don’t go lower.
- webhooks: For each webhook, you’ll need:
  - name: A name to identify it.
  - markdownURL: The URL to fetch markdown from (e.g., https://example.com/s/example/download).
  - webhookURL: Your Discord webhook URL (found under Channel Settings → Integrations → Webhooks).

If you only want one webhook, just include one in the array. If you want more, add additional entries.

Once configured, start the tool:

`npm run`

Or:

`node index.js`

That’s it! The messages should now appear in Discord. If you run into issues, feel free to open an issue on GitHub.

### Run it 24/7

You can use **[pm2](https://pm2.io/)** or **[Docker](https://www.docker.com/)** to keep the service running continuously.

## Notes

- Timezones must be in [TZ format](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- Markdown must be supported by [Discord’s Markdown guide](https://support.discord.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline)
- Your markdown source should not have aggressive rate limiting.
- Do not set the polling rate below 30 seconds (30000ms), as too many requests might be considered API abuse.
- With the recommended max of 20 webhook sources, the tool should not exceed 128MB of RAM. If it does, please open an issue.
- If you are using Hedgedoc, you must provide `/download` to the end of you published content!