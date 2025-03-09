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
