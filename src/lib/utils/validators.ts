import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createChatSchema = z.object({
  participants: z.array(z.string()).min(1, 'At least one participant is required'),
  type: z.enum(['direct', 'group']).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});


