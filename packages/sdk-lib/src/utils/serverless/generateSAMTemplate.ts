import { ModuleHandler } from "../moduleHandler";
import { cleanUpBaseModule, getSAMParameters } from "./baseModule";
import { applyKeywords, loadServerlessTemplate } from "./slpTemplate";
import { KeywordSLPExtend, SAMTemplate, SLPTemplate } from "./types";
import { getSAMResourceLogicalId } from "./utils";

export const generateSAMTemplate = async (
  dir: string,
  moduleIndicators: string[]
): Promise<SAMTemplate> => {
  const moduleHandler = ModuleHandler.getModuleHandler(dir, moduleIndicators);
  const allModules = await moduleHandler.listModules();

  const serverlessTemplate = await loadServerlessTemplate(allModules);

  applyKeywords(serverlessTemplate);

  cleanUpBaseModule(serverlessTemplate);

  const samTemplate: SAMTemplate = { Parameters: {}, Resources: {} };

  const allModuleNames = allModules.map(m => m.module.name);

  /**
   * This function defines the order of templates to be merged into SAM Template
   *
   * The Order In which the templates are merged is important to keep all child module's resources before parent's
   *
   * For allModuleNames = [A, B, C] in parent to child order
   * The expected order of templates merging is ['base', C, B, A]
   *
   */
  const slpTemplateCompareFn = (
    slpTemplate1: SLPTemplate,
    slpTemplate2: SLPTemplate
  ) => {
    const slpTemplate1Index = allModuleNames.indexOf(slpTemplate1.module);
    const slpTemplate2Index = allModuleNames.indexOf(slpTemplate2.module);

    if (slpTemplate1Index == -1) {
      return -1;
    }
    if (slpTemplate2Index == -1) {
      return 1;
    }

    return slpTemplate2Index - slpTemplate1Index;
  };

  Object.values(serverlessTemplate)
    .sort(slpTemplateCompareFn)
    .forEach(slpTemplate => {
      Object.keys(slpTemplate.Resources).forEach(slpResourceId => {
        if (!slpTemplate.original.Resources[slpResourceId][KeywordSLPExtend]) {
          const samResourceId = getSAMResourceLogicalId(
            slpTemplate.module,
            slpResourceId
          );
          samTemplate.Resources[samResourceId] =
            slpTemplate.Resources[slpResourceId];
        }
      });
    });

  const samParameters = getSAMParameters(serverlessTemplate);
  samTemplate.Parameters = samParameters;

  return samTemplate;
};
