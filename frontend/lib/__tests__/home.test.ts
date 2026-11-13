import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAnnouncementActive, safeHref } from "@/features/home/home-sections";
import type { HomePageConfigValue } from "@/lib/types";

const announcement = (overrides: Partial<HomePageConfigValue["announcement"]> = {}): HomePageConfigValue["announcement"] => ({
  enabled: true,
  label: "Thông báo",
  message: "Nghỉ lễ 2/9",
  ctaLabel: "",
  ctaHref: "",
  startAt: null,
  endAt: null,
  ...overrides,
});
const NOW = Date.parse("2026-11-13T10:00:00Z");

describe("home", () => {
  it("thông báo chỉ hiện khi bật, có nội dung và đang trong khoảng ngày", () => {
    assert.equal(isAnnouncementActive(undefined, NOW), false);
    assert.equal(isAnnouncementActive(announcement(), NOW), true);
    assert.equal(isAnnouncementActive(announcement({ enabled: false }), NOW), false);
    assert.equal(isAnnouncementActive(announcement({ message: "   " }), NOW), false);
    assert.equal(isAnnouncementActive(announcement({ startAt: "2026-11-14T00:00:00Z" }), NOW), false);
    assert.equal(isAnnouncementActive(announcement({ endAt: "2026-11-12T00:00:00Z" }), NOW), false);
    assert.equal(isAnnouncementActive(announcement({ startAt: "2026-11-01T00:00:00Z", endAt: "2026-11-30T00:00:00Z" }), NOW), true);
  });

  it("liên kết chỉ nhận đường dẫn trong site hoặc https", () => {
    assert.equal(safeHref("/bac-si"), "/bac-si");
    assert.equal(safeHref("https://example.com/a"), "https://example.com/a");
    assert.equal(safeHref("//evil.com"), "/");
    assert.equal(safeHref("javascript:alert(1)"), "/");
    assert.equal(safeHref("http://example.com"), "/");
    assert.equal(safeHref("", "/x"), "/x");
    assert.equal(safeHref(null), "/");
  });
});
