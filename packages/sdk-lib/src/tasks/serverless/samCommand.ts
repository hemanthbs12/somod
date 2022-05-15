import { childProcess } from "@solib/cli-base";

export const samCommand = async (
  dir: string,
  action: "validate" | "build" | "deploy",
  guided = false
): Promise<void> => {
  const args: string[] = [action];
  if (action == "deploy" && guided) {
    args.push("--guided");
  }
  await childProcess(
    dir,
    process.platform === "win32" ? "sam.cmd" : "sam",
    args,
    { show: "on", return: "off" },
    { show: "on", return: "off" }
  );
};
