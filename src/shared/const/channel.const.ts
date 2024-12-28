export const CHANNEL = {
	WEBHOOK_CHANNEL: "WEBHOOK_CHANNEL",
} as const;

export type ChannelType = keyof typeof CHANNEL;
