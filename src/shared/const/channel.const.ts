export const CHANNEL = {
	WEBHOOK_CHANNEL: "WEBHOOK_CHANNEL",
	ANALYZE_CHANNEL: "ANALYZE_CHANNEL",
} as const;

export type ChannelType = keyof typeof CHANNEL;
