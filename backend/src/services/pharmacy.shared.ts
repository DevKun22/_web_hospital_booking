export type Actor = { userId: string; role: string };

export const normalize = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const pageOf = (page?: number, limit?: number) => {
  const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
  const safePage = Math.max(page || 1, 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};
