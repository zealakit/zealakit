/**
 * Minimal unified diff (LCS on lines). Inputs are small generated files, so the
 * quadratic table is fine; very large inputs fall back to a whole-file hunk.
 */
const MAX_CELLS = 4_000_000;

type Op = { kind: " " | "-" | "+"; line: string };

function diffLines(a: string[], b: string[]): Op[] {
  if (a.length * b.length > MAX_CELLS) {
    return [
      ...a.map((line) => ({ kind: "-" as const, line })),
      ...b.map((line) => ({ kind: "+" as const, line })),
    ];
  }
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, (): number => 0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const row = table[i] as number[];
      row[j] =
        a[i] === b[j]
          ? ((table[i + 1] as number[])[j + 1] as number) + 1
          : Math.max((table[i + 1] as number[])[j] as number, row[j + 1] as number);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: " ", line: a[i] as string });
      i += 1;
      j += 1;
    } else if (
      ((table[i + 1] as number[])[j] as number) >= ((table[i] as number[])[j + 1] as number)
    ) {
      ops.push({ kind: "-", line: a[i] as string });
      i += 1;
    } else {
      ops.push({ kind: "+", line: b[j] as string });
      j += 1;
    }
  }
  for (; i < a.length; i += 1) ops.push({ kind: "-", line: a[i] as string });
  for (; j < b.length; j += 1) ops.push({ kind: "+", line: b[j] as string });
  return ops;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Unified diff with `context` lines around each change; empty string when equal. */
export function unifiedDiff(before: string, after: string, label: string, context = 3): string {
  if (before === after) return "";
  const ops = diffLines(splitLines(before), splitLines(after));
  const changed = ops.flatMap((op, index) => (op.kind === " " ? [] : [index]));
  if (changed.length === 0) return "";

  // Group changed indices into hunks separated by more than 2*context unchanged lines.
  const hunks: Array<[number, number]> = [];
  for (const index of changed) {
    const last = hunks[hunks.length - 1];
    if (last && index - last[1] <= context * 2) last[1] = index;
    else hunks.push([index, index]);
  }

  const out = [`--- a/${label}`, `+++ b/${label}`];
  for (const [first, last] of hunks) {
    const start = Math.max(0, first - context);
    const end = Math.min(ops.length - 1, last + context);
    const slice = ops.slice(start, end + 1);
    const oldBefore = ops.slice(0, start).filter((op) => op.kind !== "+").length;
    const newBefore = ops.slice(0, start).filter((op) => op.kind !== "-").length;
    const oldCount = slice.filter((op) => op.kind !== "+").length;
    const newCount = slice.filter((op) => op.kind !== "-").length;
    out.push(
      `@@ -${oldBefore + (oldCount ? 1 : 0)},${oldCount} +${newBefore + (newCount ? 1 : 0)},${newCount} @@`,
    );
    for (const op of slice) out.push(`${op.kind}${op.line}`);
  }
  return `${out.join("\n")}\n`;
}
