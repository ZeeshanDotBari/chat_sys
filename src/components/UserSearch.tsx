'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

interface UserSearchProps {
  onUserSelect: (userId: string) => void;
  currentUserId?: string;
}

export default function UserSearch({ onUserSelect, currentUserId }: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length > 2) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [query]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.searchUsers(query);
      setUsers(data.users.filter((user: any) => user.id !== currentUserId));
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="sticky top-0 bg-white dark:bg-zinc-900 pb-4 z-10">
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#e77a4c]"
        />
      </div>
      
      <div className="mt-4 space-y-2">
        {loading && (
          <div className="text-center text-zinc-500 dark:text-zinc-400 py-4">
            Searching...
          </div>
        )}
        
        {!loading && query.length > 2 && users.length === 0 && (
          <div className="text-center text-zinc-500 dark:text-zinc-400 py-4">
            No users found
          </div>
        )}

        {users.map((user) => (
          <div
            key={user.id}
            onClick={() => onUserSelect(user.id)}
            className="p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#e77a4c] flex items-center justify-center text-white font-semibold">
                {user.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {user.username}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {user.email}
                </p>
              </div>
              {user.isOnline && (
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


