// server.js - Main server file for the joke bot web application
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const tmi = require('tmi.js');
const axios = require('axios');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/twitchjokebot');

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
  User.findById(id, (err, user) => done(err, user));
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
}));

// Static files
app.use(express.static('public'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Auth routes
app.get('/auth/twitch', passport.authenticate('oauth2'));
app.get('/auth/twitch/callback', 
  passport.authenticate('oauth2', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard')
);

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
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
  req.logout();
  res.redirect('/');
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
