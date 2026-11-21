import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWebDeviceName, describeDevice, describeLocation, splitDeviceName } from "../device-label";

const CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/130.0.0.0`;
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const FIREFOX_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0";

describe("tên thiết bị web", () => {
  it("nhận ra trình duyệt và hệ điều hành thường gặp", () => {
    assert.equal(describeDevice(CHROME_WINDOWS), "Chrome trên Windows");
    assert.equal(describeDevice(EDGE_WINDOWS), "Edge trên Windows");
    assert.equal(describeDevice(SAFARI_IPHONE), "Safari trên iPhone");
    assert.equal(describeDevice(CHROME_ANDROID), "Chrome trên Android");
    assert.equal(describeDevice(FIREFOX_MAC), "Firefox trên macOS");
  });

  it("không nhận ra thì dùng tên chung", () => {
    assert.equal(describeDevice(""), "Trình duyệt Web");
    assert.equal(describeDevice(null), "Trình duyệt Web");
    assert.equal(describeDevice("curl/8.0"), "Trình duyệt Web");
  });

  it("ghép vị trí từ header Vercel và giải mã tên thành phố", () => {
    assert.equal(describeLocation("Ho%20Chi%20Minh%20City", "VN"), "Ho Chi Minh City, Việt Nam");
    assert.equal(describeLocation(null, "VN"), "Việt Nam");
    assert.equal(describeLocation(null, null), "");
    assert.equal(describeLocation("%E0%A4%A", "XYZ"), "");
  });

  it("buildWebDeviceName ghép thiết bị và vị trí, thiếu vị trí thì chỉ có thiết bị", () => {
    const withGeo = new Map([["user-agent", CHROME_WINDOWS], ["x-vercel-ip-city", "Hanoi"], ["x-vercel-ip-country", "VN"]]);
    const withoutGeo = new Map([["user-agent", CHROME_WINDOWS]]);
    const source = (map: Map<string, string>) => ({ get: (name: string) => map.get(name) ?? null });
    assert.equal(buildWebDeviceName(source(withGeo)), "Chrome trên Windows · Hanoi, Việt Nam");
    assert.equal(buildWebDeviceName(source(withoutGeo)), "Chrome trên Windows");
  });

  it("splitDeviceName tách lại tên và vị trí", () => {
    assert.deepEqual(splitDeviceName("Chrome trên Windows · Hanoi, Việt Nam"), { device: "Chrome trên Windows", location: "Hanoi, Việt Nam" });
    assert.deepEqual(splitDeviceName("Trình duyệt Web"), { device: "Trình duyệt Web", location: "" });
    assert.deepEqual(splitDeviceName(null), { device: "", location: "" });
  });
});
