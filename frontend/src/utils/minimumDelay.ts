export async function waitForMinimumDuration(startedAt: number, minimumMs = 550) {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(minimumMs - elapsed, 0);

  if (remaining === 0) return;

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}
