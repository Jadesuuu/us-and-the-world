import { describe, expect, it } from "vitest";
import { formatLongDate } from "@/lib/format";

// Date objects are built with the local-time constructor so the fields
// formatLongDate reads (getDate/getMonth/getFullYear, all local) are
// deterministic regardless of the runner's timezone.
describe("formatLongDate", () => {
  it("formats a date as 'the Nth of Month, Year'", () => {
    expect(formatLongDate(new Date(2024, 6, 21))).toBe("the 21st of July, 2024");
  });

  it("uses the correct ordinal suffix", () => {
    expect(formatLongDate(new Date(2024, 0, 1))).toBe("the 1st of January, 2024");
    expect(formatLongDate(new Date(2024, 0, 2))).toBe("the 2nd of January, 2024");
    expect(formatLongDate(new Date(2024, 0, 3))).toBe("the 3rd of January, 2024");
    expect(formatLongDate(new Date(2024, 0, 4))).toBe("the 4th of January, 2024");
  });

  it("uses 'th' for the 11th–13th teens exception", () => {
    expect(formatLongDate(new Date(2024, 0, 11))).toBe("the 11th of January, 2024");
    expect(formatLongDate(new Date(2024, 0, 12))).toBe("the 12th of January, 2024");
    expect(formatLongDate(new Date(2024, 0, 13))).toBe("the 13th of January, 2024");
    // 21/22/23 fall back to st/nd/rd — proves the teens rule is scoped.
    expect(formatLongDate(new Date(2024, 0, 22))).toBe("the 22nd of January, 2024");
    expect(formatLongDate(new Date(2024, 0, 23))).toBe("the 23rd of January, 2024");
  });

  it("returns empty string for null/undefined/empty input", () => {
    expect(formatLongDate(null)).toBe("");
    expect(formatLongDate(undefined)).toBe("");
    expect(formatLongDate("")).toBe("");
  });

  it("returns empty string for an unparseable date string", () => {
    expect(formatLongDate("not-a-date")).toBe("");
  });

  it("parses a valid ISO date string", () => {
    // Noon UTC keeps the calendar day stable across any runner timezone.
    expect(formatLongDate("2023-12-25T12:00:00.000Z")).toBe(
      "the 25th of December, 2023",
    );
  });
});
