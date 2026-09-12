// State variables
let logins = [];
let categories = [];
let activeTab = 'all';
let activeEntry = null;
let isSetupMode = false;
let extensionToken = '';
let selectedEmoji = '📁';

// Emoji palette for category picker
const EMOJI_PALETTE = [
  '📁','🌐','🖥️','🔑','🏦','☁️','🔧','📧','🎮','🛒',
  '📱','💼','🏠','🎓','🏥','🔒','💳','📊','🚀','⚡',
  '🎯','💡','🔔','📡','🗂️','🌍','🛡️','🤖','🎨','📸'
];

// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const authForm = document.getElementById('auth-form');
const masterPasswordInput = document.getElementById('master-password');
const toggleAuthPassword = document.getElementById('toggle-auth-password');
const authError = document.getElementById('auth-error');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmitBtn = document.getElementById('auth-submit-btn');

const appContainer = document.getElementById('app-container');
const lockVaultBtn = document.getElementById('lock-vault-btn');
const searchInput = document.getElementById('search-input');
const addEntryBtn = document.getElementById('add-entry-btn');
const entriesList = document.getElementById('entries-list');
const detailPane = document.getElementById('detail-pane');

const entryModal = document.getElementById('entry-modal');
const entryForm = document.getElementById('entry-form');
const entryIdInput = document.getElementById('entry-id');
const entryTypeInput = document.getElementById('entry-type');
const entryCategorySelect = document.getElementById('entry-category');
const entryTitleInput = document.getElementById('entry-title');
const entryUrlInput = document.getElementById('entry-url');
const entryHostInput = document.getElementById('entry-host');
const entryPortInput = document.getElementById('entry-port');
const entryKeyPathInput = document.getElementById('entry-keypath');
const entryExtraOptionsInput = document.getElementById('entry-extraoptions');
const entryUsernameInput = document.getElementById('entry-username');
const entryPasswordInput = document.getElementById('entry-password');
const entryNotesInput = document.getElementById('entry-notes');
const websiteFields = document.getElementById('website-fields');
const sshFields = document.getElementById('ssh-fields');
const jumpsListEdit = document.getElementById('jumps-list-edit');
const addJumpRowBtn = document.getElementById('add-jump-row-btn');

const modalTitle = document.getElementById('modal-title');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const toggleFormPassword = document.getElementById('toggle-form-password');
const generatePasswordBtn = document.getElementById('generate-password-btn');
const toast = document.getElementById('toast');

// Dynamic category DOM elements
const dynamicCategoriesContainer = document.getElementById('dynamic-categories');
const addCategoryBtn = document.getElementById('add-category-btn');
const newCategoryForm = document.getElementById('new-category-form');
const categoryEmojiBtn = document.getElementById('category-emoji-btn');
const newCategoryNameInput = document.getElementById('new-category-name');
const saveCategoryBtn = document.getElementById('save-category-btn');
const cancelCategoryBtn = document.getElementById('cancel-category-btn');
const emojiPickerPopover = document.getElementById('emoji-picker-popover');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  // Load and apply saved theme
  const savedTheme = localStorage.getItem('passlock-theme') || 'cyberpunk';
  applyTheme(savedTheme);

  // Check if DB exists
  const exists = await window.api.dbExists();
  if (!exists) {
    isSetupMode = true;
    authTitle.textContent = "Setup Master Password";
    authSubtitle.textContent = "Create a master password. This password will encrypt all your credentials. Make sure you don't forget it!";
    authSubmitBtn.textContent = "Create Vault";
  }
  
  // Initial draw of UI
  authOverlay.style.display = 'flex';
  
  // Bind all event listeners
  bindEvents();
  buildEmojiPicker();
});

// --- Event Listeners ---
function bindEvents() {
  // Toggle password visibility on login screen
  toggleAuthPassword.addEventListener('click', () => {
    const type = masterPasswordInput.type === 'password' ? 'text' : 'password';
    masterPasswordInput.type = type;
  });

  // Submit master password form
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = masterPasswordInput.value;
    authError.style.display = 'none';

    if (isSetupMode) {
      const res = await window.api.setup(password);
      if (res.success) {
        unlockApp();
      } else {
        showAuthError("Failed to initialize database: " + res.error);
      }
    } else {
      const res = await window.api.unlock(password);
      if (res.success) {
        unlockApp();
      } else {
        showAuthError("Incorrect password. Please try again.");
      }
    }
  });

  // Lock Vault
  lockVaultBtn.addEventListener('click', async () => {
    await window.api.lock();
    logins = [];
    categories = [];
    activeEntry = null;
    masterPasswordInput.value = '';
    authOverlay.style.display = 'flex';
    authTitle.textContent = "Unlock Vault";
    authSubtitle.textContent = "Enter your master password to decrypt your credential database.";
    authSubmitBtn.textContent = "Unlock Vault";
    isSetupMode = false;
    renderDetails();
  });

  // Sidebar "All Items" tab
  const allItemsTab = document.querySelector('.menu-item[data-tab="all"]');
  if (allItemsTab) {
    allItemsTab.addEventListener('click', () => {
      setActiveTab('all');
    });
  }

  // Sidebar "Settings" tab
  const settingsTab = document.querySelector('.sidebar-footer .menu-item[data-tab="settings"]');
  if (settingsTab) {
    settingsTab.addEventListener('click', () => {
      setActiveTab('settings');
    });
  }

  // Search filter
  searchInput.addEventListener('input', () => {
    renderListings();
  });

  // Open Import Modal
  const importBtn = document.getElementById('import-btn');
  if (importBtn) {
    importBtn.addEventListener('click', openImportModal);
  }

  // Open Add Credential Modal
  addEntryBtn.addEventListener('click', () => {
    openModal();
  });

  // Modal Cancel and Close buttons
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);

  // Modal Save Submit
  entryForm.addEventListener('submit', handleSaveEntry);

  // Type toggle in modal
  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.getAttribute('data-type');
      entryTypeInput.value = type;
      toggleFormFields(type);
    });
  });

  // Toggle password visibility in modal
  toggleFormPassword.addEventListener('click', () => {
    const type = entryPasswordInput.type === 'password' ? 'text' : 'password';
    entryPasswordInput.type = type;
  });

  // Generate password button
  generatePasswordBtn.addEventListener('click', () => {
    entryPasswordInput.value = generateSecurePassword();
    entryPasswordInput.type = 'text';
  });

  // Add Jump Host row button
  addJumpRowBtn.addEventListener('click', () => {
    addJumpRow();
  });

  // --- Category Management ---
  addCategoryBtn.addEventListener('click', () => {
    selectedEmoji = '📁';
    categoryEmojiBtn.textContent = selectedEmoji;
    newCategoryNameInput.value = '';
    newCategoryForm.style.display = 'block';
    addCategoryBtn.style.display = 'none';
    newCategoryNameInput.focus();
  });

  cancelCategoryBtn.addEventListener('click', () => {
    newCategoryForm.style.display = 'none';
    addCategoryBtn.style.display = 'flex';
    emojiPickerPopover.style.display = 'none';
  });

  saveCategoryBtn.addEventListener('click', async () => {
    const name = newCategoryNameInput.value.trim();
    if (!name) {
      newCategoryNameInput.focus();
      return;
    }

    const res = await window.api.saveCategory({ name, icon: selectedEmoji });
    if (res.success) {
      showToast(`Group "${name}" created`);
      newCategoryForm.style.display = 'none';
      addCategoryBtn.style.display = 'flex';
      emojiPickerPopover.style.display = 'none';
      await refreshData();
    }
  });

  // Enter key on category name input
  newCategoryNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCategoryBtn.click();
    }
    if (e.key === 'Escape') {
      cancelCategoryBtn.click();
    }
  });

  // Emoji picker toggle
  categoryEmojiBtn.addEventListener('click', () => {
    emojiPickerPopover.style.display = emojiPickerPopover.style.display === 'none' ? 'grid' : 'none';
  });

  // Close emoji picker when clicking outside
  document.addEventListener('click', (e) => {
    if (!categoryEmojiBtn.contains(e.target) && !emojiPickerPopover.contains(e.target)) {
      emojiPickerPopover.style.display = 'none';
    }
  });
}

// Build emoji picker grid
function buildEmojiPicker() {
  emojiPickerPopover.innerHTML = '';
  EMOJI_PALETTE.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-option';
    btn.textContent = emoji;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      selectedEmoji = emoji;
      categoryEmojiBtn.textContent = emoji;
      emojiPickerPopover.style.display = 'none';
    });
    emojiPickerPopover.appendChild(btn);
  });
}

// Set active tab and re-render
function setActiveTab(tab) {
  activeTab = tab;
  activeEntry = null;

  // Update all sidebar active states
  document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));

  if (tab === 'all') {
    const allItem = document.querySelector('.menu-item[data-tab="all"]');
    if (allItem) allItem.classList.add('active');
  } else if (tab === 'settings') {
    const settingsItem = document.querySelector('.sidebar-footer .menu-item[data-tab="settings"]');
    if (settingsItem) settingsItem.classList.add('active');
  } else {
    const catItem = document.querySelector(`.category-item[data-cat-id="${tab}"]`);
    if (catItem) catItem.classList.add('active');
  }

  renderListings();
  renderDetails();
}

// --- Auth Helpers ---
function showAuthError(message) {
  authError.textContent = message;
  authError.style.display = 'block';
}

async function unlockApp() {
  authOverlay.style.display = 'none';
  masterPasswordInput.value = '';
  await refreshData();
}

async function refreshData() {
  const loginsRes = await window.api.getLogins();
  if (loginsRes.success) {
    logins = loginsRes.logins;
  }

  const catsRes = await window.api.getCategories();
  if (catsRes.success) {
    categories = catsRes.categories;
  }

  renderSidebar();
  renderListings();
}

// --- Render Dynamic Sidebar Categories ---
function renderSidebar() {
  dynamicCategoriesContainer.innerHTML = '';

  categories.forEach(cat => {
    const count = logins.filter(l => l.category === cat.id).length;

    const item = document.createElement('div');
    item.className = `category-item ${activeTab === cat.id ? 'active' : ''}`;
    item.setAttribute('data-cat-id', cat.id);

    item.innerHTML = `
      <span class="cat-emoji">${cat.icon || '📁'}</span>
      <span class="cat-name">${escapeHtml(cat.name)}</span>
      <span class="cat-count">${count}</span>
      <button class="cat-delete-btn" title="Delete group">×</button>
    `;

    // Click to filter by this category
    item.addEventListener('click', (e) => {
      if (e.target.closest('.cat-delete-btn')) return;
      setActiveTab(cat.id);
    });

    // Delete category
    const deleteBtn = item.querySelector('.cat-delete-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete group "${cat.name}"? Credentials in this group won't be deleted — they'll become uncategorized.`)) {
        const res = await window.api.deleteCategory(cat.id);
        if (res.success) {
          showToast(`Group "${cat.name}" deleted`);
          if (activeTab === cat.id) {
            activeTab = 'all';
          }
          await refreshData();
        }
      }
    });

    dynamicCategoriesContainer.appendChild(item);
  });
}

// --- Rendering Logins ---
function renderListings() {
  entriesList.innerHTML = '';
  const query = searchInput.value.toLowerCase().trim();

  // If in settings page, draw settings inside the entire dashboard workspace instead of cards
  if (activeTab === 'settings') {
    renderSettingsTab();
    return;
  }

  // Restore dashboard split if settings was open
  const dashboardContent = document.querySelector('.dashboard-content');
  if (dashboardContent) dashboardContent.classList.remove('full-width');
  detailPane.style.display = 'flex';

  const headerActions = document.querySelector('.header-actions');
  const searchContainer = document.querySelector('.search-bar-container');
  if (headerActions) headerActions.style.display = 'flex';
  if (searchContainer) searchContainer.style.display = 'flex';

  const filteredLogins = logins.filter(login => {
    // 1. Filter by category tab
    if (activeTab !== 'all') {
      if (login.category !== activeTab) {
        return false;
      }
    }
    
    // 2. Filter by search query
    if (query) {
      const matchTitle = login.title.toLowerCase().includes(query);
      const matchUsername = login.username.toLowerCase().includes(query);
      const matchHost = login.host && login.host.toLowerCase().includes(query);
      const matchUrl = login.url && login.url.toLowerCase().includes(query);
      return matchTitle || matchUsername || matchHost || matchUrl;
    }
    return true;
  });

  if (filteredLogins.length === 0) {
    entriesList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); margin-top: 40px; font-size: 0.9rem;">
        No credentials found.
      </div>
    `;
    return;
  }

  filteredLogins.forEach(login => {
    const isSelected = activeEntry && activeEntry.id === login.id;
    const card = document.createElement('div');
    card.className = `entry-card ${isSelected ? 'active' : ''}`;
    
    // Get category info for the icon
    const loginCat = categories.find(c => c.id === login.category);
    const avatarContent = loginCat
      ? `<span style="font-size: 1.2rem;">${loginCat.icon}</span>`
      : (login.type === 'ssh' 
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`);

    card.innerHTML = `
      <div class="entry-info">
        <div class="entry-avatar">${avatarContent}</div>
        <div class="entry-metadata">
          <h4>${escapeHtml(login.title)}</h4>
          <p>${escapeHtml(login.username)}</p>
        </div>
      </div>
      <div class="entry-actions-inline">
        <button class="icon-btn-inline copy-pw-quick-btn" title="Copy Password">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      // Don't select entry if they clicked the quick-copy password button
      if (e.target.closest('.copy-pw-quick-btn')) {
        e.stopPropagation();
        triggerCopy(login.password, "Password");
        return;
      }

      activeEntry = login;
      renderListings();
      renderDetails();
    });

    entriesList.appendChild(card);
  });
}

// --- Rendering Details ---
function renderDetails() {
  if (!activeEntry) {
    detailPane.innerHTML = `
      <div class="empty-detail-state">
        <div class="big-icon">📁</div>
        <p>Select a credential card to view details or launch SSH sessions.</p>
      </div>
    `;
    return;
  }

  const login = activeEntry;
  const isSsh = login.type === 'ssh';

  // Get category info
  const loginCat = categories.find(c => c.id === login.category);
  const typeText = loginCat ? loginCat.name : (isSsh ? 'SSH Server' : 'Website');
  const headerEmoji = loginCat ? loginCat.icon : (isSsh ? '🖥️' : '🌐');

  let detailsHtml = `
    <div class="detail-header">
      <div class="detail-avatar"><span style="font-size: 1.6rem;">${headerEmoji}</span></div>
      <div class="detail-title">
        <h3>${escapeHtml(login.title)}</h3>
        <span>${escapeHtml(typeText)}</span>
      </div>
    </div>

    <div class="detail-body">

    <!-- Username Field -->
    <div class="detail-field">
      <div class="detail-field-label">Username</div>
      <div class="detail-field-value-wrapper">
        <div class="detail-field-value">${escapeHtml(login.username)}</div>
        <button class="detail-field-btn copy-btn" data-value="${escapeHtml(login.username)}" data-label="Username">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </div>
    </div>

    <!-- Password Field -->
    <div class="detail-field">
      <div class="detail-field-label">Password</div>
      <div class="detail-field-value-wrapper">
        <div id="detail-pw-val" class="detail-field-value password-masked">${escapeHtml(login.password)}</div>
        <button id="toggle-detail-pw" class="detail-field-btn" title="Toggle visibility">👁</button>
        <button class="detail-field-btn copy-btn" data-value="${escapeHtml(login.password)}" data-label="Password">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </div>
    </div>
  `;

  // SSH-specific fields
  if (isSsh) {
    detailsHtml += `
      <!-- Host Field -->
      <div class="detail-field">
        <div class="detail-field-label">Host</div>
        <div class="detail-field-value-wrapper">
          <div class="detail-field-value">${escapeHtml(login.host || '')}${login.port && login.port !== 22 ? ':' + login.port : ''}</div>
          <button class="detail-field-btn copy-btn" data-value="${escapeHtml(login.host || '')}" data-label="Host">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>
    `;

    // Key Path
    if (login.keyPath) {
      detailsHtml += `
        <div class="detail-field">
          <div class="detail-field-label">Private Key</div>
          <div class="detail-field-value-wrapper">
            <div class="detail-field-value">${escapeHtml(login.keyPath)}</div>
          </div>
        </div>
      `;
    }

    // Jump Hosts
    if (login.jumps && login.jumps.length > 0) {
      detailsHtml += `
        <div class="detail-field">
          <div class="detail-field-label">Proxy Jumps</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
      `;
      login.jumps.forEach((jump, idx) => {
        const passBadge = jump.password ? '<span style="color: var(--accent-cyan); font-size: 0.75rem; font-weight: 600; margin-left: 8px;">🔑 Password set</span>' : '';
        detailsHtml += `
            <div style="background-color: hsla(230, 25%, 10%, 0.4); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
              <div><span style="color: var(--text-muted);">Jump ${idx + 1}:</span> ${escapeHtml(jump.username || 'root')}@${escapeHtml(jump.host)}:${jump.port || 22}</div>
              ${passBadge}
            </div>
        `;
      });
      detailsHtml += `
          </div>
        </div>
      `;
    }
  }

  // Website URL
  if (!isSsh && login.url) {
    detailsHtml += `
      <!-- URL Field -->
      <div class="detail-field">
        <div class="detail-field-label">Website URL</div>
        <div class="detail-field-value-wrapper">
          <div class="detail-field-value">${escapeHtml(login.url || '')}</div>
          <button class="detail-field-btn open-url-btn" data-value="${escapeHtml(login.url || '')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </button>
          <button class="detail-field-btn copy-btn" data-value="${escapeHtml(login.url || '')}" data-label="URL">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>
    `;
  }

  // Notes field
  if (login.notes && login.notes.trim()) {
    detailsHtml += `
      <!-- Notes Field -->
      <div class="detail-field">
        <div class="detail-field-label">Notes</div>
        <div style="background-color: hsla(230, 25%, 10%, 0.4); border: 1px solid var(--border-color); padding: 12px 16px; border-radius: var(--radius-md); font-size: 0.85rem; line-height: 1.4; white-space: pre-wrap;">${escapeHtml(login.notes)}</div>
      </div>
    `;
  }

  // Bottom action buttons (Launch SSH, Edit, Delete)
  detailsHtml += `
    </div> <!-- end body -->
    
    <div class="action-buttons">
  `;

  if (isSsh) {
    detailsHtml += `
      <button id="ssh-connect-btn" class="btn-launch-ssh">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
        Open SSH Session
      </button>
    `;
  }

  detailsHtml += `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <button id="edit-entry-btn" class="btn-secondary" style="justify-content: center;">Edit</button>
        <button id="delete-entry-btn" class="btn-secondary" style="justify-content: center; color: var(--danger); border-color: hsla(355, 80%, 55%, 0.2); background-color: hsla(355, 80%, 55%, 0.05);">Delete</button>
      </div>
    </div>
  `;

  detailPane.innerHTML = detailsHtml;

  // Bind new details controls
  bindDetailsControls();
}

function bindDetailsControls() {
  // Toggle password masking
  const togglePwBtn = document.getElementById('toggle-detail-pw');
  const pwVal = document.getElementById('detail-pw-val');
  if (togglePwBtn && pwVal) {
    togglePwBtn.addEventListener('click', () => {
      if (pwVal.classList.contains('password-masked')) {
        pwVal.classList.remove('password-masked');
        togglePwBtn.textContent = '🙈';
      } else {
        pwVal.classList.add('password-masked');
        togglePwBtn.textContent = '👁';
      }
    });
  }

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-value');
      const label = btn.getAttribute('data-label');
      triggerCopy(val, label);
    });
  });

  // Open URL button
  const openUrlBtn = document.querySelector('.open-url-btn');
  if (openUrlBtn) {
    openUrlBtn.addEventListener('click', async () => {
      const url = openUrlBtn.getAttribute('data-value');
      const res = await window.api.openUrl(url);
      if (res.success) {
        showToast("Website opened in browser");
      } else {
        showToast("Failed to open URL");
      }
    });
  }

  // Launch SSH button
  const sshConnectBtn = document.getElementById('ssh-connect-btn');
  if (sshConnectBtn) {
    sshConnectBtn.addEventListener('click', async () => {
      showToast("Launching SSH in native terminal...");
      const res = await window.api.openSsh(activeEntry);
      if (!res.success) {
        showToast("Error launching terminal: " + res.error);
      }
    });
  }

  // Edit Entry Button
  const editEntryBtn = document.getElementById('edit-entry-btn');
  if (editEntryBtn) {
    editEntryBtn.addEventListener('click', () => {
      openModal(activeEntry);
    });
  }

  // Delete Entry Button
  const deleteEntryBtn = document.getElementById('delete-entry-btn');
  if (deleteEntryBtn) {
    deleteEntryBtn.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete the credential "${activeEntry.title}"?`)) {
        const res = await window.api.deleteLogin(activeEntry.id);
        if (res.success) {
          showToast("Credential deleted");
          activeEntry = null;
          await refreshData();
          renderDetails();
        }
      }
    });
  }
}

// --- Settings Page Rendering ---
function renderSettingsTab() {
  // Hide details pane and make list full width
  const dashboardContent = document.querySelector('.dashboard-content');
  if (dashboardContent) dashboardContent.classList.add('full-width');
  detailPane.style.display = 'none';

  const headerActions = document.querySelector('.header-actions');
  const searchContainer = document.querySelector('.search-bar-container');
  if (headerActions) headerActions.style.display = 'none';
  if (searchContainer) searchContainer.style.display = 'none';

  const currentTheme = localStorage.getItem('passlock-theme') || 'cyberpunk';

  entriesList.innerHTML = `
    <div class="settings-container">
      <div class="settings-header">
        <h2>Settings</h2>
        <p>Configure app appearance, color themes, and browser extension integrations.</p>
      </div>
      
      <!-- App Color Theme Card -->
      <div class="settings-card">
        <h4>App Color Theme</h4>
        <p>Customize the visual accent colors and background tones of the PassLock desktop app interface.</p>
        
        <div class="theme-selector-grid">
          <div class="theme-card ${currentTheme === 'cyberpunk' ? 'active' : ''}" data-theme="cyberpunk">
            <div class="theme-color-previews">
              <div class="theme-color-dot" style="background-color: hsl(185, 100%, 50%);"></div>
              <div class="theme-color-dot" style="background-color: hsl(270, 100%, 65%);"></div>
            </div>
            <span>Cyberpunk</span>
          </div>
          
          <div class="theme-card ${currentTheme === 'nord' ? 'active' : ''}" data-theme="nord">
            <div class="theme-color-previews">
              <div class="theme-color-dot" style="background-color: hsl(193, 43%, 67%);"></div>
              <div class="theme-color-dot" style="background-color: hsl(213, 32%, 52%);"></div>
            </div>
            <span>Nord Arctic</span>
          </div>
          
          <div class="theme-card ${currentTheme === 'forest' ? 'active' : ''}" data-theme="forest">
            <div class="theme-color-previews">
              <div class="theme-color-dot" style="background-color: hsl(145, 60%, 50%);"></div>
              <div class="theme-color-dot" style="background-color: hsl(165, 40%, 35%);"></div>
            </div>
            <span>Forest Emerald</span>
          </div>
          
          <div class="theme-card ${currentTheme === 'amber' ? 'active' : ''}" data-theme="amber">
            <div class="theme-color-previews">
              <div class="theme-color-dot" style="background-color: hsl(38, 95%, 55%);"></div>
              <div class="theme-color-dot" style="background-color: hsl(15, 80%, 50%);"></div>
            </div>
            <span>Midnight Amber</span>
          </div>
          
          <div class="theme-card ${currentTheme === 'rose' ? 'active' : ''}" data-theme="rose">
            <div class="theme-color-previews">
              <div class="theme-color-dot" style="background-color: hsl(343, 76%, 68%);"></div>
              <div class="theme-color-dot" style="background-color: hsl(35, 81%, 73%);"></div>
            </div>
            <span>Rose Pine</span>
          </div>
        </div>
      </div>

      <!-- Extension Integration Card -->
      <div class="settings-card">
        <h4>Companion Browser Extension</h4>
        <p>The companion browser extension allows you to auto-fill website credentials securely with a single click. Copy this unique API Token and save it in the extension settings panel to link it.</p>
        
        <div class="token-box" id="token-box-wrapper">
          <div class="token-value-container">
            <span id="token-value-masked" class="token-value password-masked">${extensionToken || 'Loading...'}</span>
          </div>
          <div class="token-actions">
            <button id="toggle-token-visibility" class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;" title="Show/Hide Token">👁</button>
            <button id="copy-token-btn" class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;" title="Copy Token">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy
            </button>
            <button id="regenerate-token-btn" class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem; color: var(--danger); border-color: hsla(355, 80%, 55%, 0.2);" title="Regenerate Token">
              ⟳ Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Fetch and display token
  loadExtensionToken();

  // Bind token controls
  const tokenValMasked = document.getElementById('token-value-masked');
  const toggleTokenBtn = document.getElementById('toggle-token-visibility');
  const copyTokenBtn = document.getElementById('copy-token-btn');
  const regenerateTokenBtn = document.getElementById('regenerate-token-btn');
  
  let isTokenMasked = true;

  toggleTokenBtn.addEventListener('click', () => {
    isTokenMasked = !isTokenMasked;
    if (isTokenMasked) {
      tokenValMasked.classList.add('password-masked');
      toggleTokenBtn.textContent = '👁';
    } else {
      tokenValMasked.classList.remove('password-masked');
      tokenValMasked.textContent = extensionToken;
      toggleTokenBtn.textContent = '🙈';
    }
  });

  copyTokenBtn.addEventListener('click', () => {
    triggerCopy(extensionToken, "API Token");
  });

  regenerateTokenBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to regenerate the API token? The current token in your browser extension will stop working.")) {
      const res = await window.api.resetApiToken();
      if (res.success) {
        extensionToken = res.token;
        if (!isTokenMasked) {
          tokenValMasked.textContent = extensionToken;
        }
        showToast("API token regenerated successfully!");
      }
    }
  });

  // Bind Theme Cards click listeners
  const themeCards = document.querySelectorAll('.theme-card');
  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      themeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const theme = card.getAttribute('data-theme');
      localStorage.setItem('passlock-theme', theme);
      applyTheme(theme);
      showToast(`Applied ${card.querySelector('span').textContent} theme`);
    });
  });
}

async function loadExtensionToken() {
  const res = await window.api.getApiToken();
  if (res.success) {
    extensionToken = res.token;
    const tokenEl = document.getElementById('token-value-masked');
    if (tokenEl) {
      tokenEl.textContent = extensionToken;
    }
  }
}

// --- Modal Helper Functions ---
function openModal(editData = null) {
  entryForm.reset();
  jumpsListEdit.innerHTML = '';
  
  // Populate category dropdown
  populateCategoryDropdown();

  if (editData) {
    modalTitle.textContent = "Edit Credential";
    entryIdInput.value = editData.id;
    entryTypeInput.value = editData.type;
    entryCategorySelect.value = editData.category || '';
    entryTitleInput.value = editData.title;
    entryUsernameInput.value = editData.username;
    entryPasswordInput.value = editData.password;
    entryNotesInput.value = editData.notes || '';
    
    // Set type toggle active state
    document.querySelectorAll('.type-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-type') === editData.type);
    });

    if (editData.type === 'ssh') {
      entryHostInput.value = editData.host || '';
      entryPortInput.value = editData.port || 22;
      entryKeyPathInput.value = editData.keyPath || '';
      entryExtraOptionsInput.value = editData.extraOptions || '';
      
      // Load jumps if they exist
      if (editData.jumps && Array.isArray(editData.jumps)) {
        editData.jumps.forEach(j => addJumpRow(j));
      }
    } else {
      entryUrlInput.value = editData.url || '';
    }
  } else {
    modalTitle.textContent = "Add Credential";
    entryIdInput.value = '';
    entryTypeInput.value = 'website';
    entryCategorySelect.value = activeTab !== 'all' && activeTab !== 'settings' ? activeTab : '';
    entryPortInput.value = 22;

    // Reset type toggle
    document.querySelectorAll('.type-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-type') === 'website');
    });
  }
  
  toggleFormFields(entryTypeInput.value);
  entryPasswordInput.type = 'password';
  entryModal.style.display = 'flex';
}

function populateCategoryDropdown() {
  // Clear existing options except the first "Uncategorized"
  entryCategorySelect.innerHTML = '<option value="">Uncategorized</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name}`;
    entryCategorySelect.appendChild(opt);
  });
}

function closeModal() {
  entryModal.style.display = 'none';
}

function toggleFormFields(type) {
  if (type === 'ssh') {
    websiteFields.style.display = 'none';
    sshFields.style.display = 'block';
    
    // Require ssh host, remove url required
    entryHostInput.required = true;
    entryUrlInput.required = false;
  } else {
    websiteFields.style.display = 'block';
    sshFields.style.display = 'none';
    
    // Require URL, remove host required
    entryHostInput.required = false;
    entryUrlInput.required = false; // Optional, but usually provided
  }
}

// Add a jump server input row in modal
function addJumpRow(data = null) {
  const row = document.createElement('div');
  row.className = 'jump-row';
  
  const hostVal = data ? escapeHtml(data.host) : '';
  const userVal = data ? escapeHtml(data.username) : '';
  const portVal = data ? escapeHtml(data.port) : '22';
  const passVal = data ? escapeHtml(data.password || '') : '';
  const optsVal = data ? escapeHtml(data.extraOptions || '') : '';

  row.innerHTML = `
    <input type="text" class="jump-host" placeholder="Host/IP" value="${hostVal}" required>
    <input type="text" class="jump-username" placeholder="User" value="${userVal}">
    <input type="number" class="jump-port" placeholder="Port" value="${portVal}" required>
    <input type="password" class="jump-password" placeholder="Pass (Optional)" value="${passVal}">
    <input type="text" class="jump-extra-options" placeholder="Options (e.g. -A -X)" value="${optsVal}">
    <button type="button" class="btn-remove-jump" title="Remove Jump">×</button>
  `;

  row.querySelector('.btn-remove-jump').addEventListener('click', () => {
    row.remove();
  });

  jumpsListEdit.appendChild(row);
}

// Handle save entry submit
async function handleSaveEntry(e) {
  e.preventDefault();
  
  const type = entryTypeInput.value;
  const loginData = {
    id: entryIdInput.value || null,
    type: type,
    category: entryCategorySelect.value || null,
    title: entryTitleInput.value.trim(),
    username: entryUsernameInput.value.trim(),
    password: entryPasswordInput.value,
    notes: entryNotesInput.value.trim()
  };

  if (type === 'ssh') {
    loginData.host = entryHostInput.value.trim();
    loginData.port = parseInt(entryPortInput.value) || 22;
    loginData.keyPath = entryKeyPathInput.value.trim();
    loginData.extraOptions = entryExtraOptionsInput.value.trim();
    
    // Gather jumps
    const jumpRows = jumpsListEdit.querySelectorAll('.jump-row');
    const jumps = [];
    jumpRows.forEach(row => {
      const host = row.querySelector('.jump-host').value.trim();
      const username = row.querySelector('.jump-username').value.trim();
      const port = parseInt(row.querySelector('.jump-port').value) || 22;
      const password = row.querySelector('.jump-password').value;
      const extraOptions = row.querySelector('.jump-extra-options').value.trim();
      
      if (host) {
        jumps.push({ host, username, port, password, extraOptions });
      }
    });
    loginData.jumps = jumps;
  } else {
    loginData.url = entryUrlInput.value.trim();
  }

  const res = await window.api.saveLogin(loginData);
  if (res.success) {
    showToast(`Credential "${loginData.title}" saved`);
    closeModal();
    
    // Reload items and preserve active selection if editing
    await refreshData();
    if (loginData.id) {
      activeEntry = logins.find(l => l.id === loginData.id);
      renderDetails();
    }
  } else {
    alert("Error saving: " + res.error);
  }
}

// --- Utilities ---

// Triggers OS copy via preload script
async function triggerCopy(text, label) {
  if (!text) return;
  const res = await window.api.copyToClipboard(text);
  if (res.success) {
    showToast(`${label} copied to clipboard (auto-clears in 30s)`);
  }
}

// Show Toast message
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500); // Hide after 3.5 seconds
}

// Secure password generator
function generateSecurePassword(length = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-+=[]{}";
  let pwd = "";
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    pwd += chars[randomValues[i] % chars.length];
  }
  return pwd;
}

// Simple HTML escaping helper
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Apply visual theme class to body
function applyTheme(theme) {
  document.body.classList.remove('theme-nord', 'theme-forest', 'theme-amber', 'theme-rose');
  if (theme !== 'cyberpunk') {
    document.body.classList.add(`theme-${theme}`);
  }
}

// --- Import System ---

let pendingImportLogins = [];

function openImportModal() {
  const importModal = document.getElementById('import-modal');
  const importStepPick = document.getElementById('import-step-pick');
  const importStepPreview = document.getElementById('import-step-preview');
  const importModalFooter = document.getElementById('import-modal-footer');
  const importCategorySelect = document.getElementById('import-category-select');

  pendingImportLogins = [];
  importStepPick.style.display = 'block';
  importStepPreview.style.display = 'none';
  importModalFooter.style.display = 'none';

  // Populate category dropdown
  if (importCategorySelect) {
    importCategorySelect.innerHTML = '<option value="">Uncategorized</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.name}`;
      importCategorySelect.appendChild(opt);
    });
    // Pre-select current tab category if applicable
    if (activeTab !== 'all' && activeTab !== 'settings') {
      importCategorySelect.value = activeTab;
    }
  }

  importModal.style.display = 'flex';
  bindImportEvents();
}

function closeImportModal() {
  const importModal = document.getElementById('import-modal');
  if (importModal) importModal.style.display = 'none';
}

function bindImportEvents() {
  const importModalClose = document.getElementById('import-modal-close');
  const importCancelBtn = document.getElementById('import-cancel-btn');
  const importConfirmBtn = document.getElementById('import-confirm-btn');
  const importDropzone = document.getElementById('import-dropzone');

  if (importModalClose) importModalClose.onclick = closeImportModal;
  if (importCancelBtn) importCancelBtn.onclick = closeImportModal;

  if (importDropzone) {
    importDropzone.onclick = async () => {
      const res = await window.api.pickFile();
      if (res.success && res.content) {
        processImportFile(res.content, res.fileName);
      }
    };
  }

  if (importConfirmBtn) {
    importConfirmBtn.onclick = async () => {
      if (!pendingImportLogins.length) return;

      const categoryId = document.getElementById('import-category-select').value || null;

      // Assign selected category to all pending items
      const loginsToSave = pendingImportLogins.map(l => ({
        ...l,
        category: categoryId
      }));

      const res = await window.api.bulkSaveLogins(loginsToSave);
      if (res.success) {
        showToast(`Successfully imported ${res.count} credentials!`);
        closeImportModal();
        await refreshData();
      } else {
        alert("Error importing credentials: " + res.error);
      }
    };
  }
}

function processImportFile(rawText, fileName) {
  const parsed = parseImportContent(rawText, fileName);
  if (!parsed.logins || !parsed.logins.length) {
    alert("Could not detect any credentials in this file. Please check the format.");
    return;
  }

  pendingImportLogins = parsed.logins;

  const importStepPick = document.getElementById('import-step-pick');
  const importStepPreview = document.getElementById('import-step-preview');
  const importModalFooter = document.getElementById('import-modal-footer');
  const importFileName = document.getElementById('import-file-name');
  const importDetectedFormat = document.getElementById('import-detected-format');
  const importCountBadge = document.getElementById('import-count-badge');
  const importPreviewTable = document.getElementById('import-preview-table');

  importStepPick.style.display = 'none';
  importStepPreview.style.display = 'block';
  importModalFooter.style.display = 'flex';

  importFileName.textContent = fileName || 'imported_file';
  importDetectedFormat.textContent = parsed.formatName || 'PLAINTEXT';
  importCountBadge.textContent = `${parsed.logins.length} credential${parsed.logins.length > 1 ? 's' : ''}`;

  // Build preview table
  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Title / Host</th>
          <th>Username</th>
          <th>Password</th>
          <th>URL / Host Details</th>
        </tr>
      </thead>
      <tbody>
  `;

  parsed.logins.slice(0, 50).forEach(l => {
    const isSsh = l.type === 'ssh';
    const typeLabel = isSsh ? '🖥️ SSH' : '🌐 Web';
    const titleVal = l.title || l.host || l.url || 'Untitled';
    const userVal = l.username || '-';
    const passVal = l.password ? '••••••••' : '-';
    const targetVal = isSsh ? `${l.host || ''}:${l.port || 22}` : (l.url || '-');

    tableHtml += `
      <tr>
        <td><strong>${typeLabel}</strong></td>
        <td>${escapeHtml(titleVal)}</td>
        <td>${escapeHtml(userVal)}</td>
        <td>${escapeHtml(passVal)}</td>
        <td>${escapeHtml(targetVal)}</td>
      </tr>
    `;
  });

  tableHtml += '</tbody></table>';

  if (parsed.logins.length > 50) {
    tableHtml += `<p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 8px; text-align: center;">Showing first 50 of ${parsed.logins.length} items...</p>`;
  }

  importPreviewTable.innerHTML = tableHtml;
}

/**
 * Universal Smart Credential Parser
 * Handles:
 * 1. Custom Plaintext block key-value files (e.g., web \n user - u1 \n pass - p1 \n website https://...)
 * 2. CSV files (Bitwarden, 1Password, Chrome exports, standard CSV)
 * 3. JSON arrays/objects
 * 4. OpenSSH config files (Host ... \n HostName ... \n User ...)
 */
function parseImportContent(rawText, fileName = '') {
  const text = rawText.trim();

  // 1. Check if JSON
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : (data.logins || data.items || [data]);
      const logins = items.map(item => ({
        type: item.type === 'ssh' || item.host ? 'ssh' : 'website',
        title: item.title || item.name || item.host || item.url || 'Imported Entry',
        username: item.username || item.user || item.login || '',
        password: item.password || item.pass || '',
        url: item.url || item.website || '',
        host: item.host || item.hostname || '',
        port: item.port ? parseInt(item.port) : 22,
        keyPath: item.keyPath || item.identityFile || '',
        notes: item.notes || ''
      }));
      return { formatName: 'JSON', logins };
    } catch (e) {
      // Not valid JSON, continue to next parsers
    }
  }

  // 2. Check if OpenSSH Config format (contains 'Host ' and 'HostName ')
  if (/^Host\s+\S+/im.test(text) && /HostName\s+\S+/im.test(text)) {
    const logins = parseSshConfigFile(text);
    if (logins.length) return { formatName: 'SSH Config', logins };
  }

  // 3. Check if CSV (comma or tab separated with headers or uniform columns)
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1 && (lines[0].includes(',') || lines[0].includes('\t'))) {
    const logins = parseCsvContent(lines);
    if (logins.length) return { formatName: 'CSV', logins };
  }

  // 4. Fallback: Smart Key-Value Plaintext Block Parser
  // Works with formats like:
  // web
  // user - user1
  // pass-dfnjknfj
  // website https://bfhshifbisd.com
  const logins = parsePlaintextBlocks(text);
  return { formatName: 'Plaintext', logins };
}

/**
 * Parses block-style plaintext credentials
 * Groups blocks by empty lines or section headers (web, ssh, [title], etc.)
 */
function parsePlaintextBlocks(text) {
  const rawLines = text.split(/\r?\n/);
  const blocks = [];
  let currentBlock = [];

  for (let line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    } else {
      currentBlock.push(trimmed);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const logins = [];

  for (let block of blocks) {
    let type = 'website';
    let title = '';
    let username = '';
    let password = '';
    let url = '';
    let host = '';
    let port = 22;
    let keyPath = '';
    let notesArr = [];

    for (let i = 0; i < block.length; i++) {
      const line = block[i];

      // Check header/type lines like "web", "ssh", "website", "[Server Name]"
      if (i === 0 && !line.includes(':') && !line.includes('=') && !line.includes(' - ') && !line.includes('\t')) {
        const lower = line.toLowerCase();
        if (lower === 'web' || lower === 'website' || lower === 'site') {
          type = 'website';
          continue;
        } else if (lower === 'ssh' || lower === 'ssh server' || lower === 'server') {
          type = 'ssh';
          continue;
        } else if (line.startsWith('[') && line.endsWith(']')) {
          title = line.slice(1, -1).trim();
          continue;
        } else {
          // If first line has no key-value separator, treat it as title
          title = line;
          continue;
        }
      }

      // Parse Key-Value pairs matching: key - value, key: value, key = value, key value
      // Handle prefix pattern like "pass-dfnjknfj" or "user - user1" or "website https://..."
      let key = '';
      let val = '';

      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        key = parts[0].trim().toLowerCase();
        val = parts.slice(1).join(' - ').trim();
      } else if (line.includes(':')) {
        const parts = line.split(':');
        key = parts[0].trim().toLowerCase();
        val = parts.slice(1).join(':').trim();
      } else if (line.includes('=')) {
        const parts = line.split('=');
        key = parts[0].trim().toLowerCase();
        val = parts.slice(1).join('=').trim();
      } else if (line.startsWith('pass-') || line.startsWith('pass_')) {
        key = 'pass';
        val = line.slice(5).trim();
      } else if (line.startsWith('user-') || line.startsWith('user_')) {
        key = 'user';
        val = line.slice(5).trim();
      } else {
        // Space separated
        const firstSpaceIndex = line.indexOf(' ');
        if (firstSpaceIndex !== -1) {
          key = line.slice(0, firstSpaceIndex).trim().toLowerCase();
          val = line.slice(firstSpaceIndex + 1).trim();
        } else {
          val = line;
        }
      }

      // Match keys
      if (['user', 'username', 'login', 'usr'].includes(key)) {
        username = val;
      } else if (['pass', 'password', 'pwd', 'secret'].includes(key)) {
        password = val;
      } else if (['website', 'url', 'site', 'link', 'web'].includes(key)) {
        url = val;
        type = 'website';
      } else if (['host', 'hostname', 'ip', 'server'].includes(key)) {
        host = val;
        type = 'ssh';
      } else if (['port'].includes(key)) {
        port = parseInt(val) || 22;
      } else if (['key', 'keypath', 'identityfile', 'sshkey'].includes(key)) {
        keyPath = val;
        type = 'ssh';
      } else if (['title', 'name'].includes(key)) {
        title = val;
      } else {
        notesArr.push(line);
      }
    }

    // Smart fallback title generation
    if (!title) {
      if (url) {
        try {
          title = new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
        } catch (e) {
          title = url;
        }
      } else if (host) {
        title = host;
      } else if (username) {
        title = username + ' Credential';
      } else {
        title = 'Imported Credential';
      }
    }

    if (username || password || url || host) {
      logins.push({
        type,
        title,
        username,
        password,
        url,
        host,
        port,
        keyPath,
        notes: notesArr.join('\n')
      });
    }
  }

  return logins;
}

/**
 * Parses OpenSSH Config files
 */
function parseSshConfigFile(text) {
  const lines = text.split(/\r?\n/);
  const logins = [];
  let current = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const key = parts[0].toLowerCase();
    const val = parts.slice(1).join(' ');

    if (key === 'host') {
      if (current && current.host) {
        logins.push(current);
      }
      current = {
        type: 'ssh',
        title: val,
        host: '',
        username: 'root',
        password: '',
        port: 22,
        keyPath: '',
        notes: 'Imported from SSH Config'
      };
    } else if (current) {
      if (key === 'hostname') current.host = val;
      else if (key === 'user') current.username = val;
      else if (key === 'port') current.port = parseInt(val) || 22;
      else if (key === 'identityfile') current.keyPath = val;
    }
  }

  if (current && current.host) {
    logins.push(current);
  }

  return logins;
}

/**
 * Parses CSV files (Standard, Bitwarden, 1Password, Chrome)
 */
function parseCsvContent(lines) {
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  
  // Helper to split CSV row honoring quotes
  const parseRow = (rowStr) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < rowStr.length; i++) {
      const c = rowStr[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase());
  
  // Find column indices
  const titleIdx = headers.findIndex(h => h.includes('name') || h.includes('title'));
  const urlIdx = headers.findIndex(h => h.includes('url') || h.includes('website') || h.includes('host'));
  const userIdx = headers.findIndex(h => h.includes('username') || h.includes('user') || h.includes('login'));
  const passIdx = headers.findIndex(h => h.includes('password') || h.includes('pass'));
  const notesIdx = headers.findIndex(h => h.includes('notes') || h.includes('comment'));

  const logins = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.length < 2) continue;

    const title = titleIdx !== -1 ? row[titleIdx] : '';
    const url = urlIdx !== -1 ? row[urlIdx] : '';
    const username = userIdx !== -1 ? row[userIdx] : (row[0] || '');
    const password = passIdx !== -1 ? row[passIdx] : (row[1] || '');
    const notes = notesIdx !== -1 ? row[notesIdx] : '';

    if (username || password || url) {
      logins.push({
        type: 'website',
        title: title || url || username || 'CSV Imported Entry',
        username: username,
        password: password,
        url: url,
        notes: notes
      });
    }
  }

  return logins;
}

