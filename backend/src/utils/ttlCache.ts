// Bộ nhớ đệm nhỏ có hạn dùng và giới hạn số mục (mục cũ nhất bị loại trước). `version` đổi thì mọi mục cũ coi như hết hạn:
// dùng khi dữ liệu gốc vừa được sửa (kho tri thức đồng bộ lại, quản trị sửa nội dung công khai) và giá trị đã lưu có thể không còn đúng.
export class TtlCache<T> {
  private readonly items = new Map<string, { value: T; expiresAt: number; version: number }>();
  private readonly loading = new Map<string, Promise<T>>();

  constructor(
    private readonly maxSize: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string, version = 0): T | undefined {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= Date.now() || item.version !== version) {
      this.items.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: T, version = 0) {
    if (this.items.size >= this.maxSize) {
      const oldest = this.items.keys().next().value;
      if (oldest !== undefined) this.items.delete(oldest);
    }
    this.items.set(key, { value, expiresAt: Date.now() + this.ttlMs, version });
  }

  /**
   * Lấy từ đệm, chưa có thì gọi `load` một lần: các yêu cầu đến cùng lúc với cùng khóa dùng chung một lần tải,
   * không dồn nhiều truy vấn giống nhau vào cơ sở dữ liệu. Tải lỗi thì không lưu gì.
   */
  async getOrLoad(key: string, load: () => Promise<T>, version = 0): Promise<T> {
    const cached = this.get(key, version);
    if (cached !== undefined) return cached;

    const pending = this.loading.get(key);
    if (pending) return pending;

    const request = load()
      .then((value) => {
        this.set(key, value, version);
        return value;
      })
      .finally(() => this.loading.delete(key));
    this.loading.set(key, request);
    return request;
  }
}
