export const dday = (ds) => {
	const target = new Date(ds);
	const now = new Date();
	target.setHours(0, 0, 0, 0);
	now.setHours(0, 0, 0, 0);
	return Math.ceil((target - now) / 864e5);
};
