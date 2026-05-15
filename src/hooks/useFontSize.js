import { useWidgetStore } from '../store/useWidgetStore';

export function useFontSize(multiplier = 1.0) {
	const globalFontSize = useWidgetStore((s) => s.globalFontSize);
	const key = ['small', 'medium', 'large'].includes(globalFontSize) ? globalFontSize : 'medium';
	const bodyBase = { small: 10, medium: 12, large: 14 }[key];
	const titleBase = { small: 12, medium: 14, large: 16 }[key];
	return {
		body: { fontSize: `${bodyBase * multiplier}px` },
		title: { fontSize: `${titleBase * multiplier}px` },
		key,
	};
}
