const pad2 = (value) => String(value).padStart(2, "0");

export const formatLocalDate = (input = new Date()) => {
	const date = input instanceof Date ? new Date(input) : new Date(input);
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const parseDateString = (dateStr) => new Date(`${dateStr}T00:00:00`);

export const shiftDateString = (dateStr, days) => {
	const date = parseDateString(dateStr);
	date.setDate(date.getDate() + days);
	return formatLocalDate(date);
};

export const isSameLocalDate = (input, dateStr) =>
	formatLocalDate(input) === dateStr;
