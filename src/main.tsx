import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize i18n localization
import "./l10n/i18n";

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element with id 'root' not found in the document.");
}

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
