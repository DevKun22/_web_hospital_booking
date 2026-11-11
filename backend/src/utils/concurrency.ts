export type ReleasePermit = () => void;

// Semaphore không xếp hàng: khi tiến trình đã dùng hết permit, caller chủ động
// load-shed thay vì giữ thêm request/buffer trong bộ nhớ.
export class ConcurrencySemaphore {
  private active = 0;

  constructor(readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError("Concurrency limit must be a positive integer");
    }
  }

  get activeCount() {
    return this.active;
  }

  tryAcquire(): ReleasePermit | null {
    if (this.active >= this.limit) return null;

    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
    };
  }
}

// Chạy tối đa `concurrency` tác vụ cùng lúc và giữ kết quả theo đúng thứ tự đầu vào.
// Không tạo một Promise cho từng phần tử nên batch lớn vẫn có footprint ổn định.
export const mapWithConcurrency = async <Input, Output>(
  items: readonly Input[],
  concurrency: number,
  mapper: (item: Input, index: number) => Promise<Output>,
) => {
  if (items.length === 0) return [] as Output[];

  const workerCount = Math.min(
    Math.max(Number.isSafeInteger(concurrency) ? concurrency : 1, 1),
    items.length,
  );
  const results = new Array<Output>(items.length);
  let nextIndex = 0;
  let failed = false;
  let firstError: unknown;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        if (failed) return;
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        try {
          results[index] = await mapper(items[index], index);
        } catch (error) {
          failed = true;
          firstError = error;
          return;
        }
      }
    }),
  );

  if (failed) throw firstError;
  return results;
};
