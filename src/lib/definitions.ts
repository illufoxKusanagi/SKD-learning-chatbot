// Edited Here: Created this file to match your role system (1=admin, 2=user)
export const UserRole = [1, 2] as const;
export type UserRole = (typeof UserRole)[number];

// Helper functions for role checking
export const isAdmin = (role: UserRole) => role === 1;
export const isUser = (role: UserRole) => role === 2;
