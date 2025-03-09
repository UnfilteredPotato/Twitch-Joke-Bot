// Main server file for the joke bot web application
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const tmi = require('tmi.js');
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Log the current directory and files for debugging
console.log('Current directory:', process.cwd());
console.log('Files in root:', fs.readdirSync('.'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/twitchjokebot')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User model
const User = mongoose.model('User', {
  twitchId: String,
  username: String,
  accessToken: String,
  refreshToken: String,
  botEnabled: { type: Boolean, default: false },
  jokeFrequency: { type: Number, default: 10 }, // minutes
  jokeCategories: { type: [String], default: ['general', 'programming'] },
  customCommands: { type: Map, default: new Map() }
});

// Bot client storage
const botClients = new Map();

// Session config
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false
}));

// Passport config
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  User.findById(id).then(user => {
    done(null, user);
  }).catch(err => {
    done(err, null);
  });
});

// Twitch OAuth2 Strategy
passport.use(new OAuth2Strategy({
  authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
  tokenURL: 'https://id.twitch.tv/oauth2/token',
  clientID: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL || 'http://localhost:3000/auth/twitch/callback',
  scope: 'chat:read chat:edit channel:moderate'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Get user info from Twitch API
    const userInfo = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const twitchId = userInfo.data.data[0].id;
    const username = userInfo.data.data[0].login;
    
    // Find or create user
    let user = await User.findOne({ twitchId });
    if (!user) {
      user = new User({
        twitchId,
        username,
        accessToken,
        refreshToken
      });
    } else {
      user.accessToken = accessToken;
      user.refreshToken = refreshToken;
    }
    
    await user.save();
    return done(null, user);
  } catch (error) {
    console.error('OAuth error:', error);
    return done(error);
  }
}));

// Serve static files - First try to serve from src directory
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Debug route to check file system
app.get('/debug', (req, res) => {
  const currentDir = process.cwd();
  const files = fs.readdirSync(currentDir);
  
  // Check various directories
  const srcExists = fs.existsSync(path.join(currentDir, 'src'));
  const publicExists = fs.existsSync(path.join(currentDir, 'public'));
  const srcDirExists = fs.existsSync(__dirname);
  
  let srcFiles = [];
  let publicFiles = [];
  let currentDirFiles = [];
  
  if (srcExists) {
    srcFiles = fs.readdirSync(path.join(currentDir, 'src'));
  }
  
  if (publicExists) {
    publicFiles = fs.readdirSync(path.join(currentDir, 'public'));
  }
  
  if (srcDirExists) {
    currentDirFiles = fs.readdirSync(__dirname);
  }
  
  res.json({
    currentDir,
    files,
    srcExists,
    srcFiles,
    publicExists,
    publicFiles,
    dirname: __dirname,
    dirnameExists: srcDirExists,
    dirnameFiles: currentDirFiles,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      MONGODB_URI: process.env.MONGODB_URI ? 'Set (hidden for security)' : 'Not set',
      TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID ? 'Set (hidden for security)' : 'Not set',
      CALLBACK_URL: process.env.CALLBACK_URL ? 'Set (hidden for security)' : 'Not set',
      BOT_USERNAME: process.env.BOT_USERNAME || 'Not set'
    }
  });
});

// Routes
app.get('/', (req, res) => {
  // Try multiple locations to find the file
  const possiblePaths = [
    path.join(__dirname, 'index.html'),
    path.join(process.cwd(), 'src', 'index.html'),
    path.join(process.cwd(), 'public', 'index.html')
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      console.log('Found index.html at:', filePath);
      return res.sendFile(filePath);
    }
  }
  
  res.status(404).send('index.html not found. Please check your file structure.');
});

// Auth routes
app.get('/auth/twitch', passport.authenticate('oauth2'));
app.get('/auth/twitch/callback', 
  passport.authenticate('oauth2', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard')
);

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  // Try multiple locations to find the file
  const possiblePaths = [
    path.join(__dirname, 'dashboard.html'),
    path.join(process.cwd(), 'src', 'dashboard.html'),
    path.join(process.cwd(), 'public', 'dashboard.html')
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      console.log('Found dashboard.html at:', filePath);
      return res.sendFile(filePath);
    }
  }
  
  res.status(404).send('dashboard.html not found. Please check your file structure.');
});

app.get('/api/user', ensureAuthenticated, (req, res) => {
  res.json({
    username: req.user.username,
    botEnabled: req.user.botEnabled,
    jokeFrequency: req.user.jokeFrequency,
    jokeCategories: req.user.jokeCategories,
    customCommands: [...req.user.customCommands]
  });
});

// Update bot settings
app.post('/api/settings', ensureAuthenticated, async (req, res) => {
  const { botEnabled, jokeFrequency, jokeCategories, customCommands } = req.body;
  
  req.user.botEnabled = botEnabled;
  req.user.jokeFrequency = jokeFrequency;
  req.user.jokeCategories = jokeCategories;
  req.user.customCommands = new Map(customCommands);
  
  await req.user.save();
  
  // If bot is enabled, start it (or restart it with new settings)
  if (botEnabled) {
    startBot(req.user);
  } else {
    stopBot(req.user);
  }
  
  res.json({ success: true });
});

app.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// Joke API
async function getRandomJoke(categories) {
  try {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const response = await axios.get(`https://v2.jokeapi.dev/joke/${category}?blacklistFlags=nsfw,racist,sexist`);
    if (response.data.type === 'single') {
      return response.data.joke;
    } else {
      return `${response.data.setup} ... ${response.data.delivery}`;
    }
  } catch (error) {
    console.error('Error fetching joke:', error);
    return "Why did the chicken cross the road? To get to the other side!";
  }
}

// Bot functions
function startBot(user) {
  // Stop existing bot if running
  stopBot(user);
  
  // Create new bot client
  const client = new tmi.Client({
    options: { debug: true },
    identity: {
      username: process.env.BOT_USERNAME || 'joke_bot',
      password: `oauth:${user.accessToken}`
    },
    channels: [user.username]
  });
  
  client.connect().catch(console.error);
  
  // Set up joke interval
  const interval = setInterval(async () => {
    const joke = await getRandomJoke(user.jokeCategories);
    client.say(user.username, joke);
  }, user.jokeFrequency * 60 * 1000);
  
  // Set up command handlers
  client.on('message', (channel, tags, message, self) => {
    if (self) return;
    
    // Handle !joke command
    if (message.toLowerCase() === '!joke') {
      getRandomJoke(user.jokeCategories).then(joke => {
        client.say(channel, joke);
      });
      return;
    }
    
    // Custom commands
    for (const [cmd, response] of user.customCommands) {
      if (message.toLowerCase() === `!${cmd.toLowerCase()}`) {
        client.say(channel, response);
        return;
      }
    }
  });
  
  // Store client and interval
  botClients.set(user.twitchId, { client, interval });
}

function stopBot(user) {
  const botClient = botClients.get(user.twitchId);
  if (botClient) {
    clearInterval(botClient.interval);
    botClient.client.disconnect();
    botClients.delete(user.twitchId);
  }
}

// Auth middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
