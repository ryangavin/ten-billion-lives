export interface BudgetLimit {
  readonly direction: "min" | "max";
  readonly catastrophic: number;
}

export type BudgetMap = Readonly<Record<string, BudgetLimit>>;
export type MetricMap = Readonly<Record<string, number>>;

export function evaluateBudgets(
  metrics: MetricMap,
  budgets: BudgetMap,
): readonly string[] {
  const failures: string[] = [];

  for (const [name, limit] of Object.entries(budgets)) {
    const value = metrics[name];
    if (value === undefined || !Number.isFinite(value)) {
      failures.push(`${name}: missing or non-finite metric`);
    } else if (limit.direction === "min" && value < limit.catastrophic) {
      failures.push(
        `${name}: ${value} is below catastrophic minimum ${limit.catastrophic}`,
      );
    } else if (limit.direction === "max" && value > limit.catastrophic) {
      failures.push(
        `${name}: ${value} exceeds catastrophic maximum ${limit.catastrophic}`,
      );
    }
  }

  return failures;
}
