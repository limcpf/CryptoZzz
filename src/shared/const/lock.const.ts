export const DATABASE_LOCKS = {
	ANALYZE: 1,
	TRADING: 2,
} as const;

export type DatabaseLockType = keyof typeof DATABASE_LOCKS;
