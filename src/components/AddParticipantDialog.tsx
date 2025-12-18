'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import UserSearch from './UserSearch';

interface AddParticipantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (chat: any) => void;
  chatId: string;
  currentUserId?: string;
  existingParticipants?: any[];
}

export default function AddParticipantDialog({
  isOpen,
  onClose,
  onAdd,
  chatId,
  currentUserId,
  existingParticipants = [],
}: AddParticipantDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUserSelect = async (userId: string) => {
    // Check if user is already a participant
    const isAlreadyParticipant = existingParticipants.some(
      (p: any) => (p._id || p.id) === userId
    );

    if (isAlreadyParticipant) {
      setError('This user is already in the chat');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.addParticipant(chatId, userId);
      onAdd(data.chat);
      onClose();
    } catch (err: any) {
      console.error('Failed to add participant:', err);
      setError(err.message || 'Failed to add participant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Add Person to Chat
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors disabled:opacity-50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* User Search */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <UserSearch
            onUserSelect={handleUserSelect}
            currentUserId={currentUserId}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-700">
          {loading && (
            <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              Adding participant...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


