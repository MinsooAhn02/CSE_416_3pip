const pad2 = (value: number): string => String(value).padStart(2, "0");

export const formatLocalDate = (input: Date | string = new Date()): string => {
	const date = input instanceof Date ? new Date(input) : new Date(input);
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const parseDateString = (dateStr: string): Date =>
	new Date(`${dateStr}T00:00:00`);

export const shiftDateString = (dateStr: string, days: number): string => {
	const date = parseDateString(dateStr);
	date.setDate(date.getDate() + days);
	return formatLocalDate(date);
};

export const isSameLocalDate = (input: Date | string, dateStr: string): boolean =>
	formatLocalDate(input) === dateStr;
