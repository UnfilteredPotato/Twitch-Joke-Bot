document.addEventListener('DOMContentLoaded', function() {
  // Bootstrap components
  const commandModal = new bootstrap.Modal(document.getElementById('commandModal'));
  const notificationToast = new bootstrap.Toast(document.getElementById('notificationToast'));
  
  // Variables
  let userData = null;
  let editing = null;
  
  // Elements
  const botEnabled = document.getElementById('botEnabled');
  const jokeFrequency = document.getElementById('jokeFrequency');
  const frequencyValue = document.getElementById('frequencyValue');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const saveButtonText = document.getElementById('saveButtonText');
  const saveButtonLoader = document.getElementById('saveButtonLoader');
  const categoryCards = document.querySelectorAll('.joke-category-card');
  const categoryCheckboxes = document.querySelectorAll('.category-checkbox');
  
  // Event listeners
  document.getElementById('addCommandBtn').addEventListener('click', () => {
    document.getElementById('commandName').value = '';
    document.getElementById('commandResponse').value = '';
    document.getElementById('commandModalLabel').textContent = 'Add Custom Command';
    editing = null;
    commandModal.show();
  });
  
  document.getElementById('saveCommandBtn').addEventListener('click', saveCommand);
  saveSettingsBtn.addEventListener('click', saveSettings);
  
  document.getElementById('testJokeBtn').addEventListener('click', generateSampleJoke);
  
  // Update frequency value display when slider changes
  jokeFrequency.addEventListener('input', () => {
    frequencyValue.textContent = jokeFrequency.value;
  });
  
  // Toggle category selection when cards are clicked
  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      const category = card.dataset.category;
      const checkbox = document.getElementById('category' + category.charAt(0).toUpperCase() + category.slice(1));
      checkbox.checked = !checkbox.checked;
      updateCategoryCardSelection(card, checkbox.checked);
    });
  });
  
  // Update card selection when checkboxes are clicked
  categoryCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const category = checkbox.value;
      const card = document.querySelector(`.joke-category-card[data-category="${category}"]`);
      updateCategoryCardSelection(card, checkbox.checked);
    });
  });
  
  // Load user data when page loads
  fetchUserData();
  
  // Functions
  function updateCategoryCardSelection(card, isSelected) {
    if (isSelected) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  }
  
  function fetchUserData() {
    // Show loading state
    statusText.textContent = 'Loading...';
    
    fetch('/api/user')
      .then(response => response.json())
      .then(data => {
        userData = data;
        updateUI();
      })
      .catch(error => {
        console.error('Error fetching user data:', error);
        showNotification('Error', 'Could not load user data. Please refresh the page.', 'error');
      });
  }
  
  function updateUI() {
    if (!userData) return;
    
    // Update username display
    document.getElementById('username-display').textContent = userData.username;
    
    // Update bot status
    botEnabled.checked = userData.botEnabled;
    updateStatusIndicator(userData.botEnabled);
    
    // Update joke frequency
    jokeFrequency.value = userData.jokeFrequency;
    frequencyValue.textContent = userData.jokeFrequency;
    
    // Update categories
    categoryCheckboxes.forEach(checkbox => {
      const isChecked = userData.jokeCategories.includes(checkbox.value);
      checkbox.checked = isChecked;
      
      const card = document.querySelector(`.joke-category-card[data-category="${checkbox.value}"]`);
      if (card) {
        updateCategoryCardSelection(card, isChecked);
      }
    });
    
    // Update commands list
    renderCommands();
  }
  
  function updateStatusIndicator(isActive) {
    if (isActive) {
      statusDot.classList.remove('inactive');
      statusDot.classList.add('active');
      statusText.textContent = 'GiggleByte is active';
    } else {
      statusDot.classList.remove('active');
      statusDot.classList.add('inactive');
      statusText.textContent = 'GiggleByte is disabled';
    }
  }
  
  function renderCommands() {
    const commandsList = document.getElementById('commandsList');
    const noCommandsMessage = document.getElementById('noCommandsMessage');
    
    // Clear existing commands
    commandsList.innerHTML = '';
    
    if (!userData.customCommands || userData.customCommands.length === 0) {
      commandsList.appendChild(noCommandsMessage);
      return;
    }
    
    // Hide no commands message
    try {
      commandsList.removeChild(noCommandsMessage);
    } catch (error) {
      // Element might not be a child
    }
    
    // Add each command to the list
    userData.customCommands.forEach(([command, response]) => {
      const commandItem = document.createElement('div');
      commandItem.className = 'command-item';
      commandItem.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <div class="command-name">!${command}</div>
            <div class="command-response">${response}</div>
          </div>
          <div>
            <button class="btn btn-sm btn-outline-primary edit-btn me-2" data-command="${command}">Edit</button>
            <button class="btn btn-sm btn-outline-danger delete-btn" data-command="${command}">Delete</button>
          </div>
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
        document.getElementById('commandModalLabel').textContent = 'Edit Custom Command';
        editing = command;
        
        commandModal.show();
      });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const command = e.target.dataset.command;
        
        if (confirm(`Are you sure you want to delete the command !${command}?`)) {
          userData.customCommands = userData.customCommands.filter(([cmd]) => cmd !== command);
          renderCommands();
          saveSettings();
        }
      });
    });
  }
  
  function saveCommand() {
    const commandName = document.getElementById('commandName').value.trim().toLowerCase();
    const commandResponse = document.getElementById('commandResponse').value.trim();
    
    if (!commandName || !commandResponse) {
      showNotification('Error', 'Both command and response are required!', 'error');
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
    
    // Save settings to server
    saveSettings();
  }
  
  function saveSettings() {
    // Show loading state
    if (saveButtonText && saveButtonLoader) {
      saveButtonText.classList.add('d-none');
      saveButtonLoader.classList.remove('d-none');
      saveSettingsBtn.disabled = true;
    }
    
    // Get bot enabled status
    const botEnabledValue = botEnabled.checked;
    
    // Get joke frequency
    const jokeFrequencyValue = parseInt(jokeFrequency.value);
    
    // Get selected categories
    const jokeCategories = [];
    document.querySelectorAll('.category-checkbox:checked').forEach(checkbox => {
      jokeCategories.push(checkbox.value);
    });
    
    // Validate
    if (jokeCategories.length === 0) {
      showNotification('Error', 'Please select at least one joke category.', 'error');
      if (saveButtonText && saveButtonLoader) {
        saveButtonText.classList.remove('d-none');
        saveButtonLoader.classList.add('d-none');
        saveSettingsBtn.disabled = false;
      }
      return;
    }
    
    if (isNaN(jokeFrequencyValue) || jokeFrequencyValue < 1 || jokeFrequencyValue > 60) {
      showNotification('Error', 'Please enter a valid joke frequency between 1 and 60 minutes.', 'error');
      if (saveButtonText && saveButtonLoader) {
        saveButtonText.classList.remove('d-none');
        saveButtonLoader.classList.add('d-none');
        saveSettingsBtn.disabled = false;
      }
      return;
    }
    
    // Update user data
    userData.botEnabled = botEnabledValue;
    userData.jokeFrequency = jokeFrequencyValue;
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
      // Reset button state
      if (saveButtonText && saveButtonLoader) {
        saveButtonText.classList.remove('d-none');
        saveButtonLoader.classList.add('d-none');
        saveSettingsBtn.disabled = false;
      }
      
      if (data.success) {
        updateStatusIndicator(botEnabledValue);
        showNotification('Success', 'Settings saved successfully!', 'success');
      } else {
        showNotification('Error', 'Error saving settings. Please try again.', 'error');
      }
    })
    .catch(error => {
      console.error('Error saving settings:', error);
      if (saveButtonText && saveButtonLoader) {
        saveButtonText.classList.remove('d-none');
        saveButtonLoader.classList.add('d-none');
        saveSettingsBtn.disabled = false;
      }
      showNotification('Error', 'Error saving settings. Please try again.', 'error');
    });
  }
  
  function generateSampleJoke() {
    const sampleJokeContainer = document.getElementById('sampleJokeContainer');
    const sampleJokeText = document.getElementById('sampleJokeText');
    
    if (!sampleJokeContainer || !sampleJokeText) return;
    
    // Get selected categories
    const selectedCategories = [];
    document.querySelectorAll('.category-checkbox:checked').forEach(checkbox => {
      selectedCategories.push(checkbox.value);
    });
    
    if (selectedCategories.length === 0) {
      showNotification('Error', 'Please select at least one joke category.', 'error');
      return;
    }
    
    // Show loading
    sampleJokeText.textContent = 'Loading joke...';
    sampleJokeContainer.classList.remove('d-none');
    
    // Select a random category from the selected ones
    const randomCategory = selectedCategories[Math.floor(Math.random() * selectedCategories.length)];
    
    // Fetch a joke from the API
    fetch(`https://v2.jokeapi.dev/joke/${randomCategory}?blacklistFlags=nsfw,racist,sexist`)
      .then(response => response.json())
      .then(data => {
        if (data.type === 'single') {
          sampleJokeText.textContent = data.joke;
        } else {
          sampleJokeText.textContent = `${data.setup} ... ${data.delivery}`;
        }
      })
      .catch(error => {
        console.error('Error fetching joke:', error);
        sampleJokeText.textContent = "Why did the chicken cross the road? To get to the other side!";
      });
  }
  
  function showNotification(title, message, type) {
    const toastElement = document.getElementById('notificationToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toastElement || !toastTitle || !toastMessage) {
      // Fallback to alert if toast elements don't exist
      alert(message);
      return;
    }
    
    // Set toast content
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Set toast color based on type
    if (type === 'error') {
      toastElement.classList.add('border-danger');
      toastElement.classList.remove('border-success');
    } else {
      toastElement.classList.add('border-success');
      toastElement.classList.remove('border-danger');
    }
    
    // Show toast
    notificationToast.show();
  }
});
