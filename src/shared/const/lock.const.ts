export const DATABASE_LOCKS = {
	ANALYZE: 1,
} as const;

export type DatabaseLockType = keyof typeof DATABASE_LOCKS;
