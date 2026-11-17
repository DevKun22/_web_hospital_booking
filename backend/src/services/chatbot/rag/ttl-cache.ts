// Bộ nhớ đệm nhỏ có hạn dùng và giới hạn số mục (mục cũ nhất bị loại trước). `version` đổi thì mọi mục cũ coi như hết hạn:
// dùng khi kho tri thức được đồng bộ lại và câu trả lời đã lưu có thể không còn đúng.
export class TtlCache<T> {
  private readonly items = new Map<string, { value: T; expiresAt: number; version: number }>();

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
}
