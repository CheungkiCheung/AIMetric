import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type RuleContext = {
  projectKey?: string;
  projectType?: string;
  toolType: string;
  sceneType: string;
};

export interface ProjectRulePack {
  projectKey: string;
  version: string;
  mandatoryRules: string[];
  onDemandRules: string[];
  knowledgeRefs: string[];
  terminology: string[];
}

export interface RuleVersionSummary {
  version: string;
  status: 'active' | 'deprecated';
  updatedAt: string;
  summary: string;
}

export interface RuleTemplateSection {
  id: string;
  title: string;
  content: string;
}

export interface ProjectRuleTemplate {
  projectKey: string;
  version: string;
  extends?: string;
  terminology: string[];
  sections: RuleTemplateSection[];
  rules: {
    must: string[];
    should: string[];
    onDemand: string[];
  };
}

type ProjectRuleCatalogEntry = Omit<ProjectRulePack, 'mandatoryRules' | 'onDemandRules'> & {
  sceneMandatoryRules: Record<string, string[]>;
  sceneOnDemandRules: Record<string, string[]>;
  activeVersion: string;
  versions: RuleVersionSummary[];
  templates: Record<string, ProjectRuleTemplate>;
};

export interface RuleCatalogOptions {
  catalogRoot?: string;
}

interface ProjectRuleManifest {
  projectKey: string;
  activeVersion: string;
  knowledgeRefs: string[];
  sceneMandatoryRules: Record<string, string[]>;
  sceneOnDemandRules: Record<string, string[]>;
  versions: RuleVersionSummary[];
}

const defaultCatalogRoot = fileURLToPath(new URL('./templates', import.meta.url));

const readJsonFile = <T>(filePath: string): T =>
  JSON.parse(readFileSync(filePath, 'utf8')) as T;

const getCatalogRoot = (options?: RuleCatalogOptions): string =>
  options?.catalogRoot ?? defaultCatalogRoot;

const getProjectDirectory = (
  projectKey: string,
  options?: RuleCatalogOptions,
): string => `${getCatalogRoot(options)}/${projectKey}`;

const getManifestPath = (
  projectKey: string,
  options?: RuleCatalogOptions,
): string => `${getProjectDirectory(projectKey, options)}/manifest.json`;

const getTemplatePath = (
  projectKey: string,
  version: string,
  options?: RuleCatalogOptions,
): string => `${getProjectDirectory(projectKey, options)}/${version}.json`;

const loadProjectRuleCatalogEntry = (
  projectKey: string,
  options?: RuleCatalogOptions,
): ProjectRuleCatalogEntry => {
  const manifest = readJsonFile<ProjectRuleManifest>(
    getManifestPath(projectKey, options),
  );
  const templates = Object.fromEntries(
    manifest.versions.map((versionSummary) => [
      versionSummary.version,
      readJsonFile<ProjectRuleTemplate>(
        getTemplatePath(projectKey, versionSummary.version, options),
      ),
    ]),
  ) as Record<string, ProjectRuleTemplate>;
  const activeTemplate = templates[manifest.activeVersion];

  return {
    projectKey: manifest.projectKey,
    version: manifest.activeVersion,
    activeVersion: manifest.activeVersion,
    knowledgeRefs: manifest.knowledgeRefs,
    terminology: activeTemplate.terminology,
    sceneMandatoryRules: manifest.sceneMandatoryRules,
    sceneOnDemandRules: manifest.sceneOnDemandRules,
    versions: manifest.versions,
    templates,
  };
};

const defaultProjectKey = 'aimetric';

export function resolveRuleBundle(
  context: RuleContext,
  options?: RuleCatalogOptions,
) {
  const projectKey = context.projectKey ?? defaultProjectKey;
  const projectConfig = loadProjectRuleCatalogEntry(projectKey, options);
  const activeTemplate = projectConfig.templates[projectConfig.activeVersion];
  const mandatoryRules = [
    ...activeTemplate.rules.must,
    ...(projectConfig.sceneMandatoryRules[context.sceneType] ?? []),
  ];
  const onDemandRules = [
    ...activeTemplate.rules.onDemand,
    ...(projectConfig.sceneOnDemandRules[context.sceneType] ?? []),
  ];

  return {
    mandatoryRules,
    onDemandRules,
  };
}

export function getProjectRulePack(
  context: Omit<RuleContext, 'projectType'> & { projectKey?: string },
  options?: RuleCatalogOptions,
): ProjectRulePack {
  const projectKey = context.projectKey ?? defaultProjectKey;
  const projectConfig = loadProjectRuleCatalogEntry(projectKey, options);
  const resolved = resolveRuleBundle(context, options);

  return {
    projectKey: projectConfig.projectKey,
    version: projectConfig.activeVersion,
    mandatoryRules: resolved.mandatoryRules,
    onDemandRules: resolved.onDemandRules,
    knowledgeRefs: projectConfig.knowledgeRefs,
    terminology: projectConfig.terminology,
  };
}

export function listRuleVersions(
  projectKey = defaultProjectKey,
  options?: RuleCatalogOptions,
) {
  const projectConfig = loadProjectRuleCatalogEntry(projectKey, options);

  return {
    projectKey: projectConfig.projectKey,
    activeVersion: projectConfig.activeVersion,
    versions: projectConfig.versions,
  };
}

export function getRuleTemplate(input: {
  projectKey?: string;
  version?: string;
}, options?: RuleCatalogOptions): ProjectRuleTemplate {
  const projectKey = input.projectKey ?? defaultProjectKey;
  const projectConfig = loadProjectRuleCatalogEntry(projectKey, options);
  const version = input.version ?? projectConfig.activeVersion;
  const template = projectConfig.templates[version];

  if (!template) {
    throw new Error(`Unknown rule template version: ${projectKey}@${version}`);
  }

  return template;
}

export function validateRuleTemplate(
  input: {
    projectKey?: string;
    version?: string;
  },
  options?: RuleCatalogOptions,
) {
  const template = getRuleTemplate(input, options);
  const versions = listRuleVersions(input.projectKey ?? defaultProjectKey, options);
  const errors: string[] = [];

  if (template.projectKey !== (input.projectKey ?? defaultProjectKey)) {
    errors.push('Template projectKey does not match the requested project.');
  }

  if (template.version !== (input.version ?? versions.activeVersion)) {
    errors.push('Template version does not match the requested version.');
  }

  if (template.sections.length === 0) {
    errors.push('Template must include at least one section.');
  }

  if (template.rules.must.length === 0) {
    errors.push('Template must include at least one mandatory rule.');
  }

  if (
    template.extends &&
    !versions.versions.some((version) => version.version === template.extends)
  ) {
    errors.push('Template extends an unknown version.');
  }

  return {
    projectKey: template.projectKey,
    version: template.version,
    activeVersion: versions.activeVersion,
    valid: errors.length === 0,
    errors,
  };
}

export function setActiveRuleVersion(
  input: {
    projectKey?: string;
    version: string;
  },
  options?: RuleCatalogOptions,
) {
  const projectKey = input.projectKey ?? defaultProjectKey;
  const manifestPath = getManifestPath(projectKey, options);
  const manifest = readJsonFile<ProjectRuleManifest>(manifestPath);
  const previousVersion = manifest.activeVersion;
  const nextVersion = manifest.versions.find(
    (version) => version.version === input.version,
  );

  if (!nextVersion) {
    throw new Error(`Unknown rule version: ${projectKey}@${input.version}`);
  }

  const updatedManifest: ProjectRuleManifest = {
    ...manifest,
    activeVersion: input.version,
    versions: manifest.versions.map((version) => ({
      ...version,
      status: version.version === input.version ? 'active' : 'deprecated',
    })),
  };

  writeFileSync(
    manifestPath,
    `${JSON.stringify(updatedManifest, null, 2)}\n`,
    'utf8',
  );

  return {
    projectKey,
    previousVersion,
    activeVersion: input.version,
  };
}
