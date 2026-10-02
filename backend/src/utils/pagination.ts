export const parsePagination = (
  query: Record<string, unknown>,
  options: { defaultLimit?: number; maxLimit?: number } = {},
) => {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 50;
  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? defaultLimit);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isSafeInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
};

export const paginationMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPreviousPage: page > 1,
});
