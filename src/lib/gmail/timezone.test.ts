import { describe, expect, it } from "vitest";
import { formatInTimeZone, IST_TIME_ZONE } from "@/lib/gmail/timezone";
import { parseHeaderDate, parseHeaderTime } from "@/lib/gmail/providers/live-gmail-provider";

describe("formatInTimeZone (Asia/Kolkata)", () => {
  it("keeps a mid-day IST timestamp on the same calendar date as UTC", () => {
    // 2025-08-12 14:03:00 +0530 == 2025-08-12 08:33:00 UTC — same date either way.
    const result = formatInTimeZone(new Date("2025-08-12T08:33:00Z"), IST_TIME_ZONE);
    expect(result.date).toBe("2025-08-12");
    expect(result.time).toBe("14:03");
  });

  it("rolls an early-morning IST timestamp forward across the UTC date boundary", () => {
    // 2025-08-13 00:15:00 +0530 == 2025-08-12 18:45:00 UTC. Naive UTC slicing
    // would report 2025-08-12, but the real IST calendar date is 2025-08-13.
    const result = formatInTimeZone(new Date("2025-08-12T18:45:00Z"), IST_TIME_ZONE);
    expect(result.date).toBe("2025-08-13");
    expect(result.time).toBe("00:15");
  });

  it("handles the exact IST midnight instant without the Intl 24:00 quirk", () => {
    // 2025-08-13 00:00:00 +0530 == 2025-08-12 18:30:00 UTC.
    const result = formatInTimeZone(new Date("2025-08-12T18:30:00Z"), IST_TIME_ZONE);
    expect(result.date).toBe("2025-08-13");
    expect(result.time).toBe("00:00");
  });
});

describe("parseHeaderDate / parseHeaderTime (RFC 2822 -> IST)", () => {
  it("converts a header already expressed in +0530 straightforwardly", () => {
    expect(parseHeaderDate("Tue, 12 Aug 2025 14:03:00 +0530")).toBe("2025-08-12");
    expect(parseHeaderTime("Tue, 12 Aug 2025 14:03:00 +0530")).toBe("14:03");
  });

  it("converts a UTC header for an early IST morning to the correct next-day IST date (regression: naive UTC slicing would give the previous day)", () => {
    // 2025-08-12 20:45:00 UTC == 2025-08-13 02:15:00 IST.
    expect(parseHeaderDate("Tue, 12 Aug 2025 20:45:00 +0000")).toBe("2025-08-13");
    expect(parseHeaderTime("Tue, 12 Aug 2025 20:45:00 +0000")).toBe("02:15");
  });

  it("converts a US Pacific-time header spanning midnight IST correctly", () => {
    // 2025-08-12 12:00:00 -0700 (PDT) == 2025-08-12 19:00:00 UTC == 2025-08-13 00:30:00 IST.
    expect(parseHeaderDate("Tue, 12 Aug 2025 12:00:00 -0700")).toBe("2025-08-13");
    expect(parseHeaderTime("Tue, 12 Aug 2025 12:00:00 -0700")).toBe("00:30");
  });

  it("returns null time and today's IST date for an unparseable header", () => {
    expect(parseHeaderTime("not a date")).toBeNull();
    expect(parseHeaderDate("not a date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
