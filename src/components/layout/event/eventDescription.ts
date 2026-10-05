export const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
export const ALLOWED_EVENT_DESCRIPTION_TAGS = new Set([
	"A",
	"B",
	"STRONG",
	"I",
	"EM",
	"U",
	"S",
	"STRIKE",
	"P",
	"BR",
	"UL",
	"OL",
	"LI",
	"DIV",
	"SPAN",
	"BLOCKQUOTE",
	"PRE",
	"CODE",
]);
export const ALLOWED_EVENT_DESCRIPTION_PROTOCOLS = new Set([
	"http:",
	"https:",
	"mailto:",
	"tel:",
]);

export const isHtmlDescription = (value: unknown) => HTML_TAG_PATTERN.test(String(value || ""));

export const escapeDescriptionHtml = (value: unknown) =>
	String(value || "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

export const escapeDescriptionAttribute = (value: unknown) =>
	String(value || "")
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

export const normalizeDescriptionLinkUrl = (value: unknown) => {
	const raw = String(value || "").trim();
	if (!raw) return "";
	const normalized = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw) ? raw : `https://${raw}`;

	try {
		const resolved = new URL(normalized);
		if (!ALLOWED_EVENT_DESCRIPTION_PROTOCOLS.has(resolved.protocol)) return "";
		return resolved.toString();
	} catch {
		return "";
	}
};

export const EMPTY_DESCRIPTION_FORMAT_STATE = {
	bold: false,
	italic: false,
	underline: false,
	orderedList: false,
	unorderedList: false,
	link: false,
	strikeThrough: false,
};

export const getEventDescriptionEditorHtml = (value: unknown) => {
	const raw = String(value || "");
	if (!raw.trim()) return "";
	if (isHtmlDescription(raw)) {
		return sanitizeEventDescriptionHtml(raw);
	}
	return escapeDescriptionHtml(raw).replaceAll("\n", "<br>");
};

export const normalizeEventDescriptionValue = (rawHtml: unknown) => {
	const html = String(rawHtml || "").trim();
	if (!html) return "";
	if (typeof document === "undefined" || typeof DOMParser === "undefined") {
		return html;
	}

	const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
	const text = String(parsed.body.textContent || "")
		.replaceAll("\u00a0", " ")
		.trim();
	return text ? html : "";
};

export const sanitizeEventDescriptionHtml = (rawHtml: unknown) => {
	if (!rawHtml || typeof document === "undefined" || typeof DOMParser === "undefined") {
		return String(rawHtml || "");
	}

	const parser = new DOMParser();
	const parsed = parser.parseFromString(`<div>${String(rawHtml)}</div>`, "text/html");

	const sanitizeNode = (node: Node): Node | DocumentFragment => {
		if (node.nodeType === Node.TEXT_NODE) {
			return document.createTextNode(node.textContent || "");
		}

		if (node.nodeType !== Node.ELEMENT_NODE) {
			return document.createDocumentFragment();
		}

		const el = node as Element;
		const tagName = el.tagName.toUpperCase();
		const cleanChildren = <T extends Element | DocumentFragment>(target: T): T => {
			Array.from(node.childNodes).forEach((child) => {
				target.appendChild(sanitizeNode(child));
			});
			return target;
		};

		if (!ALLOWED_EVENT_DESCRIPTION_TAGS.has(tagName)) {
			return cleanChildren(document.createDocumentFragment());
		}

		if (tagName === "A") {
			const href = String(el.getAttribute("href") || "").trim();
			if (!href) {
				return cleanChildren(document.createDocumentFragment());
			}

			try {
				const resolved = new URL(href, window.location.origin);
				if (!ALLOWED_EVENT_DESCRIPTION_PROTOCOLS.has(resolved.protocol)) {
					return cleanChildren(document.createDocumentFragment());
				}

				const anchor = document.createElement("a");
				anchor.setAttribute("href", resolved.toString());
				anchor.setAttribute("target", "_blank");
				anchor.setAttribute("rel", "noreferrer noopener");
				return cleanChildren(anchor);
			} catch {
				return cleanChildren(document.createDocumentFragment());
			}
		}

		return cleanChildren(document.createElement(tagName.toLowerCase()));
	};

	const wrapper = document.createElement("div");
	Array.from(parsed.body.childNodes).forEach((child) => {
		wrapper.appendChild(sanitizeNode(child));
	});
	return wrapper.innerHTML;
};
