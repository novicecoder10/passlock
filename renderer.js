// State variables
let logins = [];
let activeTab = 'all';
let activeEntry = null;
let isSetupMode = false;
let extensionToken = '';

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
const menuItems = document.querySelectorAll('.menu-item');
const lockVaultBtn = document.getElementById('lock-vault-btn');
const searchInput = document.getElementById('search-input');
const addEntryBtn = document.getElementById('add-entry-btn');
const entriesList = document.getElementById('entries-list');
const detailPane = document.getElementById('detail-pane');

const entryModal = document.getElementById('entry-modal');
const entryForm = document.getElementById('entry-form');
const entryIdInput = document.getElementById('entry-id');
const entryTypeSelect = document.getElementById('entry-type');
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
    activeEntry = null;
    masterPasswordInput.value = '';
    authOverlay.style.display = 'flex';
    authTitle.textContent = "Unlock Vault";
    authSubtitle.textContent = "Enter your master password to decrypt your credential database.";
    authSubmitBtn.textContent = "Unlock Vault";
    isSetupMode = false;
    renderDetails();
  });

  // Sidebar Tab Switcher
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      activeTab = item.getAttribute('data-tab');
      activeEntry = null;
      renderListings();
      renderDetails();
    });
  });

  // Search filter
  searchInput.addEventListener('input', () => {
    renderListings();
  });

  // Open Add Credential Modal
  addEntryBtn.addEventListener('click', () => {
    openModal();
  });

  // Modal Cancel and Close buttons
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);

  // Modal Save Submit
  entryForm.addEventListener('submit', handleSaveEntry);

  // Type change in modal
  entryTypeSelect.addEventListener('change', () => {
    toggleFormFields(entryTypeSelect.value);
  });

  // Toggle password visibility in modal
  toggleFormPassword.addEventListener('click', () => {
    const type = entryPasswordInput.type === 'password' ? 'text' : 'password';
    entryPasswordInput.type = type;
  });

  // Generate password button
  generatePasswordBtn.addEventListener('click', () => {
    entryPasswordInput.value = generateSecurePassword();
    entryPasswordInput.type = 'text'; // Make it visible so they can see what was generated
  });

  // Add jump server input row
  addJumpRowBtn.addEventListener('click', () => {
    addJumpRow();
  });
}

// --- App Control Logic ---
async function unlockApp() {
  authOverlay.style.display = 'none';
  masterPasswordInput.value = '';
  
  // Load token for extension
  const tokenRes = await window.api.getApiToken();
  if (tokenRes.success) {
    extensionToken = tokenRes.token;
  }

  // Load and render
  await refreshData();
}

function showAuthError(msg) {
  authError.textContent = msg;
  authError.style.display = 'block';
}

async function refreshData() {
  const res = await window.api.getLogins();
  if (res.success) {
    logins = res.logins;
    renderListings();
  }
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
  detailPane.style.display = 'flex';
  entriesList.style.width = 'auto';

  const filteredLogins = logins.filter(login => {
    // 1. Filter by category tab
    if (activeTab !== 'all' && login.type !== activeTab) {
      return false;
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
    
    // Select icon depending on type
    const avatarIcon = login.type === 'ssh' 
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;

    card.innerHTML = `
      <div class="entry-info">
        <div class="entry-avatar">${avatarIcon}</div>
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

  // Details header avatar and subtitle
  const typeText = isSsh ? 'SSH Server' : 'Website';
  const headerAvatar = isSsh
    ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`
    : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;

  let detailsHtml = `
    <div class="detail-header">
      <div class="detail-avatar">${headerAvatar}</div>
      <div class="detail-title">
        <h3>${escapeHtml(login.title)}</h3>
        <span>${typeText}</span>
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
          <div class="detail-field-value password-masked" id="detail-pw-val">${escapeHtml(login.password)}</div>
          <button class="detail-field-btn" id="toggle-detail-pw">
            👁
          </button>
          <button class="detail-field-btn copy-btn" data-value="${escapeHtml(login.password)}" data-label="Password">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>
  `;

  if (isSsh) {
    // Port display logic
    const portStr = login.port && login.port.toString() !== '22' ? `:${login.port}` : '';
    
    detailsHtml += `
      <!-- Host Field -->
      <div class="detail-field">
        <div class="detail-field-label">Host IP / Domain</div>
        <div class="detail-field-value-wrapper">
          <div class="detail-field-value">${escapeHtml(login.host)}${portStr}</div>
          <button class="detail-field-btn copy-btn" data-value="${escapeHtml(login.host)}" data-label="Host">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>
    `;

    if (login.keyPath && login.keyPath.trim()) {
      detailsHtml += `
        <!-- KeyPath Field -->
        <div class="detail-field">
          <div class="detail-field-label">Private Key Path</div>
          <div class="detail-field-value-wrapper">
            <div class="detail-field-value" style="font-family: monospace; font-size: 0.8rem;">${escapeHtml(login.keyPath)}</div>
          </div>
        </div>
      `;
    }

    // Jumps list visualization
    if (login.jumps && Array.isArray(login.jumps) && login.jumps.length > 0) {
      detailsHtml += `
        <!-- Jumps Visual Path Map -->
        <div class="detail-field">
          <div class="detail-field-label">Proxy Jumps Configuration</div>
          <div class="jump-servers-list">
      `;

      login.jumps.forEach((jump, index) => {
        const jPort = jump.port && jump.port.toString() !== '22' ? `:${jump.port}` : '';
        const jUser = jump.username ? `${jump.username}@` : '';
        detailsHtml += `
            <div class="jump-server-node">
              <span><strong>Jump ${index + 1}:</strong> ${escapeHtml(jUser)}${escapeHtml(jump.host)}${jPort}</span>
            </div>
            ${index < login.jumps.length - 1 ? '<div class="jump-server-arrow">↓</div>' : ''}
        `;
      });

      detailsHtml += `
            <div class="jump-server-arrow">↓</div>
            <div class="jump-server-node" style="border-color: var(--accent-cyan); background-color: hsla(185, 100%, 50%, 0.05);">
              <span><strong>Final:</strong> ${escapeHtml(login.username)}@${escapeHtml(login.host)}</span>
            </div>
          </div>
        </div>
      `;
    }
  } else {
    // Website specific field
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
  detailPane.style.display = 'none';
  entriesList.style.width = '100%';

  const currentTheme = localStorage.getItem('passlock-theme') || 'cyberpunk';

  entriesList.innerHTML = `
    <div class="settings-container">
      <h2>Settings</h2>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: -16px; margin-bottom: 8px;">Configure the security integrations for browser auto-filling and shell configurations.</p>
      
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
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 12px; font-family: monospace;" id="token-value-masked">••••••••••••••••••••••••••••••••</span>
          <button class="icon-btn-inline" id="toggle-token-btn" title="Show Token">👁</button>
          <button class="icon-btn-inline" id="copy-token-btn" title="Copy Token">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
        
        <button id="regenerate-token-btn" class="btn-secondary" style="margin-top: 16px; font-size: 0.85rem;">
          Regenerate API Token
        </button>
      </div>

      <!-- SSH Instructions Card -->
      <div class="settings-card">
        <h4>SSH ProxyJumps (Bastions)</h4>
        <p>To connect to servers behind multiple proxy servers securely, PassLock constructs native SSH ProxyJump configurations (-J). To enable seamless connection without typing multiple passwords, we suggest adding your public keys to the jump servers and target host. Otherwise, the spawned terminal window will prompt you for passwords sequentially.</p>
        <p style="margin-bottom: 0; font-style: italic; color: var(--accent-cyan);">Note: Command execution wraps connections to hold the terminal window open on SSH closure or errors, revealing useful diagnostic logs.</p>
      </div>
    </div>
  `;

  // Bind settings listeners
  const toggleTokenBtn = document.getElementById('toggle-token-btn');
  const copyTokenBtn = document.getElementById('copy-token-btn');
  const tokenValMasked = document.getElementById('token-value-masked');
  const regenerateTokenBtn = document.getElementById('regenerate-token-btn');

  let isTokenMasked = true;

  toggleTokenBtn.addEventListener('click', () => {
    if (isTokenMasked) {
      tokenValMasked.textContent = extensionToken;
      toggleTokenBtn.textContent = '🙈';
      isTokenMasked = false;
    } else {
      tokenValMasked.textContent = '••••••••••••••••••••••••••••••••';
      toggleTokenBtn.textContent = '👁';
      isTokenMasked = true;
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

// --- Modal Helper Functions ---
function openModal(editData = null) {
  entryForm.reset();
  jumpsListEdit.innerHTML = '';
  
  if (editData) {
    modalTitle.textContent = "Edit Credential";
    entryIdInput.value = editData.id;
    entryTypeSelect.value = editData.type;
    entryTitleInput.value = editData.title;
    entryUsernameInput.value = editData.username;
    entryPasswordInput.value = editData.password;
    entryNotesInput.value = editData.notes || '';
    
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
    entryTypeSelect.value = 'website';
    entryPortInput.value = 22;
  }
  
  toggleFormFields(entryTypeSelect.value);
  entryPasswordInput.type = 'password';
  entryModal.style.display = 'flex';
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

  row.innerHTML = `
    <input type="text" class="jump-host" placeholder="Host/IP" value="${hostVal}" required>
    <input type="text" class="jump-username" placeholder="User" value="${userVal}">
    <input type="number" class="jump-port" placeholder="Port" value="${portVal}" required>
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
  
  const type = entryTypeSelect.value;
  const loginData = {
    id: entryIdInput.value || null,
    type: type,
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
      
      if (host) {
        jumps.push({ host, username, port });
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
