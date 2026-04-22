import { buildCommitEvidence, type BuildCommitEvidenceInput } from '@aimetric/git-attribution';

export class AttributionService {
  buildEvidence(input: BuildCommitEvidenceInput) {
    return buildCommitEvidence(input);
  }
}
