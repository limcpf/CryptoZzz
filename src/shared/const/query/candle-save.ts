export const CANDLE_SAVE_QUERY = {
	UPSERT_MARKET_DATA: `
      INSERT INTO Market_Data (
        symbol, 
        timestamp, 
        open_price, 
        high_price, 
        low_price, 
        close_price, 
        volume
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (symbol, timestamp)
      DO UPDATE
      SET open_price = EXCLUDED.open_price,
          high_price = EXCLUDED.high_price,
          low_price = EXCLUDED.low_price,
          close_price = EXCLUDED.close_price,
          volume = EXCLUDED.volume;
    `,
} as const;

export type CandleSaveQuery = keyof typeof CANDLE_SAVE_QUERY;
