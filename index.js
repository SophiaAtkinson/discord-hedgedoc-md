const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const pollIntervalMs = 30 * 1000; // 30 seconds
const configPath = path.join(__dirname, 'config.json');
const statePath = path.join(__dirname, './data/state.json');

// Load configs
let configs;
try {
  configs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('❗ Failed to load config.json:', error.message);
  process.exit(1);
}

// Load or initialize global state
let state = {};
if (fs.existsSync(statePath)) {
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    console.error('❗ Failed to load state.json:', error.message);
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

// Fetch markdown content
async function fetchMarkdown(url) {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    console.error('❗ Error fetching markdown:', error.message);
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
      console.error(`❗ [${config.name}] Failed to get message ID.`);
    }
  } catch (error) {
    console.error(`❌ [${config.name}] Error sending new message:`, error.message);
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
      console.error(`⚠️ [${config.name}] Message not found (deleted?). Creating new...`);
      state[config.name].messageId = '';
      await createNewMessage(config);
    } else {
      console.error(`❌ [${config.name}] Error updating message:`, error.message);
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
      console.error(`⚠️ [${config.name}] Message not found. Will create new.`);
      state[config.name].messageId = '';
    } else {
      console.error(`❗ [${config.name}] Error validating message:`, error.message);
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
async function poll() {
  for (const config of configs) {
    await checkForUpdates(config);
  }
  setTimeout(poll, pollIntervalMs);
}


(async () => {
  console.log('🚀 Starting poller...');
  await poll();
})();
