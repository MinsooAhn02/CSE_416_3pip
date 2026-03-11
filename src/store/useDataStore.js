import { create } from "zustand";
import {
	fetchWeather,
	fetchStocks,
	fetchTrends,
	fetchCalendarEvents,
	fetchHealthData,
} from "../mock/data";

export const useDataStore = create((set) => ({
	weather: null,
	stocks: [],
	trends: [],
	calEvents: [],
	healthData: null,

	fetchAll: async () => {
		const [weather, stocks, trends, calEvents, healthData] = await Promise.all([
			fetchWeather(),
			fetchStocks(),
			fetchTrends(),
			fetchCalendarEvents(),
			fetchHealthData(),
		]);
		set({ weather, stocks, trends, calEvents, healthData });
	},
}));
