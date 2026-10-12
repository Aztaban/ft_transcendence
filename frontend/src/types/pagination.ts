// Paginated list envelope from docs/api-plan.md §5.7.
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
