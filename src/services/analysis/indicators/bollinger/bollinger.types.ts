export interface iBollingerParams {
	period: number;
	hours: number;
}

export interface iBollingerData {
	bollinger_upper: number;
	bollinger_middle: number;
	bollinger_lower: number;
	close_price: number;
}

export interface iBollingerSignal extends iBollingerData {
	band_width: number;
	score: number;
}
