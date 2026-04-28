import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import {
	getBrowserRegionCodes,
	getPlacesLanguageTag,
	hasGoogleMapsPlacesKey,
	loadGoogleMapsPlacesLibrary,
	formatGooglePlaceLabel,
} from "../../lib/googleMaps";

const GooglePlacesLocationField = ({
	value,
	onChange,
	placeholder = "Location (optional)",
	disabled = false,
}) => {
	const { isDark, inputCls } = useTheme();
	const { i18n } = useTranslation();
	const [widgetStatus, setWidgetStatus] = useState(
		hasGoogleMapsPlacesKey() ? "loading" : "fallback",
	);
	const [suggestions, setSuggestions] = useState([]);
	const [isOpen, setIsOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const onChangeRef = useRef(onChange);
	const rootRef = useRef(null);
	const servicesRef = useRef(null);
	const sessionTokenRef = useRef(null);
	const requestIdRef = useRef(0);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		let isMounted = true;

		const loadServices = async () => {
			if (!hasGoogleMapsPlacesKey() || typeof window === "undefined") {
				setWidgetStatus("fallback");
				return;
			}

			try {
				const placesLibrary = await loadGoogleMapsPlacesLibrary();
				if (!isMounted || !placesLibrary) return;

				const { AutocompleteSuggestion, AutocompleteSessionToken } =
					placesLibrary;
				if (!AutocompleteSuggestion || !AutocompleteSessionToken) {
					setWidgetStatus("fallback");
					return;
				}

				servicesRef.current = {
					AutocompleteSuggestion,
					AutocompleteSessionToken,
				};
				setWidgetStatus("ready");
			} catch (error) {
				console.warn("Google Places widget failed to load:", error);
				setWidgetStatus("error");
			}
		};

		loadServices();

		return () => {
			isMounted = false;
		};
	}, [i18n.language]);

	useEffect(() => {
		if (widgetStatus !== "ready") {
			setSuggestions([]);
			setIsOpen(false);
			return;
		}

		const query = String(value || "").trim();
		if (query.length < 2) {
			setSuggestions([]);
			setIsOpen(false);
			setHighlightedIndex(-1);
			return;
		}

		const timerId = window.setTimeout(async () => {
			try {
				const { AutocompleteSuggestion, AutocompleteSessionToken } =
					servicesRef.current || {};
				if (!AutocompleteSuggestion || !AutocompleteSessionToken) return;

				if (!sessionTokenRef.current) {
					sessionTokenRef.current = new AutocompleteSessionToken();
				}

				const currentRequestId = requestIdRef.current + 1;
				requestIdRef.current = currentRequestId;

				const regionCodes = getBrowserRegionCodes();
				const request = {
					input: query,
					sessionToken: sessionTokenRef.current,
					language: getPlacesLanguageTag(i18n.language),
					region: regionCodes[0],
					includedRegionCodes: regionCodes,
				};

				const response =
					await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
				if (requestIdRef.current !== currentRequestId) return;

				const nextSuggestions = (response?.suggestions || [])
					.map((suggestion, index) => {
						const prediction = suggestion?.placePrediction;
						const mainText = String(prediction?.mainText?.text || "").trim();
						const secondaryText = String(
							prediction?.secondaryText?.text || "",
						).trim();
						if (!prediction || (!mainText && !secondaryText)) return null;
						return {
							id: prediction.placeId || `${mainText}-${secondaryText}-${index}`,
							prediction,
							mainText,
							secondaryText,
						};
					})
					.filter(Boolean);

				setSuggestions(nextSuggestions);
				setIsOpen(nextSuggestions.length > 0);
				setHighlightedIndex(nextSuggestions.length > 0 ? 0 : -1);
			} catch (error) {
				console.warn("Google Places suggestions failed:", error);
				setSuggestions([]);
				setIsOpen(false);
				setHighlightedIndex(-1);
			}
		}, 180);

		return () => window.clearTimeout(timerId);
	}, [i18n.language, value, widgetStatus]);

	useEffect(() => {
		const handlePointerDown = (event) => {
			if (!rootRef.current?.contains(event.target)) {
				setIsOpen(false);
				setHighlightedIndex(-1);
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		return () => document.removeEventListener("mousedown", handlePointerDown);
	}, []);

	const handleSelectSuggestion = async (suggestion) => {
		try {
			const place = suggestion.prediction.toPlace();
			await place.fetchFields({
				fields: ["displayName", "formattedAddress"],
			});

			const nextValue =
				formatGooglePlaceLabel(place) ||
				[suggestion.mainText, suggestion.secondaryText]
					.filter(Boolean)
					.join(", ");
			onChangeRef.current?.(nextValue);
		} catch (error) {
			console.warn("Google Place selection failed:", error);
			const fallbackValue = [suggestion.mainText, suggestion.secondaryText]
				.filter(Boolean)
				.join(", ");
			onChangeRef.current?.(fallbackValue);
		} finally {
			sessionTokenRef.current = null;
			setSuggestions([]);
			setIsOpen(false);
			setHighlightedIndex(-1);
		}
	};

	const handleKeyDown = async (event) => {
		if (!isOpen || suggestions.length === 0) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setHighlightedIndex((prev) =>
				prev >= suggestions.length - 1 ? 0 : prev + 1,
			);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlightedIndex((prev) =>
				prev <= 0 ? suggestions.length - 1 : prev - 1,
			);
			return;
		}

		if (event.key === "Enter" && highlightedIndex >= 0) {
			event.preventDefault();
			await handleSelectSuggestion(suggestions[highlightedIndex]);
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			setIsOpen(false);
			setHighlightedIndex(-1);
		}
	};

	return (
		<div ref={rootRef} className="space-y-2">
			<div className="space-y-1">
				<div className="relative">
					<input
						type="text"
						placeholder={placeholder}
						value={value}
						onChange={(event) => {
							onChange(event.target.value);
						}}
						onFocus={() => {
							if (suggestions.length > 0) {
								setIsOpen(true);
							}
						}}
						onKeyDown={handleKeyDown}
						disabled={disabled}
						className={`w-full rounded-lg border px-3 py-2 pl-9 text-sm outline-none transition-all focus:ring-2 focus:ring-orange-500/30 ${inputCls}`}
					/>
					<MapPin
						size={14}
						className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-400" : "text-gray-500"}`}
					/>
					{isOpen && suggestions.length > 0 && (
						<div
							className={`absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border shadow-lg ${isDark ? "border-morning-dark-hover bg-morning-dark-card" : "border-morning-light-hover/50 bg-morning-light-card"}`}
						>
							{suggestions.map((suggestion, index) => (
								<button
									key={suggestion.id}
									type="button"
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => handleSelectSuggestion(suggestion)}
									className={`w-full px-3 py-2 text-left transition-colors ${
										index === highlightedIndex
											? isDark
												? "bg-morning-dark-hover"
												: "bg-morning-light-hover/40"
											: ""
									}`}
								>
									<div className="text-sm font-medium">
										{suggestion.mainText || suggestion.secondaryText}
									</div>
									{suggestion.secondaryText && (
										<div
											className={`text-xs ${
												isDark ? "text-morning-dark-muted" : "text-morning-light-muted"
											}`}
										>
											{suggestion.secondaryText}
										</div>
									)}
								</button>
							))}
						</div>
					)}
				</div>
				{widgetStatus === "loading" && (
					<p
						className={`text-[11px] ${isDark ? "text-morning-dark-muted" : "text-morning-light-muted"}`}
					>
						Loading Google Places autocomplete...
					</p>
				)}
				{widgetStatus === "error" && (
					<p
						className={`text-[11px] ${isDark ? "text-amber-300" : "text-amber-700"}`}
					>
						Google Places autocomplete could not load, but you can still type the
						location manually.
					</p>
				)}
				{widgetStatus === "fallback" && (
					<p
						className={`text-[11px] ${isDark ? "text-gray-400" : "text-gray-600"}`}
					>
						Add a Google Maps key to enable autocomplete in this same field.
					</p>
				)}
			</div>
		</div>
	);
};

export default GooglePlacesLocationField;
