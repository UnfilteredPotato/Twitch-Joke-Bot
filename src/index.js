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

// Log current working directory and directory structure
console.log('STARTUP: Current directory:', process.cwd());
console.log('STARTUP: __dirname:', __dirname);
console.log('STARTUP: Files in current directory:', fs.readdirSync(process.cwd()));
console.log('STARTUP: Files in src directory:', fs.existsSync(path.join(process.cwd(), 'src')) ? 
  fs.readdirSync(path.join(process.cwd(), 'src')) : 'src folder not found');

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

// Check for environment variables and log their presence
console.log('Environment variables check:');
console.log('TWITCH_CLIENT_ID:', process.env.TWITCH_CLIENT_ID ? 'Set' : 'Not set');
console.log('TWITCH_CLIENT_SECRET:', process.env.TWITCH_CLIENT_SECRET ? 'Set' : 'Not set');
console.log('CALLBACK_URL:', process.env.CALLBACK_URL ? 'Set' : 'Not set');
console.log('CALLBACK_URL_L:', process.env.CALLBACK_URL_L ? 'Set' : 'Not set');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'Set' : 'Not set');
console.log('BOT_USERNAME:', process.env.BOT_USERNAME ? 'Set' : 'Not set');

// Hard-coded callback URL that matches exactly what's registered on Twitch
const CALLBACK_URL = 'https://twitch-joke-bot.onrender.com/auth/twitch/callback';

// Twitch OAuth2 Strategy
passport.use(new OAuth2Strategy({
  authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
  tokenURL: 'https://id.twitch.tv/oauth2/token',
  clientID: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
  // Use the hard-coded callback URL to ensure it matches exactly
  callbackURL: CALLBACK_URL,
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
    
    console.log(`User authenticated: ${username} (${twitchId})`);
    
    // Find or create user
    let user = await User.findOne({ twitchId });
    if (!user) {
      user = new User({
        twitchId,
        username,
        accessToken,
        refreshToken
      });
      console.log(`Created new user: ${username}`);
    } else {
      user.accessToken = accessToken;
      user.refreshToken = refreshToken;
      console.log(`Updated existing user: ${username}`);
    }
    
    await user.save();
    return done(null, user);
  } catch (error) {
    console.error('OAuth error:', error);
    return done(error);
  }
}));

// Create a very simple index.html and dashboard.html if they don't exist
// This is our fallback solution
const createHtmlFiles = () => {
  const indexContent = `
<!DOCTYPE html>
<html>
<head>
  <title>GiggleByte - Twitch Joke Bot</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      background-color: #f0e6ff; 
      text-align: center; 
      padding: 50px; 
    }
    .card { 
      background: white; 
      border-radius: 10px; 
      padding: 30px; 
      box-shadow: 0 4px 10px rgba(0,0,0,0.1); 
      max-width: 600px; 
      margin: 0 auto; 
    }
    h1 { 
      background: linear-gradient(45deg, #ff66c4, #8a4bf5, #66d9ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: bold;
    }
    .btn { 
      background-color: #8a4bf5; 
      color: white; 
      border: none; 
      padding: 10px 20px; 
      border-radius: 5px; 
      text-decoration: none; 
      font-weight: bold; 
      display: inline-block; 
      margin-top: 20px; 
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>GiggleByte</h1>
    <p>The Twitch joke bot that brings laughter to your channel!</p>
    <p>Connect your Twitch account to get started.</p>
    <a href="/auth/twitch" class="btn">Connect with Twitch</a>
  </div>
</body>
</html>
  `;

  const dashboardContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GiggleByte Dashboard</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root {
      --pink: #ff66c4;
      --purple: #8a4bf5;
      --blue: #66d9ff;
      --light-purple: #f0e6ff;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: var(--light-purple);
      color: #333;
    }
    
    .navbar {
      background: linear-gradient(90deg, var(--pink), var(--purple), var(--blue));
    }
    
    .card {
      border-radius: 15px;
      border: none;
      box-shadow: 0 6px 15px rgba(138, 75, 245, 0.15);
      margin-bottom: 20px;
      overflow: hidden;
    }
    
    .card-header {
      background: white;
      border-bottom: 1px solid rgba(138, 75, 245, 0.2);
      font-weight: 600;
      color: var(--purple);
    }
    
    .gradient-text {
      background: linear-gradient(45deg, var(--pink), var(--purple), var(--blue));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: bold;
    }
    
    .btn-primary {
      background: var(--purple);
      border-color: var(--purple);
      box-shadow: 0 4px 10px rgba(138, 75, 245, 0.3);
      transition: all 0.2s;
    }
    
    .btn-primary:hover {
      background: #7c3ade;
      border-color: #7c3ade;
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <nav class="navbar navbar-dark">
    <div class="container">
      <a class="navbar-brand" href="/">
        <span style="font-size: 1.5rem; font-weight: bold;">🤖 GiggleByte</span>
      </a>
      <div class="d-flex align-items-center">
        <a href="/logout" class="btn btn-sm btn-light">Log out</a>
      </div>
    </div>
  </nav>

  <div class="container my-4">
    <div class="row">
      <div class="col-12 mb-4 text-center">
        <h1 class="display-5 gradient-text">GiggleByte Dashboard</h1>
        <p class="lead">Your Twitch joke bot is connected and ready to bring laughter to your channel!</p>
      </div>
    </div>

    <div class="row mb-4">
      <div class="col-md-6 mx-auto">
        <div class="card h-100">
          <div class="card-header">Bot Status</div>
          <div class="card-body d-flex flex-column align-items-center text-center">
            <div class="mb-3">
              <p>GiggleByte is now active on your Twitch channel!</p>
              <p>Viewers can use <strong>!joke</strong> to get a random joke.</p>
            </div>
            
            <div class="mt-auto">
              <a href="/logout" class="btn btn-primary">Logout</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
  `;

  // Write files directly to the filesystem
  try {
    fs.writeFileSync(path.join(process.cwd(), 'index.html'), indexContent);
    fs.writeFileSync(path.join(process.cwd(), 'dashboard.html'), dashboardContent);
    console.log('Created fallback HTML files');
  } catch (error) {
    console.error('Error creating fallback HTML files:', error);
  }
};

// Create fallback HTML files
createHtmlFiles();

// Serve static files from multiple possible locations
app.use(express.static(process.cwd())); // Root directory
app.use('/src', express.static(path.join(process.cwd(), 'src'))); // src directory
app.use(express.json());

// Debug route to check file system
app.get('/debug', (req, res) => {
  const currentDir = process.cwd();
  let result = {
    currentDir,
    dirname: __dirname,
    files: {
      currentDir: fs.readdirSync(currentDir),
    },
    exists: {
      index_root: fs.existsSync(path.join(currentDir, 'index.html')),
      dashboard_root: fs.existsSync(path.join(currentDir, 'dashboard.html')),
      src_folder: fs.existsSync(path.join(currentDir, 'src')),
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      MONGODB_URI: process.env.MONGODB_URI ? 'Set (hidden)' : 'Not set',
      TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID ? 'Set (hidden)' : 'Not set',
      CALLBACK_URL: process.env.CALLBACK_URL ? 'Set (hidden)' : 'Not set',
      CALLBACK_URL_L: process.env.CALLBACK_URL_L ? 'Set (hidden)' : 'Not set',
      BOT_USERNAME: process.env.BOT_USERNAME ? 'Set (hidden)' : 'Not set',
      hardcoded_callback: CALLBACK_URL
    }
  };
  
  // Check src directory if it exists
  if (result.exists.src_folder) {
    const srcDir = path.join(currentDir, 'src');
    result.files.srcDir = fs.readdirSync(srcDir);
    result.exists.index_src = fs.existsSync(path.join(srcDir, 'index.html'));
    result.exists.dashboard_src = fs.existsSync(path.join(srcDir, 'dashboard.html'));
  }
  
  res.json(result);
});

// Routes
app.get('/', (req, res) => {
  console.log('Serving index page');
  
  // Try to serve index.html from src directory first
  const srcIndexPath = path.join(process.cwd(), 'src', 'index.html');
  if (fs.existsSync(srcIndexPath)) {
    console.log('Found index.html in src directory');
    return res.sendFile(srcIndexPath);
  }
  
  // Fallback to root index.html
  console.log('Using fallback index.html from root directory');
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

// Auth routes
app.get('/auth/twitch', passport.authenticate('oauth2'));
app.get('/auth/twitch/callback', 
  passport.authenticate('oauth2', { failureRedirect: '/' }),
  (req, res) => {
    console.log('Authentication successful, redirecting to dashboard');
    res.redirect('/dashboard');
  }
);

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  console.log('Trying to serve dashboard from src folder');
  
  // Try to serve dashboard.html from src directory first
  const srcDashboardPath = path.join(process.cwd(), 'src', 'dashboard.html');
  if (fs.existsSync(srcDashboardPath)) {
    console.log('Found dashboard.html in src folder');
    return res.sendFile(srcDashboardPath);
  }
  
  // Fallback to root dashboard.html
  console.log('Falling back to root dashboard.html');
  res.sendFile(path.join(process.cwd(), 'dashboard.html'));
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
    console.log(`Fetching joke from category: ${category}`);
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
  
  console.log(`Starting bot for user: ${user.username}`);
  console.log(`Bot username: ${process.env.BOT_USERNAME || 'giggle_byte_bot'}`);
  
  // Create new bot client
  const client = new tmi.Client({
    options: { debug: true },
    identity: {
      username: process.env.BOT_USERNAME || 'giggle_byte_bot',
      password: `oauth:${user.accessToken}`
    },
    channels: [user.username]
  });
  
  client.connect()
    .then(() => {
      console.log(`Bot successfully connected to ${user.username}'s channel`);
      // Send a test message to confirm bot is working
      client.say(user.username, `GiggleByte is now active! Type !joke to get a random joke.`)
        .then(() => console.log('Successfully sent welcome message'))
        .catch(error => console.error('Error sending welcome message:', error));
    })
    .catch(error => {
      console.error('Error connecting bot:', error);
      console.error('Bot connection details (without sensitive info):', {
        username: process.env.BOT_USERNAME || 'giggle_byte_bot',
        channel: user.username,
        hasAccessToken: !!user.accessToken
      });
    });
  
  // Set up joke interval
  const interval = setInterval(async () => {
    try {
      const joke = await getRandomJoke(user.jokeCategories);
      console.log(`Sending scheduled joke to ${user.username}'s channel:`, joke);
      client.say(user.username, joke)
        .catch(error => console.error('Error sending scheduled joke:', error));
    } catch (error) {
      console.error('Error with scheduled joke:', error);
    }
  }, user.jokeFrequency * 60 * 1000);
  
  // Set up command handlers
  client.on('message', (channel, tags, message, self) => {
    if (self) return; // Ignore messages from the bot itself
    
    console.log(`Received message in ${channel}: ${message}`);
    
    // Handle !joke command
    if (message.toLowerCase() === '!joke') {
      console.log(`Joke command received from ${tags.username}`);
      getRandomJoke(user.jokeCategories)
        .then(joke => {
          console.log(`Sending joke:`, joke);
          client.say(channel, joke)
            .catch(error => console.error('Error sending joke:', error));
        })
        .catch(error => console.error('Error getting joke:', error));
      return;
    }
    
    // Custom commands
    for (const [cmd, response] of user.customCommands) {
      if (message.toLowerCase() === `!${cmd.toLowerCase()}`) {
        console.log(`Custom command !${cmd} triggered by ${tags.username}`);
        client.say(channel, response)
          .catch(error => console.error(`Error sending response for !${cmd}:`, error));
        return;
      }
    }
  });
  
  // Error handling
  client.on('connecting', () => {
    console.log(`Connecting to ${user.username}'s channel...`);
  });
  
  client.on('connected', () => {
    console.log(`Connected to ${user.username}'s channel`);
  });
  
  client.on('disconnected', (reason) => {
    console.log(`Disconnected from ${user.username}'s channel:`, reason);
    // Try to reconnect after a delay
    setTimeout(() => {
      console.log(`Attempting to reconnect to ${user.username}'s channel...`);
      client.connect()
        .catch(error => console.error('Reconnect error:', error));
    }, 5000);
  });
  
  // Store client and interval
  botClients.set(user.twitchId, { client, interval });
}

function stopBot(user) {
  console.log(`Stopping bot for user: ${user.username}`);
  
  const botClient = botClients.get(user.twitchId);
  if (botClient) {
    clearInterval(botClient.interval);
    console.log('Cleared joke interval');
    
    botClient.client.disconnect()
      .then(() => console.log(`Bot disconnected from ${user.username}'s channel`))
      .catch(error => console.error(`Error disconnecting from ${user.username}'s channel:`, error));
    
    botClients.delete(user.twitchId);
    console.log('Bot stopped successfully');
  } else {
    console.log('No active bot found for this user');
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
