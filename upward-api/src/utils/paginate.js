export function paginateMeta(page, perPage, totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  return {
    page,
    perPage,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
export function offset(page, perPage) {
  return (page - 1) * perPage;
}
