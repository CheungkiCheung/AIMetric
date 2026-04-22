export interface BuildCommitEvidenceInput {
  aiLines: string[];
  commitLines: string[];
}

export interface CommitEvidence {
  acceptedAiLines: number;
  commitTotalLines: number;
}

const normalizeLine = (line: string): string => line.trim();

export const buildCommitEvidence = (
  input: BuildCommitEvidenceInput,
): CommitEvidence => {
  const remainingCommitLines = [...input.commitLines].map(normalizeLine);

  const acceptedAiLines = input.aiLines
    .map(normalizeLine)
    .filter((line) => line.length > 0)
    .reduce((acceptedCount, aiLine) => {
      const matchedIndex = remainingCommitLines.indexOf(aiLine);

      if (matchedIndex === -1) {
        return acceptedCount;
      }

      remainingCommitLines.splice(matchedIndex, 1);
      return acceptedCount + 1;
    }, 0);

  return {
    acceptedAiLines,
    commitTotalLines: input.commitLines.length,
  };
};
