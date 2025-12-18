'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateKeyPair, validateKeyPair } from '@/lib/crypto/encryption';
import { storePrivateKey, getPrivateKey, hasEncryptionKeys, clearStoredKeys } from '@/lib/crypto/keyStorage';
import { encryptMessage, decryptMessage } from '@/lib/crypto/encryption';
import { apiClient } from '@/lib/api/client';

interface UseEncryptionReturn {
  isEncryptionEnabled: boolean;
  isInitializing: boolean;
  initializeEncryption: () => Promise<void>;
  encrypt: (message: string, recipientPublicKey: string) => Promise<{ encryptedData: string; encryptedKey: string; iv: string }>;
  decrypt: (encryptedData: string, encryptedKey: string, iv: string) => Promise<string>;
  getPublicKey: (userId: string) => Promise<string | null>;
}

export function useEncryption(currentUserId?: string): UseEncryptionReturn {
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const initializeEncryption = useCallback(async () => {
    if (!currentUserId) {
      throw new Error('User ID is required');
    }

    try {
      setIsInitializing(true);

      // Generate key pair
      const keyPair = await generateKeyPair();

      // Store private key locally
      storePrivateKey(currentUserId, keyPair.privateKey);

      // Send public key to server
      await apiClient.savePublicKey(keyPair.publicKey);

      setIsEncryptionEnabled(true);
    } catch (error) {
      console.error('Error initializing encryption:', error);
      throw error;
    } finally {
      setIsInitializing(false);
    }
  }, [currentUserId]);

  // Automatically initialize encryption if not set up
  useEffect(() => {
    let isMounted = true;
    
    const autoInitializeEncryption = async () => {
      if (!currentUserId) {
        if (isMounted) {
          setIsInitializing(false);
        }
        return;
      }

      try {
        console.log('Checking encryption status for user:', currentUserId);
        const hasKeys = hasEncryptionKeys();
        console.log('Has encryption keys locally:', hasKeys);
        
        if (hasKeys) {
          // Verify public key is on server and matches local private key
          try {
            const publicKeyData = await apiClient.getPublicKey(currentUserId);
            console.log('Public key found on server:', !!publicKeyData.publicKey);
            if (publicKeyData.publicKey) {
              // Public key exists on server - validate it matches local private key
              const localPrivateKey = getPrivateKey();
              if (localPrivateKey) {
                console.log('Validating that server public key matches local private key...');
                const isValid = await validateKeyPair(publicKeyData.publicKey, localPrivateKey);
                if (isValid) {
                  console.log('✅ Key pair validation successful - keys match');
                  if (isMounted) {
                    setIsEncryptionEnabled(true);
                    setIsInitializing(false);
                  }
                } else {
                  console.error('❌ Key pair validation failed - keys do NOT match!');
                  console.error('This means the server has a different public key than your local private key.');
                  console.error('This will cause decryption failures. Regenerating keys...');
                  // Keys don't match - clear local keys and regenerate
                  clearStoredKeys();
                  await initializeEncryption();
                }
              } else {
                // No local private key but server has public key - regenerate
                console.warn('Server has public key but no local private key found. Regenerating...');
                await initializeEncryption();
              }
            } else {
              // Keys exist locally but not on server - this is a problem
              // The local private key won't match any public key on server
              // We need to re-initialize to create matching keys
              console.warn('Keys exist locally but not on server. This may cause decryption issues.');
              console.warn('Re-initializing encryption to create matching key pair...');
              await initializeEncryption();
            }
          } catch (error: any) {
            // Public key not on server or error fetching it
            if (error.message?.includes('not set up encryption keys') || error.message?.includes('404')) {
              // Public key doesn't exist - re-initialize
              console.warn('Public key not found on server, initializing encryption...');
              await initializeEncryption();
            } else {
              // Other error - log it but try to continue with local keys
              console.error('Error checking public key on server:', error);
              // Still enable encryption with local keys (user might be offline)
              // But warn that there might be key mismatch issues
              console.warn('⚠️ Continuing with local keys only - key validation skipped due to error');
              if (isMounted) {
                setIsEncryptionEnabled(true);
                setIsInitializing(false);
              }
            }
          }
        } else {
          // No keys at all - initialize encryption
          console.log('No encryption keys found, initializing...');
          await initializeEncryption();
        }
      } catch (error) {
        console.error('Error auto-initializing encryption:', error);
        if (isMounted) {
          setIsEncryptionEnabled(false);
          setIsInitializing(false);
        }
      }
    };

    autoInitializeEncryption();
    
    return () => {
      isMounted = false;
    };
  }, [currentUserId, initializeEncryption]);

  const encrypt = useCallback(async (
    message: string,
    recipientPublicKey: string
  ): Promise<{ encryptedData: string; encryptedKey: string; iv: string }> => {
    // Encryption is mandatory - always encrypt
    return await encryptMessage(message, recipientPublicKey);
  }, []);

  const decrypt = useCallback(async (
    encryptedData: string,
    encryptedKey: string,
    iv: string
  ): Promise<string> => {
    const privateKey = getPrivateKey();
    if (!privateKey) {
      throw new Error('Private key not found');
    }

    return await decryptMessage(encryptedData, encryptedKey, iv, privateKey);
  }, []);

  const getPublicKey = useCallback(async (userId: string): Promise<string | null> => {
    try {
      const data = await apiClient.getPublicKey(userId);
      return data.publicKey || null;
    } catch (error) {
      console.error('Error getting public key:', error);
      return null;
    }
  }, []);

  return {
    isEncryptionEnabled,
    isInitializing,
    initializeEncryption,
    encrypt,
    decrypt,
    getPublicKey,
  };
}

