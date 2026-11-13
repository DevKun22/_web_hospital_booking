import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptySnapshot, hasPublicHomeData, toPublicHomeData, type PublicBootstrap } from "@/lib/public-bootstrap";
import { queryKeys } from "@/lib/query-keys";

const bootstrap = (overrides: Partial<PublicBootstrap> = {}): PublicBootstrap => ({
  siteSettings: null,
  homeConfig: null,
  banners: [],
  departments: [],
  doctors: [],
  packages: [],
  faqs: [],
  ...overrides,
});

describe("public bootstrap", () => {
  it("tách biểu ngữ theo vị trí và chịu được danh sách biểu ngữ rỗng", () => {
    const banners = [
      { id: "1", position: "HOME_HERO" },
      { id: "2", position: "HOME_PARTNER" },
      { id: "3", position: "HOME_HERO" },
      { id: "4", position: "HOME_PROMO" },
    ] as never;
    const data = toPublicHomeData(bootstrap({ banners }));
    assert.deepEqual(data.heroBanners.map((item) => item.id), ["1", "3"]);
    assert.deepEqual(data.partnerBanners.map((item) => item.id), ["2"]);
    assert.deepEqual(toPublicHomeData(bootstrap({ banners: null })).heroBanners, []);
  });

  it("nhận biết dữ liệu rỗng để biết khi nào cần tải lại", () => {
    assert.equal(hasPublicHomeData(toPublicHomeData(bootstrap())), false);
    assert.equal(hasPublicHomeData(toPublicHomeData(bootstrap({ doctors: [{ id: "d" }] as never }))), true);
    const failed = emptySnapshot("lỗi mạng");
    assert.equal(failed.error, "lỗi mạng");
    assert.equal(failed.fetchedAt, 0);
    assert.equal(hasPublicHomeData(failed.data), false);
  });

  it("khóa tiền tố làm mới được cả hai bản dữ liệu công khai", () => {
    const prefix = queryKeys.publicBootstrap();
    for (const view of ["featured", "full"] as const) {
      assert.deepEqual(queryKeys.publicBootstrap(view).slice(0, prefix.length), [...prefix]);
    }
  });
});
