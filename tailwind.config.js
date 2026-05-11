/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				// Linear Slate — Light mode (eye-comfort neutral + indigo accent)
				"morning-light": {
					page: "#F2F2F5",
					card: "#FFFFFF",
					cardSecondary: "#F5F5F8",
					hover: "#E2E2E9",
					accent: "#4F46E5",
					text: "#1A1A27",
					muted: "rgba(26, 26, 39, 0.42)",
				},
				// Linear Slate — Dark mode (deep indigo-tinted dark)
				"morning-dark": {
					page: "#13131C",
					card: "#1E1E2C",
					cardSecondary: "#26263A",
					hover: "#2E2E42",
					accent: "#6366F1",
					text: "#E8E8F0",
					muted: "rgba(232, 232, 240, 0.50)",
				},
			},
			fontFamily: {
				sans: ['"DM Sans"', '"Noto Sans KR"', "sans-serif"],
			},
		},
	},
	plugins: [],
};
