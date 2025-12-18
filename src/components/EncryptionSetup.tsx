'use client';

import { useState } from 'react';
import { useEncryption } from '@/lib/hooks/useEncryption';

interface EncryptionSetupProps {
  userId?: string;
  onSetupComplete?: () => void;
}

export default function EncryptionSetup({ userId, onSetupComplete }: EncryptionSetupProps) {
  const encryption = useEncryption(userId);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async () => {
    if (!userId) return;

    setIsSettingUp(true);
    setError(null);

    try {
      await encryption.initializeEncryption();
      onSetupComplete?.();
    } catch (err: any) {
      console.error('Failed to set up encryption:', err);
      setError(err.message || 'Failed to set up encryption. Please try again.');
    } finally {
      setIsSettingUp(false);
    }
  };

  if (encryption.isEncryptionEnabled) {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            End-to-end encryption is enabled
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
            Enable End-to-End Encryption
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
            Your messages will be encrypted so only you and the recipient can read them. 
            The server cannot decrypt your messages.
          </p>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>
          )}
        </div>
        <button
          onClick={handleSetup}
          disabled={isSettingUp || encryption.isInitializing}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isSettingUp || encryption.isInitializing ? 'Setting up...' : 'Enable Encryption'}
        </button>
      </div>
    </div>
  );
}

