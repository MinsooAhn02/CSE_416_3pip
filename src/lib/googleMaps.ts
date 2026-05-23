declare global {
	interface Window {
		google?: {
			maps?: {
				importLibrary?: (lib: string) => Promise<unknown>;
			};
		};
		[key: string]: unknown;
	}
}

const GOOGLE_MAPS_API_KEY = String(
	import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
).trim();

const GOOGLE_MAPS_CALLBACK = "__mbGoogleMapsInit";
const GOOGLE_MAPS_VERSION = "weekly";

let googleMapsLoadPromise: Promise<unknown> | null = null;

export const hasGoogleMapsPlacesKey = (): boolean => !!GOOGLE_MAPS_API_KEY;

export const getBrowserLanguage = (): string => {
	if (typeof navigator === "undefined") return "en-US";
	return navigator.language || "en-US";
};

export const getPlacesLanguageTag = (appLanguage = ""): string => {
	const normalized = String(appLanguage || "").toLowerCase();
	if (normalized.startsWith("ko")) return "ko-KR";
	if (normalized.startsWith("en")) return "en-US";
	return getBrowserLanguage();
};

export const getBrowserRegionCodes = (): string[] => {
	const language = getBrowserLanguage();
	const regionCode = language.split("-")[1]?.toLowerCase();
	return regionCode ? [regionCode] : [];
};

export const formatGooglePlaceLabel = (place: Record<string, unknown>): string => {
	const displayName = place?.displayName;
	const name = String(
		(typeof displayName === "object" && displayName !== null
			? (displayName as Record<string, unknown>).text
			: displayName) || "",
	).trim();
	const address = String(place?.formattedAddress || "").trim();

	if (name && address) {
		const normalizedName = name.toLowerCase();
		const normalizedAddress = address.toLowerCase();
		if (normalizedAddress.startsWith(normalizedName)) {
			return address;
		}
		return `${name}, ${address}`;
	}

	return name || address;
};

export const loadGoogleMapsPlacesLibrary = async (): Promise<unknown> => {
	if (typeof window === "undefined" || !GOOGLE_MAPS_API_KEY) return null;

	if (window.google?.maps?.importLibrary) {
		return await window.google.maps.importLibrary("places");
	}

	if (!googleMapsLoadPromise) {
		googleMapsLoadPromise = new Promise<unknown>((resolve, reject) => {
			const cleanup = (): void => {
				try {
					delete window[GOOGLE_MAPS_CALLBACK];
				} catch {
					window[GOOGLE_MAPS_CALLBACK] = undefined;
				}
			};

			window[GOOGLE_MAPS_CALLBACK] = (): void => {
				cleanup();
				resolve(window.google?.maps);
			};

			const script = document.createElement("script");
			const params = new URLSearchParams({
				key: GOOGLE_MAPS_API_KEY,
				v: GOOGLE_MAPS_VERSION,
				loading: "async",
				libraries: "places",
				callback: GOOGLE_MAPS_CALLBACK,
			});

			script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
			script.async = true;
			script.defer = true;
			script.dataset.googleMapsLoader = "mb";
			script.onerror = (): void => {
				cleanup();
				googleMapsLoadPromise = null;
				reject(new Error("Google Maps JavaScript API could not load."));
			};

			document.head.appendChild(script);
		});
	}

	await googleMapsLoadPromise;
	return await window.google?.maps?.importLibrary?.("places");
};
