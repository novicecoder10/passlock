const crypto = require('crypto');

// Configuration
const ITERATIONS = 100000;
const KEY_LEN = 32; // 256 bits for AES-256
const DIGEST = 'sha256';

function encrypt(plaintext, masterPassword) {
  // Generate random salt and IV
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // GCM standard IV size is 12 bytes

  // Derive key
  const key = crypto.pbkdf2Sync(masterPassword, salt, ITERATIONS, KEY_LEN, DIGEST);

  // Encrypt
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

function decrypt(encryptedObj, masterPassword) {
  const salt = Buffer.from(encryptedObj.salt, 'hex');
  const iv = Buffer.from(encryptedObj.iv, 'hex');
  const authTag = Buffer.from(encryptedObj.authTag, 'hex');
  const ciphertext = Buffer.from(encryptedObj.ciphertext, 'hex');

  // Derive key
  const key = crypto.pbkdf2Sync(masterPassword, salt, ITERATIONS, KEY_LEN, DIGEST);

  // Decrypt
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

// Test Run
try {
  const master = "MySecureMasterPassword123!";
  const dbData = JSON.stringify({
    version: 1,
    logins: [
      { id: '1', title: 'Google', username: 'user@gmail.com', password: 'secretpassword' }
    ]
  });

  console.log("Original Data:", dbData);
  
  console.log("Encrypting...");
  const encrypted = encrypt(dbData, master);
  console.log("Encrypted Object:", encrypted);

  console.log("Decrypting with correct password...");
  const decrypted = decrypt(encrypted, master);
  console.log("Decrypted Data:", decrypted);

  if (decrypted === dbData) {
    console.log("SUCCESS: Decrypted data matches original!");
  } else {
    console.error("FAIL: Decrypted data does not match original.");
    process.exit(1);
  }

  console.log("Testing with incorrect password...");
  try {
    decrypt(encrypted, "wrongpassword");
    console.error("FAIL: Decryption succeeded with wrong password!");
    process.exit(1);
  } catch (err) {
    console.log("SUCCESS: Decryption failed as expected with wrong password! Error:", err.message);
  }

} catch (e) {
  console.error("Test failed with error:", e);
  process.exit(1);
}
