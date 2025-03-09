document.addEventListener('DOMContentLoaded', function() {
  // Bootstrap Modal setup
  const commandModal = new bootstrap.Modal(document.getElementById('commandModal'));
  let editing = null;
  
  // User data
  let userData = null;
  
  // Fetch user data on page load
  fetchUserData();
  
  // Event listeners
  document.getElementById('addCommandBtn').addEventListener('click', () => {
    document.getElementById('commandName').value = '';
    document.getElementById('commandResponse').value = '';
    editing = null;
    commandModal.show();
  });
  
  document.getElementById('saveCommandBtn').addEventListener('click', saveCommand);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  
  function fetchUserData() {
    fetch('/api/user')
      .then(response => response.json())
      .then(data => {
        userData = data;
        updateUI();
      })
      .catch(error => {
        console.error('Error fetching user data:', error);
      });
  }
  
  function updateUI() {
    if (!userData) return;
    
    // Update username display
    document.getElementById('username-display').textContent = userData.username;
    
    // Update bot status
    const botEnabled = document.getElementById('botEnabled');
    botEnabled.checked = userData.botEnabled;
    updateStatusIndicator(userData.botEnabled);
    
    // Update joke frequency
    document.getElementById('jokeFrequency').value = userData.jokeFrequency;
    
    // Update categories
    const categoryCheckboxes = document.querySelectorAll('.category-checkbox');
    categoryCheckboxes.forEach(checkbox => {
      checkbox.checked = userData.jokeCategories.includes(checkbox.value);
    });
    
    // Update commands list
    renderCommands();
  }
  
  function updateStatusIndicator(isActive) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('status-text');
    
    if (isActive) {
      statusDot.classList.add('active');
      statusText.textContent = 'Bot is active';
    } else {
      statusDot.classList.remove('active');
      statusText.textContent = 'Bot is disabled';
    }
  }
  
  function renderCommands() {
    const commandsList = document.getElementById('commandsList');
    const noCommandsMessage = document.getElementById('noCommandsMessage');
    
    // Clear existing commands
    commandsList.innerHTML = '';
    
    if (userData.customCommands.length === 0) {
      commandsList.appendChild(noCommandsMessage);
      return;
    }
    
    // Hide no commands message
    noCommandsMessage.remove();
    
    // Add each command to the list
    userData.customCommands.forEach(([command, response]) => {
      const commandItem = document.createElement('div');
      commandItem.className = 'command-item';
      commandItem.innerHTML = `
        <div>
          <div class="command-name">!${command}</div>
          <div class="command-response">${response}</div>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-primary edit-btn" data-command="${command}">Edit</button>
          <button class="btn btn-sm btn-outline-danger ms-2 delete-btn" data-command="${command}">Delete</button>
        </div>
      `;
      commandsList.appendChild(commandItem);
    });
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const command = e.target.dataset.command;
        const response = userData.customCommands.find(([cmd]) => cmd === command)[1];
        
        document.getElementById('commandName').value = command;
        document.getElementById('commandResponse').value = response;
        editing = command;
        
        commandModal.show();
      });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const command = e.target.dataset.command;
        userData.customCommands = userData.customCommands.filter(([cmd]) => cmd !== command);
        renderCommands();
      });
    });
  }
  
  function saveCommand() {
    const commandName = document.getElementById('commandName').value.trim().toLowerCase();
    const commandResponse = document.getElementById('commandResponse').value.trim();
    
    if (!commandName || !commandResponse) {
      alert('Both command and response are required!');
      return;
    }
    
    // If editing, remove the old command
    if (editing) {
      userData.customCommands = userData.customCommands.filter(([cmd]) => cmd !== editing);
    }
    
    // Add new command
    if (!userData.customCommands) {
      userData.customCommands = [];
    }
    
    userData.customCommands.push([commandName, commandResponse]);
    
    // Close modal and update UI
    commandModal.hide();
    renderCommands();
  }
  
  function saveSettings() {
    // Get bot enabled status
    const botEnabled = document.getElementById('botEnabled').checked;
    
    // Get joke frequency
    const jokeFrequency = parseInt(document.getElementById('jokeFrequency').value);
    
    // Get selected categories
    const jokeCategories = [];
    document.querySelectorAll('.category-checkbox:checked').forEach(checkbox => {
      jokeCategories.push(checkbox.value);
    });
    
    // Validate
    if (jokeCategories.length === 0) {
      alert('Please select at least one joke category.');
      return;
    }
    
    if (isNaN(jokeFrequency) || jokeFrequency < 1 || jokeFrequency > 60) {
      alert('Please enter a valid joke frequency between 1 and 60 minutes.');
      return;
    }
    
    // Update user data
    userData.botEnabled = botEnabled;
    userData.jokeFrequency = jokeFrequency;
    userData.jokeCategories = jokeCategories;
    
    // Send to server
    fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        updateStatusIndicator(botEnabled);
        alert('Settings saved successfully!');
      } else {
        alert('Error saving settings. Please try again.');
      }
    })
    .catch(error => {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    });
  }
});
