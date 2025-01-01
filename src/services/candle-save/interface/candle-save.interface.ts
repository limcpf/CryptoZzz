import type { iCandle } from "../../../shared/interfaces/iCandle";

export interface iCandleSaveService {
	marketUrl: string;
	getCandleData: (count: number) => void;
	saveMarketData: (data: iCandle[]) => void;
}
