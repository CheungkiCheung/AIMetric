import {
  getProjectRulePack,
  getRuleTemplate,
  listRuleVersions,
  setActiveRuleVersion,
  validateRuleTemplate,
  type RuleCatalogOptions,
} from '@aimetric/rule-engine';

export class RuleCenterService {
  constructor(private readonly options: RuleCatalogOptions = {}) {}

  getProjectRules(input: {
    projectKey: string;
    toolType: string;
    sceneType: string;
  }) {
    return getProjectRulePack(input, this.options);
  }

  listVersions(projectKey: string) {
    return listRuleVersions(projectKey, this.options);
  }

  getTemplate(input: { projectKey: string; version?: string }) {
    return getRuleTemplate(input, this.options);
  }

  validateTemplate(input: { projectKey: string; version?: string }) {
    return validateRuleTemplate(input, this.options);
  }

  setActiveVersion(input: { projectKey: string; version: string }) {
    return setActiveRuleVersion(input, this.options);
  }
}
