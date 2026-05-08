import { useAuthStore } from "../store/useAuthStore";
import { useDataStore } from "../store/useDataStore";
import { useDiaryStore } from "../store/useDiaryStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { formatLocalDate } from "./date";

export const buildPersonaContext = ({
	memoDays = 14,
	memoLimit = 5,
	includeMemo = true,
	beforeDate = formatLocalDate(),
} = {}) => {
	const authState = useAuthStore.getState();
	const dataState = useDataStore.getState();
	const diaryState = useDiaryStore.getState();
	const settingsState = useSettingsStore.getState();

	return {
		persona:
			authState.persona ?? dataState.onboardingProfile?.persona ?? null,
		age: dataState.onboardingProfile?.age ?? null,
		interests:
			dataState.onboardingProfile?.interests ??
			settingsState.fixedInterestIds ??
			authState.selCats ??
			[],
		job: null,
		memo: includeMemo
			? diaryState.getRecentMemoSummary?.({
					beforeDate,
					days: memoDays,
					limit: memoLimit,
					includeSameDate: false,
				}) || ""
			: "",
	};
};
