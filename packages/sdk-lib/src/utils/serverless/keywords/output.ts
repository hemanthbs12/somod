import { invert, uniq } from "lodash";
import {
  file_templateYaml,
  namespace_export_parameter,
  path_serverless
} from "../../constants";
import { ModuleHandler } from "../../moduleHandler";
import { loadExportParameterNamespaces } from "../namespace";
import { loadOriginalSlpTemplate } from "../slpTemplate";
import {
  KeywordSLPOutput,
  OriginalSLPTemplate,
  SAMTemplate,
  ServerlessTemplate,
  SLPOutput,
  SLPTemplate
} from "../types";
import {
  getSAMOutputName,
  getSAMResourceLogicalId,
  getSLPKeyword
} from "../utils";

export const validate = (
  slpTemplate: SLPTemplate,
  parameters: string[]
): Error[] => {
  const errors: Error[] = [];

  const missingParameters: string[] = [];
  slpTemplate.keywordPaths[KeywordSLPOutput].forEach(outputKeywordPath => {
    const output = getSLPKeyword<SLPOutput>(slpTemplate, outputKeywordPath)[
      KeywordSLPOutput
    ];

    Object.values(output.export || {}).forEach(exportParameter => {
      if (!parameters.includes(exportParameter)) {
        missingParameters.push(exportParameter);
      }
    });
  });

  if (missingParameters.length > 0) {
    errors.push(
      new Error(
        `Following export parameters referenced from '${path_serverless}/${file_templateYaml}' are not found\n${missingParameters
          .map(p => " - " + p)
          .join("\n")}`
      )
    );
  }

  return errors;
};

export const apply = (serverlessTemplate: ServerlessTemplate) => {
  Object.values(serverlessTemplate).forEach(slpTemplate => {
    slpTemplate.keywordPaths[KeywordSLPOutput].forEach(outputPath => {
      const resourceId = outputPath[0];
      delete slpTemplate.Resources[resourceId][KeywordSLPOutput];
    });
  });
};

export const getSAMOutputs = async (
  dir: string,
  moduleIndicators: string[]
): Promise<SAMTemplate["Outputs"]> => {
  const moduleHandler = ModuleHandler.getModuleHandler(dir, moduleIndicators);
  const exportParameterNamespaces = (
    await moduleHandler.getNamespaces(
      Object.fromEntries(
        moduleIndicators.map(mt => [mt, loadExportParameterNamespaces])
      )
    )
  )[namespace_export_parameter];

  const moduleNames = uniq(Object.values(exportParameterNamespaces));

  const moduleNameToSlpTemplate: Record<string, OriginalSLPTemplate> = {};

  await Promise.all(
    moduleNames.map(async moduleName => {
      const moduleNode = await moduleHandler.getModule(moduleName);

      const originalSLPTemplate = await loadOriginalSlpTemplate(
        moduleNode.module
      );

      moduleNameToSlpTemplate[moduleName] = originalSLPTemplate;
    })
  );

  const outputs: SAMTemplate["Outputs"] = {};

  Object.keys(exportParameterNamespaces).forEach(exportParameter => {
    const moduleName = exportParameterNamespaces[exportParameter];
    const slpTemplate = moduleNameToSlpTemplate[moduleName];

    for (const resourceId in slpTemplate.Resources) {
      if (
        slpTemplate.Resources[resourceId][KeywordSLPOutput] &&
        Object.values(
          slpTemplate.Resources[resourceId][KeywordSLPOutput].export || {}
        ).includes(exportParameter)
      ) {
        const attributeName = invert(
          slpTemplate.Resources[resourceId][KeywordSLPOutput].export
        )[exportParameter];

        outputs[getSAMOutputName(exportParameter)] = {
          Description: exportParameter,
          Value:
            attributeName == "default"
              ? {
                  Ref: getSAMResourceLogicalId(moduleName, resourceId)
                }
              : {
                  "Fn::GetAtt": [
                    getSAMResourceLogicalId(moduleName, resourceId),
                    attributeName
                  ]
                }
        };

        break;
      }
    }
  });

  return outputs;
};
