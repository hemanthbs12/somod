import { CommonOptions, taskRunner, Command } from "nodejs-cli-runner";
import {
  createPages,
  createPublicAssets,
  deletePagesAndPublicDir,
  file_dotenv,
  file_nextConfigJs,
  file_parametersJson,
  file_templateYaml,
  findRootDir,
  generateNextConfig,
  generateRootParameters,
  prepareSAMTemplate,
  loadPlugins,
  path_pages,
  path_public,
  runPluginPrepare,
  runPluginPreprepare,
  initializeModuleHandler,
  bundleFunctions,
  bundleFunctionLayers
} from "somod-lib";
import {
  addSOMODCommandTypeOptions,
  getSOMODCommandTypeOptions,
  SOMODCommandTypeOptions
} from "../utils/common";

type PrepareOptions = CommonOptions & SOMODCommandTypeOptions;

export const PrepareAction = async ({
  verbose,
  ...options
}: PrepareOptions): Promise<void> => {
  const dir = findRootDir();

  const { ui, serverless } = getSOMODCommandTypeOptions(options);

  const plugins = await loadPlugins(dir);

  await taskRunner(
    `Initialize ModuleHandler`,
    initializeModuleHandler,
    verbose,
    dir,
    plugins.namespaceLoaders
  );

  await Promise.all(
    plugins.preprepare.map(plugin =>
      taskRunner(
        `PrePrepare plugin ${plugin.name}`,
        runPluginPreprepare,
        verbose,
        dir,
        plugin.plugin,
        {
          ui,
          serverless
        }
      )
    )
  );

  if (ui) {
    await taskRunner(
      `Deleting /${path_pages} and /${path_public}`,
      deletePagesAndPublicDir,
      verbose,
      dir
    );
    await taskRunner(`Create /${path_pages}`, createPages, verbose, dir);
    await taskRunner(
      `Create /${path_public}`,
      createPublicAssets,
      verbose,
      dir
    );
  }
  await taskRunner(
    `Create/Update /${file_parametersJson}`,
    generateRootParameters,
    verbose,
    dir
  );

  if (ui) {
    await taskRunner(
      `Gernerate /${file_nextConfigJs} and /${file_dotenv}`,
      generateNextConfig,
      verbose,
      dir,
      plugins.uiKeywords
    );
  }
  if (serverless) {
    await taskRunner(
      `Bundle Serverless Functions`,
      bundleFunctions,
      verbose,
      dir
    );

    await taskRunner(
      `Bundle Serverless FunctionLayers`,
      bundleFunctionLayers,
      verbose,
      dir,
      verbose
    );

    await taskRunner(
      `Generate /${file_templateYaml}`,
      prepareSAMTemplate,
      verbose,
      dir,
      plugins.serverlessKeywords
    );
  }

  await Promise.all(
    plugins.prepare.map(plugin =>
      taskRunner(
        `Prepare plugin ${plugin.name}`,
        runPluginPrepare,
        verbose,
        dir,
        plugin.plugin,
        {
          ui,
          serverless
        }
      )
    )
  );
};

const prepareCommand = new Command("prepare");

prepareCommand.action(PrepareAction);
addSOMODCommandTypeOptions(prepareCommand);

export default prepareCommand;
