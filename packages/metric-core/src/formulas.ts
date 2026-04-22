export function calculateAiOutputRate(
  acceptedAiLines: number,
  commitTotalLines: number
): number {
  if (commitTotalLines <= 0) {
    return 0;
  }

  return acceptedAiLines / commitTotalLines;
}
