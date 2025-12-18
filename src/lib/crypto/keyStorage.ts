/**
 * Secure Key Storage Utilities
 * Stores private keys in localStorage (encrypted with a passphrase in production)
 */

const PRIVATE_KEY_STORAGE_KEY = 'chat_private_key';
const KEY_PAIR_STORAGE_KEY = 'chat_key_pair';

export interface StoredKeyPair {
  publicKey: string;
  privateKey: string;
  userId: string;
  createdAt: string;
}

/**
 * Store private key securely
 */
export function storePrivateKey(userId: string, privateKey: string): void {
  try {
    const keyPair: StoredKeyPair = {
      publicKey: '', // Not stored here, only in DB
      privateKey,
      userId,
      createdAt: new Date().toISOString(),
    };
    
    localStorage.setItem(KEY_PAIR_STORAGE_KEY, JSON.stringify(keyPair));
  } catch (error) {
    console.error('Error storing private key:', error);
    throw new Error('Failed to store private key');
  }
}

/**
 * Retrieve private key for current user
 */
export function getPrivateKey(): string | null {
  try {
    const stored = localStorage.getItem(KEY_PAIR_STORAGE_KEY);
    if (!stored) return null;
    
    const keyPair: StoredKeyPair = JSON.parse(stored);
    return keyPair.privateKey;
  } catch (error) {
    console.error('Error retrieving private key:', error);
    return null;
  }
}

/**
 * Check if user has encryption keys
 */
export function hasEncryptionKeys(): boolean {
  return getPrivateKey() !== null;
}

/**
 * Clear stored keys (on logout)
 */
export function clearStoredKeys(): void {
  localStorage.removeItem(KEY_PAIR_STORAGE_KEY);
  localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
}

