import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { dump } from "js-yaml";
import { join } from "path";
import { validateSchema } from "../../../src/tasks/serverless/validateSchema";
import { buildTemplateYaml } from "../../../src/utils/serverless/buildTemplateYaml";
import { createFiles, createTempDir, deleteDir } from "../../utils";
import {
  functionDefaults,
  installSchemaInTempDir,
  singlePackageJson,
  StringifyTemplate
} from "./utils";

describe("Test Util serverless.buildTemplateYaml", () => {
  let dir: string = null;
  let buildTemplateJsonPath = null;

  beforeEach(async () => {
    dir = createTempDir();
    buildTemplateJsonPath = join(dir, "build", "serverless", "template.json");
    await installSchemaInTempDir(dir);
  });

  afterEach(() => {
    deleteDir(dir);
  });

  test("with empty module", async () => {
    createFiles(dir, { ...singlePackageJson });
    await expect(buildTemplateYaml(dir)).resolves.toBeUndefined();
    expect(existsSync(buildTemplateJsonPath)).toBeFalsy();
  });

  test("with only root module", async () => {
    const template = {
      Resources: {
        Resource1: {
          Type: "AWS::Serverless::Function",
          Properties: { ...functionDefaults }
        }
      }
    };
    createFiles(dir, {
      "serverless/template.yaml": dump(template),
      ...singlePackageJson
    });

    await validateSchema(dir); // make sure schema is right
    await expect(buildTemplateYaml(dir)).resolves.toBeUndefined();

    await expect(
      readFile(buildTemplateJsonPath, { encoding: "utf8" })
    ).resolves.toEqual(StringifyTemplate(template));
  });

  test("with reused modules", async () => {
    /**
     * The Dependency tree is
     *             sample
     *             /     \
     *        sample2    sample3
     *             \     /     \
     *             sample4     sample5
     */
    const template = {
      Resources: {
        Resource1: {
          Type: "AWS::Serverless::Function",
          "SOMOD::Extend": {
            module: "@my-scope/sample3",
            resource: "Sample3Function"
          },
          "SOMOD::DependsOn": [
            {
              module: "@my-scope/sample5",
              resource: "AnotherFunction"
            }
          ],
          Properties: { ...functionDefaults }
        }
      }
    };
    createFiles(dir, {
      "serverless/template.yaml": dump(template),
      "package.json": JSON.stringify({
        name: "@my-scope/sample",
        version: "1.0.0",
        dependencies: {
          "@my-scope/sample2": "^1.0.0",
          "@my-scope/sample3": "^1.0.0"
        },
        somod: "1.3.2"
      }),
      "node_modules/@my-scope/sample2/package.json": JSON.stringify({
        name: "@my-scope/sample2",
        version: "1.0.0",
        dependencies: { "@my-scope/sample4": "^1.0.0" },
        somod: "1.3.2"
      }),
      "node_modules/@my-scope/sample2/build/serverless/template.json":
        JSON.stringify({
          Resources: {
            Sample2Function: {
              Type: "AWS::Serverless::Function",
              "SOMOD::DependsOn": [
                {
                  module: "@my-scope/sample4",
                  resource: "OriginalFunction"
                }
              ],
              Properties: { ...functionDefaults }
            }
          }
        }),
      "node_modules/@my-scope/sample3/package.json": JSON.stringify({
        name: "@my-scope/sample3",
        version: "1.0.0",
        dependencies: {
          "@my-scope/sample4": "^1.0.0",
          "@my-scope/sample5": "^1.0.0"
        },
        somod: "1.3.2"
      }),
      "node_modules/@my-scope/sample3/build/serverless/template.json":
        JSON.stringify({
          Resources: {
            Sample3Function: {
              Type: "AWS::Serverless::Function",
              "SOMOD::DependsOn": [
                {
                  module: "@my-scope/sample4",
                  resource: "OriginalFunction"
                }
              ],
              Properties: { ...functionDefaults }
            }
          }
        }),
      "node_modules/@my-scope/sample4/package.json": JSON.stringify({
        name: "@my-scope/sample4",
        version: "1.0.0",
        dependencies: {},
        somod: "1.3.2"
      }),
      "node_modules/@my-scope/sample4/build/serverless/template.json":
        JSON.stringify({
          Resources: {
            OriginalFunction: {
              Type: "AWS::Serverless::Function",
              Properties: { ...functionDefaults }
            }
          }
        }),
      "node_modules/@my-scope/sample5/package.json": JSON.stringify({
        name: "@my-scope/sample5",
        version: "1.0.0",
        dependencies: {},
        somod: "1.3.2"
      }),
      "node_modules/@my-scope/sample5/build/serverless/template.json":
        JSON.stringify({
          Resources: {
            AnotherFunction: {
              Type: "AWS::Serverless::Function",
              Properties: { ...functionDefaults }
            }
          }
        })
    });

    await validateSchema(dir); // make sure schema is right
    await expect(buildTemplateYaml(dir)).resolves.toBeUndefined();

    await expect(
      readFile(buildTemplateJsonPath, { encoding: "utf8" })
    ).resolves.toEqual(StringifyTemplate(template));
  });
});
