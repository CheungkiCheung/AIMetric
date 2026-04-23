import { readFileSync } from 'node:fs';
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

interface ProjectRuleManifest {
  projectKey: string;
  activeVersion: string;
  knowledgeRefs: string[];
  sceneMandatoryRules: Record<string, string[]>;
  sceneOnDemandRules: Record<string, string[]>;
  versions: RuleVersionSummary[];
}

const readJsonFile = <T>(fileUrl: URL): T =>
  JSON.parse(readFileSync(fileURLToPath(fileUrl), 'utf8')) as T;

const loadProjectRuleCatalogEntry = (projectKey: string): ProjectRuleCatalogEntry => {
  const manifest = readJsonFile<ProjectRuleManifest>(
    new URL(`./templates/${projectKey}/manifest.json`, import.meta.url),
  );
  const templates = Object.fromEntries(
    manifest.versions.map((versionSummary) => [
      versionSummary.version,
      readJsonFile<ProjectRuleTemplate>(
        new URL(
          `./templates/${projectKey}/${versionSummary.version}.json`,
          import.meta.url,
        ),
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

const projectRuleCatalog: Record<string, ProjectRuleCatalogEntry> = {
  aimetric: loadProjectRuleCatalogEntry('aimetric'),
};

const defaultProjectKey = 'aimetric';

export function resolveRuleBundle(context: RuleContext) {
  const projectKey = context.projectKey ?? defaultProjectKey;
  const projectConfig = projectRuleCatalog[projectKey] ?? projectRuleCatalog[defaultProjectKey];
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
): ProjectRulePack {
  const projectKey = context.projectKey ?? defaultProjectKey;
  const projectConfig = projectRuleCatalog[projectKey] ?? projectRuleCatalog[defaultProjectKey];
  const resolved = resolveRuleBundle(context);

  return {
    projectKey: projectConfig.projectKey,
    version: projectConfig.version,
    mandatoryRules: resolved.mandatoryRules,
    onDemandRules: resolved.onDemandRules,
    knowledgeRefs: projectConfig.knowledgeRefs,
    terminology: projectConfig.terminology,
  };
}

export function listRuleVersions(projectKey = defaultProjectKey) {
  const projectConfig = projectRuleCatalog[projectKey] ?? projectRuleCatalog[defaultProjectKey];

  return {
    projectKey: projectConfig.projectKey,
    activeVersion: projectConfig.activeVersion,
    versions: projectConfig.versions,
  };
}

export function getRuleTemplate(input: {
  projectKey?: string;
  version?: string;
}): ProjectRuleTemplate {
  const projectKey = input.projectKey ?? defaultProjectKey;
  const projectConfig = projectRuleCatalog[projectKey] ?? projectRuleCatalog[defaultProjectKey];
  const version = input.version ?? projectConfig.activeVersion;
  const template = projectConfig.templates[version];

  if (!template) {
    throw new Error(`Unknown rule template version: ${projectKey}@${version}`);
  }

  return template;
}
