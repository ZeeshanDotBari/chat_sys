'use client';

import { useState } from 'react';

interface DeleteMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: (deleteType: 'everyone' | 'me') => void;
}

export default function DeleteMessageDialog({ isOpen, onClose, onDelete }: DeleteMessageDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Delete Message
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          How would you like to delete this message?
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => {
              onDelete('everyone');
              onClose();
            }}
            className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-left"
          >
            <div className="font-medium">Delete for Everyone</div>
            <div className="text-sm opacity-90">This message will be deleted for all participants</div>
          </button>
          
          <button
            onClick={() => {
              onDelete('me');
              onClose();
            }}
            className="w-full px-4 py-3 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-50 rounded-lg transition-colors text-left"
          >
            <div className="font-medium">Delete for Me</div>
            <div className="text-sm opacity-75">This message will only be deleted for you</div>
          </button>
        </div>
        
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


