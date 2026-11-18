import { EventEmitter } from "node:events";

// Đánh thức worker cùng tiến trình khi có việc mới (production chạy worker ngay trong tiến trình API) để worker có thể
// giãn nhịp quét khi rảnh mà vẫn gửi thông báo gần như tức thời. Không dùng LISTEN/NOTIFY của Postgres vì bộ gom kết
// nối của Supabase không giữ được kết nối lắng nghe; instance khác chỉ chậm tối đa một chu kỳ quét rảnh.
const emitter = new EventEmitter();
emitter.setMaxListeners(20);

export type WorkTopic = "notifications";

export const signalWork = (topic: WorkTopic) => {
  emitter.emit(topic);
};

export const onWork = (topic: WorkTopic, listener: () => void) => {
  emitter.on(topic, listener);
  return () => {
    emitter.off(topic, listener);
  };
};
