document.addEventListener('DOMContentLoaded', function() {
  // Make sure Bootstrap is loaded before trying to initialize components
  let commandModal, notificationToast;
  
  try {
    // Initialize Bootstrap components if available
    if (typeof bootstrap !== 'undefined') {
      const commandModalElement = document.getElementById('commandModal');
      const toastElement = document.getElementById('notificationToast');
      
      if (commandModalElement) {
        commandModal = new bootstrap.Modal(commandModalElement);
      }
      
      if (toastElement) {
        notificationToast = new bootstrap.Toast(toastElement);
      }
    } else {
      console.warn('Bootstrap not found. Some UI components may not work properly.');
    }
  } catch (error) {
    console.error('Error initializing Bootstrap components:', error);
  }
  
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
  const addCommandBtn = document.getElementById('addCommandBtn');
  const saveCommandBtn = document.getElementById('saveCommandBtn');
  const testJokeBtn = document.getElementById('testJokeBtn');
  
  // Event listeners - only add if elements exist
  if (addCommandBtn) {
    addCommandBtn.addEventListener('click', () => {
      const commandNameInput = document.getElementById('commandName');
      const commandResponseInput = document.getElementById('commandResponse');
      const commandModalLabel = document.getElementById('commandModalLabel');
      
      if (commandNameInput) commandNameInput.value = '';
      if (commandResponseInput) commandResponseInput.value = '';
      if (commandModalLabel) commandModalLabel.textContent = 'Add Custom Command';
      
      editing = null;
      if (commandModal) commandModal.show();
    });
  }
  
  if (saveCommandBtn) {
    saveCommandBtn.addEventListener('click', saveCommand);
  }
  
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }
  
  if (testJokeBtn) {
    testJokeBtn.addEventListener('click', generateSampleJoke);
  }
  
  // Update frequency value display when slider changes
  if (jokeFrequency && frequencyValue) {
    jokeFrequency.addEventListener('input', () => {
      frequencyValue.textContent = jokeFrequency.value;
    });
  }
  
  // Toggle category selection when cards are clicked
  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      const category = card.dataset.category;
      const checkbox = document.getElementById('category' + category.charAt(0).toUpperCase() + category.slice(1));
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateCategoryCardSelection(card, checkbox.checked);
      }
    });
  });
  
  // Update card selection when checkboxes are clicked
  categoryCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const category = checkbox.value;
      const card = document.querySelector(`.joke-category-card[data-category="${category}"]`);
      if (card) {
        updateCategoryCardSelection(card, checkbox.checked);
      }
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
    if (statusText) {
      statusText.textContent = 'Loading...';
    }
    
    fetch('/api/user')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        userData = data;
        console.log('User data loaded:', userData);
        updateUI();
      })
      .catch(error => {
        console.error('Error fetching user data:', error);
        showNotification('Error', 'Could not load user data. Please refresh the page.', 'error');
      });
  }
  
  function updateUI() {
    if (!userData) {
      console.warn('No user data available for UI update');
      return;
    }
    
    // Update username display
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) {
      usernameDisplay.textContent = userData.username;
    }
    
    // Update bot status
    if (botEnabled) {
      botEnabled.checked = userData.botEnabled;
      updateStatusIndicator(userData.botEnabled);
    }
    
    // Update joke frequency
    if (jokeFrequency && frequencyValue) {
      jokeFrequency.value = userData.jokeFrequency;
      frequencyValue.textContent = userData.jokeFrequency;
    }
    
    // Update categories
    categoryCheckboxes.forEach(checkbox => {
      const isChecked = userData.jokeCategories && userData.jokeCategories.includes(checkbox.value);
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
    if (!statusDot || !statusText) return;
    
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
    
    if (!commandsList) return;
    
    // Clear existing commands
    commandsList.innerHTML = '';
    
    if (!userData.customCommands || userData.customCommands.length === 0) {
      if (noCommandsMessage) {
        commandsList.appendChild(noCommandsMessage);
      }
      return;
    }
    
    // Create a fragment to improve performance
    const fragment = document.createDocumentFragment();
    
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
      fragment.appendChild(commandItem);
    });
    
    // Add fragment to DOM
    commandsList.appendChild(fragment);
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const command = e.target.dataset.command;
        const commandPair = userData.customCommands.find(([cmd]) => cmd === command);
        
        if (!commandPair) return;
        
        const response = commandPair[1];
        
        const commandNameInput = document.getElementById('commandName');
        const commandResponseInput = document.getElementById('commandResponse');
        const commandModalLabel = document.getElementById('commandModalLabel');
        
        if (commandNameInput) commandNameInput.value = command;
        if (commandResponseInput) commandResponseInput.value = response;
        if (commandModalLabel) commandModalLabel.textContent = 'Edit Custom Command';
        
        editing = command;
        
        if (commandModal) commandModal.show();
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
    const commandNameInput = document.getElementById('commandName');
    const commandResponseInput = document.getElementById('commandResponse');
    
    if (!commandNameInput || !commandResponseInput) return;
    
    const commandName = commandNameInput.value.trim().toLowerCase();
    const commandResponse = commandResponseInput.value.trim();
    
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
    if (commandModal) commandModal.hide();
    renderCommands();
    
    // Save settings to server
    saveSettings();
  }
  
  function saveSettings() {
    // Show loading state
    if (saveButtonText && saveButtonLoader && saveSettingsBtn) {
      saveButtonText.classList.add('d-none');
      saveButtonLoader.classList.remove('d-none');
      saveSettingsBtn.disabled = true;
    }
    
    // Get bot enabled status
    const botEnabledValue = botEnabled ? botEnabled.checked : false;
    
    // Get joke frequency
    const jokeFrequencyValue = jokeFrequency ? parseInt(jokeFrequency.value) : 10;
    
    // Get selected categories
    const jokeCategories = [];
    document.querySelectorAll('.category-checkbox:checked').forEach(checkbox => {
      jokeCategories.push(checkbox.value);
    });
    
    // Validate
    if (jokeCategories.length === 0) {
      showNotification('Error', 'Please select at least one joke category.', 'error');
      if (saveButtonText && saveButtonLoader && saveSettingsBtn) {
        saveButtonText.classList.remove('d-none');
        saveButtonLoader.classList.add('d-none');
        saveSettingsBtn.disabled = false;
      }
      return;
    }
    
    if (isNaN(jokeFrequencyValue) || jokeFrequencyValue < 1 || jokeFrequencyValue > 60) {
      showNotification('Error', 'Please enter a valid joke frequency between 1 and 60 minutes.', 'error');
      if (saveButtonText && saveButtonLoader && saveSettingsBtn) {
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
    
    console.log('Sending updated settings to server:', userData);
    
    // Send to server
    fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Reset button state
      if (saveButtonText && saveButtonLoader && saveSettingsBtn) {
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
      if (saveButtonText && saveButtonLoader && saveSettingsBtn) {
        saveButtonText.classList.remove('d-none');
        saveButtonLoader.classList.add('d-none');
        saveSettingsBtn.disabled = false;
      }
      showNotification('Error', 'Error saving settings. Please try again.', 'error');
    });
  }
  
  function generateSampleJoke() {
    console.log('Generating sample joke...');
    const sampleJokeContainer = document.getElementById('sampleJokeContainer');
    const sampleJokeText = document.getElementById('sampleJokeText');
    
    if (!sampleJokeContainer || !sampleJokeText) {
      console.error('Sample joke container or text element not found');
      return;
    }
    
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
    console.log('Selected random category:', randomCategory);
    
    // Fetch a joke from the API
    fetch(`https://v2.jokeapi.dev/joke/${randomCategory}?blacklistFlags=nsfw,racist,sexist`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Joke API response:', data);
        if (data.error) {
          throw new Error(data.message || 'Error fetching joke');
        }
        
        if (data.type === 'single') {
          sampleJokeText.textContent = data.joke;
        } else if (data.type === 'twopart') {
          sampleJokeText.textContent = `${data.setup} ... ${data.delivery}`;
        } else {
          sampleJokeText.textContent = "Couldn't parse joke format";
        }
      })
      .catch(error => {
        console.error('Error fetching joke:', error);
        sampleJokeText.textContent = "Why did the chicken cross the road? To get to the other side!";
      });
  }
  
  function showNotification(title, message, type) {
    console.log(`${type.toUpperCase()}: ${title} - ${message}`);
    
    const toastElement = document.getElementById('notificationToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toastElement || !toastTitle || !toastMessage || !notificationToast) {
      // Fallback to alert if toast elements don't exist
      alert(`${title}: ${message}`);
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
