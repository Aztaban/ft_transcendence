// Shapes from docs/api-plan.md §10.6. The sender never gets the message back: sending answers
// only with its id and time.
export interface SCMessageReceipt {
  id: number;
  created_at: string;
}
