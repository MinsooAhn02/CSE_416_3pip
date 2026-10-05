

export interface WeatherData {
	temp: number;
	city: string;
	condition: string;
	conditionId?: number;
	precipitation: number;
	airQuality?: string;
	airQualityIndex?: number;
	humidity?: number;
	icon?: string;
}

export interface StockItem {
	symbol: string;
	name: string;
	value: string;
	change: string;
	up: boolean;
	type?: string;
	currency?: string;
}

export interface ArticleItem {
	title: string;
	url: string;
	content: string;
	image: string | null;
	published_date: string | null;
	source?: string;
}

export interface HealthData {
	steps: number;
	stepsGoal: number;
	sleep: number;
	sleepGoal: number;
	calories: number;
	caloriesGoal: number;
	heartRate: number;
	water: number;
	waterGoal: number;
}

export interface ManualCity {
	name: string;
	displayName: string;
	lat: number;
	lon: number;
}

export interface CalendarEventBasic {
	id?: string;
	title?: string;
	summary?: string;
	start: string;
	end?: string;
	location?: string;
	description?: string;
	allDay?: boolean;
	startTime?: string;
	endTime?: string;
}
