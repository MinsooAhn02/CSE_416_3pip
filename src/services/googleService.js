// TODO: Implement real Google OAuth + API integration
// Requires: Google Cloud project, OAuth2 client ID, scopes for Fit & Calendar

export function signInWithGoogle() {
	console.warn("Google sign-in not yet implemented");
	return Promise.resolve({
		displayName: "Demo User",
		email: "user@google.com",
	});
}

export function fetchGoogleFitData() {
	console.warn("Google Fit API not yet implemented");
	return Promise.resolve(null);
}

export function fetchGoogleCalendarEvents() {
	console.warn("Google Calendar API not yet implemented");
	return Promise.resolve([]);
}
