const GOOGLE_MAPS_API_KEY = String(
	import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
).trim();

const GOOGLE_MAPS_CALLBACK = "__mbGoogleMapsInit";
const GOOGLE_MAPS_VERSION = "weekly";

let googleMapsLoadPromise = null;

export const hasGoogleMapsPlacesKey = () => !!GOOGLE_MAPS_API_KEY;

export const getBrowserLanguage = () => {
	if (typeof navigator === "undefined") return "en-US";
	return navigator.language || "en-US";
};

export const getPlacesLanguageTag = (appLanguage = "") => {
	const normalized = String(appLanguage || "").toLowerCase();
	if (normalized.startsWith("ko")) return "ko-KR";
	if (normalized.startsWith("en")) return "en-US";
	return getBrowserLanguage();
};

export const getBrowserRegionCodes = () => {
	const language = getBrowserLanguage();
	const regionCode = language.split("-")[1]?.toLowerCase();
	return regionCode ? [regionCode] : [];
};

export const formatGooglePlaceLabel = (place) => {
	const name = String(place?.displayName?.text || place?.displayName || "").trim();
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

export const loadGoogleMapsPlacesLibrary = async () => {
	if (typeof window === "undefined" || !GOOGLE_MAPS_API_KEY) return null;

	if (window.google?.maps?.importLibrary) {
		return await window.google.maps.importLibrary("places");
	}

	if (!googleMapsLoadPromise) {
		googleMapsLoadPromise = new Promise((resolve, reject) => {
			const cleanup = () => {
				try {
					delete window[GOOGLE_MAPS_CALLBACK];
				} catch {
					window[GOOGLE_MAPS_CALLBACK] = undefined;
				}
			};

			window[GOOGLE_MAPS_CALLBACK] = () => {
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
			script.onerror = () => {
				cleanup();
				googleMapsLoadPromise = null;
				reject(new Error("Google Maps JavaScript API could not load."));
			};

			document.head.appendChild(script);
		});
	}

	await googleMapsLoadPromise;
	return await window.google.maps.importLibrary("places");
};
