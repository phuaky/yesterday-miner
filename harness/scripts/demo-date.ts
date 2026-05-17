export function expectedMineDate(): string {
  const override = process.env.DEMO_EXPECTED_MINE_DATE?.trim();
  if (override) return override;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, "0");
  const day = String(yesterday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mineDateIssues(label: string, value: string | undefined): string[] {
  if (!value) return [`${label} missing mineDate`];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return [`${label} mineDate must be YYYY-MM-DD`];

  const expected = expectedMineDate();
  if (value !== expected) return [`${label} mineDate must be ${expected} (yesterday)`];
  return [];
}
