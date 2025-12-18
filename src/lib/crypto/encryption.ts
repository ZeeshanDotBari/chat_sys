/**
 * End-to-End Encryption Utilities
 * Uses Web Crypto API for RSA-OAEP encryption
 */

export interface KeyPair {
  publicKey: string; // Base64 encoded
  privateKey: string; // Base64 encoded (stored securely on client)
}

/**
 * Generate RSA key pair for encryption
 */
export async function generateKeyPair(): Promise<KeyPair> {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    // Export public key
    const publicKeyBuffer = await window.crypto.subtle.exportKey(
      'spki',
      keyPair.publicKey
    );
    const publicKeyBase64 = arrayBufferToBase64(publicKeyBuffer);

    // Export private key
    const privateKeyBuffer = await window.crypto.subtle.exportKey(
      'pkcs8',
      keyPair.privateKey
    );
    const privateKeyBase64 = arrayBufferToBase64(privateKeyBuffer);

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64,
    };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw new Error('Failed to generate encryption keys');
  }
}

/**
 * Import public key from Base64 string
 */
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  try {
    if (!publicKeyBase64 || publicKeyBase64.trim() === '') {
      throw new Error('Public key is empty');
    }
    
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    
    if (!publicKeyBuffer || publicKeyBuffer.byteLength === 0) {
      throw new Error('Invalid public key format');
    }
    
    return await window.crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );
  } catch (error: any) {
    console.error('Error importing public key:', error);
    if (error.message) {
      throw new Error(`Failed to import public key: ${error.message}`);
    }
    throw new Error('Failed to import public key: Invalid key format');
  }
}

/**
 * Validate that a public key and private key are a matching pair
 * by performing a test encryption/decryption
 */
export async function validateKeyPair(publicKeyBase64: string, privateKeyBase64: string): Promise<boolean> {
  try {
    const testMessage = 'test-key-validation';
    
    // Import keys
    const publicKey = await importPublicKey(publicKeyBase64);
    const privateKey = await importPrivateKey(privateKeyBase64);
    
    // Generate a random AES key for testing
    const aesKey = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Export and encrypt AES key with public key
    const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
    const encryptedKey = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      exportedAesKey
    );
    
    // Try to decrypt with private key
    const decryptedKey = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedKey
    );
    
    // Compare the decrypted key with the original
    const originalArray = new Uint8Array(exportedAesKey);
    const decryptedArray = new Uint8Array(decryptedKey);
    
    if (originalArray.length !== decryptedArray.length) {
      return false;
    }
    
    for (let i = 0; i < originalArray.length; i++) {
      if (originalArray[i] !== decryptedArray[i]) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error validating key pair:', error);
    return false;
  }
}

/**
 * Import private key from Base64 string
 */
export async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  try {
    if (!privateKeyBase64 || privateKeyBase64.trim() === '') {
      throw new Error('Private key is empty');
    }
    
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
    
    if (!privateKeyBuffer || privateKeyBuffer.byteLength === 0) {
      throw new Error('Invalid private key format');
    }
    
    return await window.crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['decrypt']
    );
  } catch (error: any) {
    console.error('Error importing private key:', error);
    if (error.message) {
      throw new Error(`Failed to import private key: ${error.message}`);
    }
    throw new Error('Failed to import private key: Invalid key format');
  }
}

/**
 * Encrypt message using recipient's public key
 * RSA-OAEP can only encrypt small amounts of data, so we use hybrid encryption:
 * 1. Generate a random AES key
 * 2. Encrypt the message with AES
 * 3. Encrypt the AES key with RSA
 * 4. Return both encrypted message and encrypted key
 */
export async function encryptMessage(
  message: string,
  recipientPublicKeyBase64: string
): Promise<{ encryptedData: string; encryptedKey: string; iv: string }> {
  try {
    if (!recipientPublicKeyBase64 || recipientPublicKeyBase64.trim() === '') {
      throw new Error('Recipient public key is empty or invalid');
    }
    
    // Import recipient's public key
    const publicKey = await importPublicKey(recipientPublicKeyBase64);

    // Generate random AES key for message encryption
    const aesKey = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );

    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt message with AES
    const messageBuffer = new TextEncoder().encode(message);
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      messageBuffer
    );

    // Export and encrypt AES key with RSA
    const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
    const encryptedKey = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      exportedAesKey
    );

    return {
      encryptedData: arrayBufferToBase64(encryptedData),
      encryptedKey: arrayBufferToBase64(encryptedKey),
      iv: arrayBufferToBase64(iv),
    };
  } catch (error: any) {
    console.error('Error encrypting message:', error);
    if (error.message) {
      throw new Error(`Failed to encrypt message: ${error.message}`);
    }
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypt message using own private key
 */
export async function decryptMessage(
  encryptedData: string,
  encryptedKey: string,
  iv: string,
  privateKeyBase64: string
): Promise<string> {
  try {
    if (!encryptedData || !encryptedKey || !iv || !privateKeyBase64) {
      throw new Error('Missing required decryption parameters');
    }
    
    // Import private key
    const privateKey = await importPrivateKey(privateKeyBase64);

    // Decrypt AES key with RSA
    const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKey);
    
    if (!encryptedKeyBuffer || encryptedKeyBuffer.byteLength === 0) {
      throw new Error('Invalid encrypted key format');
    }
    
    console.log('Attempting RSA decryption of AES key:', {
      encryptedKeyLength: encryptedKey.length,
      encryptedKeyBufferSize: encryptedKeyBuffer.byteLength,
    });
    
    let decryptedAesKeyBuffer: ArrayBuffer;
    try {
      decryptedAesKeyBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP',
        },
        privateKey,
        encryptedKeyBuffer
      );
      console.log('RSA decryption successful, decrypted AES key size:', decryptedAesKeyBuffer.byteLength);
    } catch (error: any) {
      console.error('RSA decryption failed:', error);
      console.error('RSA decryption error details:', {
        errorName: error.name,
        errorMessage: error.message,
        encryptedKeyLength: encryptedKey.length,
        encryptedKeyBufferSize: encryptedKeyBuffer.byteLength,
      });
      if (error.name === 'OperationError' || error.message?.includes('decrypt')) {
        throw new Error('Failed to decrypt AES key: This message was not encrypted for you. The sender may have used an outdated public key. Please ask them to send a new message.');
      }
      throw error;
    }

    // Import decrypted AES key
    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      decryptedAesKeyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    // Decrypt message with AES
    const encryptedDataBuffer = base64ToArrayBuffer(encryptedData);
    const ivBuffer = base64ToArrayBuffer(iv);
    
    if (!encryptedDataBuffer || encryptedDataBuffer.byteLength === 0) {
      throw new Error('Invalid encrypted data format');
    }
    
    if (!ivBuffer || ivBuffer.byteLength !== 12) {
      throw new Error('Invalid IV format (must be 12 bytes)');
    }
    
    let decryptedBuffer: ArrayBuffer;
    try {
      decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer,
        },
        aesKey,
        encryptedDataBuffer
      );
    } catch (error: any) {
      console.error('AES decryption failed:', error);
      if (error.name === 'OperationError') {
        throw new Error('Failed to decrypt message data: Invalid encryption data or corrupted message.');
      }
      throw error;
    }

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error: any) {
    console.error('Error decrypting message:', error);
    if (error.message) {
      throw error; // Re-throw with the specific error message
    }
    throw new Error('Failed to decrypt message: Unknown error');
  }
}

/**
 * Encrypt message for multiple recipients (group chat)
 */
export async function encryptMessageForMultiple(
  message: string,
  recipientPublicKeys: { userId: string; publicKey: string }[]
): Promise<{ [userId: string]: { encryptedData: string; encryptedKey: string; iv: string } }> {
  const encryptedMessages: { [userId: string]: { encryptedData: string; encryptedKey: string; iv: string } } = {};

  // Encrypt for each recipient
  for (const recipient of recipientPublicKeys) {
    try {
      const encrypted = await encryptMessage(message, recipient.publicKey);
      encryptedMessages[recipient.userId] = encrypted;
    } catch (error) {
      console.error(`Failed to encrypt for user ${recipient.userId}:`, error);
      // Continue with other recipients
    }
  }

  return encryptedMessages;
}

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

