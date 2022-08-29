import { getPath } from "../../jsonTemplate";
import { KeywordDefinition } from "../../keywords/types";

export const keywordCreateIf: KeywordDefinition<boolean> = {
  keyword: "SOMOD::CreateIf",

  getValidator: async () => (keyword, node) => {
    const errors: Error[] = [];

    const path = getPath(node);
    if (!(path.length == 2 && path[0] == "Resources")) {
      errors.push(new Error(`${keyword} is allowed only as Resource Property`));
    }

    //NOTE: structure of the value is validated by serverless-schema

    return errors;
  },

  getProcessor: async () => (keyword, node, value) => {
    return value
      ? { type: "keyword", value: {} }
      : {
          type: "object",
          value: undefined
        };
  }
};
