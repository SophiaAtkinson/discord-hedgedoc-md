const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

const configPath = path.join(__dirname, 'config.json');
const statePath = path.join(__dirname, './data/state.json');
const errorLogPath = path.join(__dirname, './data/error.log');

// Load configs
let rawConfigs;
try {
  rawConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('❗ Failed to load config.json: ' + error.message);
  process.exit(1);
}

const globalSettings = rawConfigs[0] || {};
const configs = rawConfigs.slice(1);

const globalTimezone = globalSettings.timezone || 'UTC';
const pollIntervalMs = parseInt(globalSettings.pollingRateMS || '30000');

if (configs.length === 0) {
  console.error('❗ No configs found in config.json.');
  process.exit(1);
}

// --- ERROR LOGGER ---
function logError(message) {
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: globalTimezone
  });
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(errorLogPath, line);
  console.error(message);
}

// Load or initialize global state
let state = {};
if (fs.existsSync(statePath)) {
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    logError('❗ Failed to load state.json: ' + error.message);
    process.exit(1);
  }
}

// Save global state
function saveState() {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// Normalize content
function normalizeContent(content) {
  return content.replace(/\r\n/g, '\n').trim();
}

// Check if the host of a URL is reachable
async function checkHostAvailability(url) {
  const { hostname } = new URL(url);
  return new Promise((resolve) => {
    dns.lookup(hostname, (err) => {
      if (err) {
        logError(`🌐 Host unreachable: ${hostname} – ${err.message}`);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// Fetch markdown content
async function fetchMarkdown(url) {
  const hostOK = await checkHostAvailability(url);
  if (!hostOK) return '';

  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    logError(`❗ Error fetching markdown from ${url}: ${error.message}`);
    return '';
  }
}

// Send a new message
async function createNewMessage(config) {
  try {
    const content = state[config.name].lastContent;
    const payload = { content: content.length > 2000 ? content.slice(0, 1997) + '...' : content };
    const { data } = await axios.post(`${config.webhookURL}?wait=true`, payload);
    if (data?.id) {
      state[config.name].messageId = data.id;
      saveState();
      console.log(`✅ [${config.name}] New message sent and ID saved.`);
    } else {
      logError(`❗ [${config.name}] Failed to get message ID.`);
    }
  } catch (error) {
    logError(`❌ [${config.name}] Error sending new message: ${error.message}`);
  }
}

// Update existing message
async function updateMessage(config) {
  try {
    const content = state[config.name].lastContent;
    const payload = { content: content.length > 2000 ? content.slice(0, 1997) + '...' : content };
    await axios.patch(`${config.webhookURL}/messages/${state[config.name].messageId}`, payload);
    console.log(`✅ [${config.name}] Message updated.`);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logError(`⚠️ [${config.name}] Message not found (deleted?). Creating new...`);
      state[config.name].messageId = '';
      await createNewMessage(config);
    } else {
      logError(`❌ [${config.name}] Error updating message: ${error.message}`);
    }
  }
}

// Validate existing message
async function validateExistingMessage(config) {
  if (!state[config.name]?.messageId) return;
  try {
    await axios.get(`${config.webhookURL}/messages/${state[config.name].messageId}`);
    console.log(`✅ [${config.name}] Existing message validated.`);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logError(`⚠️ [${config.name}] Message not found. Will create new.`);
      state[config.name].messageId = '';
    } else {
      logError(`❗ [${config.name}] Error validating message: ${error.message}`);
    }
  }
}

// Check for updates for a single config
async function checkForUpdates(config) {
  if (!state[config.name]) {
    state[config.name] = { messageId: '', lastContent: '' };
  }

  await validateExistingMessage(config);

  console.log(`🔄 [${config.name}] Checking for updates...`);
  const markdown = await fetchMarkdown(config.markdownURL);
  const normalizedMarkdown = normalizeContent(markdown);

  if (!normalizedMarkdown) {
    console.log(`⚠️ [${config.name}] No content fetched.`);
    return;
  }

  if (!state[config.name].messageId) {
    console.log(`📄 [${config.name}] No message ID found, creating...`);
    state[config.name].lastContent = normalizedMarkdown;
    await createNewMessage(config);
  } else if (normalizedMarkdown !== state[config.name].lastContent) {
    console.log(`📄 [${config.name}] Content changed, updating...`);
    state[config.name].lastContent = normalizedMarkdown;
    saveState();
    await updateMessage(config);
  } else {
    console.log(`⏳ [${config.name}] No changes detected.`);
  }
}

// Main loop
(async () => {
  console.log('🚀 Starting poller...');
  for (const config of configs) {
    await checkForUpdates(config);
  }
  setInterval(async () => {
    for (const config of configs) {
      await checkForUpdates(config);
    }
  }, pollIntervalMs);
})();
