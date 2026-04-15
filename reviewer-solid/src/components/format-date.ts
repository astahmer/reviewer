export const formatDate = (date: Date | string): string => {
  const resolvedDate = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - resolvedDate.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

  return resolvedDate.toLocaleDateString();
};