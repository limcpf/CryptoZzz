export const CHANNEL = {
	WEBHOOK_CHANNEL: "webhook_channel",
} as const;

export type ChannelType = keyof typeof CHANNEL;
