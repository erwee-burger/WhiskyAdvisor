export function getBottleImage(expressionName: string) {
  const name = expressionName.toLowerCase();

  if (name.includes("octomore") || name.includes("ardbeg")) return "/bottles/bottle-placeholder-c.svg";
  if (name.includes("macallan") || name.includes("balvenie") || name.includes("bunnahabhain")) return "/bottles/bottle-placeholder-a.svg";
  if (name.includes("talisker") || name.includes("ben nevis")) return "/bottles/bottle-placeholder-e.svg";
  if (name.includes("glendronach") || name.includes("glenallachie")) return "/bottles/bottle-placeholder-d.svg";
  if (name.includes("glenfiddich") || name.includes("kavalan")) return "/bottles/bottle-placeholder-b.svg";

  return "/bottles/bottle-placeholder-a.svg";
}
