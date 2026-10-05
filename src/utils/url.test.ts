import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "./url";

describe("safeExternalUrl", () => {
	it("keeps http and https links", () => {
		expect(safeExternalUrl("https://apnews.com/article/x")).toBe("https://apnews.com/article/x");
		expect(safeExternalUrl("http://example.com")).toBe("http://example.com");
	});

	it.each([
		["javascript:alert(1)"],
		[" JavaScript:alert(1)"],
		["java\tscript:alert(1)"],
		["data:text/html,<script>alert(1)</script>"],
		["vbscript:msgbox(1)"],
		["/relative/path"],
		[""],
	])("blocks %j", (input) => {
		expect(safeExternalUrl(input)).toBe("");
	});

	it("handles non-string input", () => {
		expect(safeExternalUrl(null)).toBe("");
		expect(safeExternalUrl(undefined)).toBe("");
		expect(safeExternalUrl(42)).toBe("");
	});

	it("runs in the Seoul timezone (CI and local)", () => {
		expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Seoul");
	});
});
