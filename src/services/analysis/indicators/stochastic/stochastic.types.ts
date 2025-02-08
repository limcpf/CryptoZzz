export interface iStochasticParams {
	kPeriod: number;
	dPeriod: number;
}

export interface iStochasticResult {
	k_value: number;
	d_value: number;
	timestamp: Date;
}
