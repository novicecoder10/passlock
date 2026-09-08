const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ITERATIONS = 100000;
const KEY_LEN = 32; // 256 bits for AES-256
const DIGEST = 'sha256';

class DbManager {
  constructor() {
    this.dbPath = path.join(os.homedir(), '.config', 'passlock', 'db.enc');
    this.decryptedData = null;
    this.masterPassword = null;
    this.isUnlocked = false;
  }

  // Ensure config directory exists
  _ensureDirectory() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error("Could not create ~/.config dir, falling back to local folder", err);
        // Fallback to local directory if permission denied
        this.dbPath = path.join(__dirname, 'db.enc');
      }
    }
  }

  // Check if database file exists
  exists() {
    return fs.existsSync(this.dbPath);
  }

  // Encrypt string with Master Password
  _encrypt(plaintext, password) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: ciphertext
    };
  }

  // Decrypt object with Master Password
  _decrypt(encryptedObj, password) {
    const salt = Buffer.from(encryptedObj.salt, 'hex');
    const iv = Buffer.from(encryptedObj.iv, 'hex');
    const authTag = Buffer.from(encryptedObj.authTag, 'hex');
    const ciphertext = Buffer.from(encryptedObj.ciphertext, 'hex');

    const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  // Initial Setup: Create database
  setup(masterPassword) {
    this._ensureDirectory();
    if (this.exists()) {
      throw new Error("Database already exists!");
    }

    const apiToken = crypto.randomBytes(16).toString('hex');
    const initialDb = {
      version: 1,
      apiToken: apiToken,
      logins: []
    };

    const plaintext = JSON.stringify(initialDb);
    const encrypted = this._encrypt(plaintext, masterPassword);

    fs.writeFileSync(this.dbPath, JSON.stringify(encrypted), 'utf8');
    
    this.masterPassword = masterPassword;
    this.decryptedData = initialDb;
    this.isUnlocked = true;
    return true;
  }

  // Unlock existing database
  unlock(masterPassword) {
    this._ensureDirectory();
    if (!this.exists()) {
      throw new Error("Database file not found!");
    }

    try {
      const rawFileContent = fs.readFileSync(this.dbPath, 'utf8');
      const encryptedObj = JSON.parse(rawFileContent);
      const decryptedText = this._decrypt(encryptedObj, masterPassword);
      
      this.decryptedData = JSON.parse(decryptedText);
      this.masterPassword = masterPassword;
      this.isUnlocked = true;
      return true;
    } catch (err) {
      console.error("Unlock failed:", err.message);
      this.lock(); // Ensure clean state
      throw new Error("Invalid master password or corrupted database");
    }
  }

  // Lock the database, clear memory
  lock() {
    this.decryptedData = null;
    this.masterPassword = null;
    this.isUnlocked = false;
  }

  // Check if unlocked
  checkUnlocked() {
    if (!this.isUnlocked || !this.decryptedData) {
      throw new Error("Database is locked");
    }
  }

  // Save the database to disk (encrypted)
  _save() {
    this.checkUnlocked();
    this._ensureDirectory();
    
    const plaintext = JSON.stringify(this.decryptedData);
    const encrypted = this._encrypt(plaintext, this.masterPassword);
    
    fs.writeFileSync(this.dbPath, JSON.stringify(encrypted), 'utf8');
  }

  // Get all logins
  getLogins() {
    this.checkUnlocked();
    return this.decryptedData.logins || [];
  }

  // Save/Update a login
  saveLogin(loginData) {
    this.checkUnlocked();
    
    if (!loginData.id) {
      loginData.id = crypto.randomUUID();
      loginData.createdAt = new Date().toISOString();
    }
    
    loginData.updatedAt = new Date().toISOString();

    const index = this.decryptedData.logins.findIndex(l => l.id === loginData.id);
    if (index !== -1) {
      this.decryptedData.logins[index] = loginData;
    } else {
      this.decryptedData.logins.push(loginData);
    }

    this._save();
    return loginData;
  }

  // Delete a login
  deleteLogin(id) {
    this.checkUnlocked();
    
    const initialLength = this.decryptedData.logins.length;
    this.decryptedData.logins = this.decryptedData.logins.filter(l => l.id !== id);
    
    if (this.decryptedData.logins.length !== initialLength) {
      this._save();
      return true;
    }
    return false;
  }

  // Get current API Token
  getApiToken() {
    this.checkUnlocked();
    return this.decryptedData.apiToken;
  }

  // Reset/Regenerate API Token
  resetApiToken() {
    this.checkUnlocked();
    const newToken = crypto.randomBytes(16).toString('hex');
    this.decryptedData.apiToken = newToken;
    this._save();
    return newToken;
  }
}

module.exports = new DbManager();
