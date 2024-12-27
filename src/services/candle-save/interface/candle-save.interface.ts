import type { Candle } from "../../../shared/types/Candle.type";

export interface iCandleSaveService {
	marketUrl: string;
	getCandleData: (count: number) => void;
	saveMarketData: (data: Candle[]) => void;
}
