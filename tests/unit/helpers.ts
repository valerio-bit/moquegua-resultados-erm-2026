import { readFileSync } from "node:fs";
import path from "node:path";
import type { Dataset } from "@/lib/schemas";

export const ROOT = process.cwd();

export function loadPublished(): Dataset {
  return JSON.parse(readFileSync(path.join(ROOT, "data", "processed", "dataset.json"), "utf8")) as Dataset;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
