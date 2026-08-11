/**
 * Serialize and deserialize pipeline data for phase handoff (--scan-only → --analyze → --report).
 * ScanResult uses Map; JSON does not preserve Maps, so we use plain objects for the wire format.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { isMarkdownFile } from './utils/fs-helpers.js';
import type { ReportData, ScanResult, VaultFile, WikiLink } from './types.js';

/** JSON-safe shape for ScanResult (Maps as plain objects). */
export interface ScanResultJSON {
  files: VaultFile[];
  mdFiles: VaultFile[];
  links: WikiLink[];
  fileIndex: Record<string, VaultFile>;
  nameIndex: Record<string, VaultFile[]>;
  filenameIndex: Record<string, VaultFile[]>;
}

export function serializeScanResult(scan: ScanResult): string {
  const json: ScanResultJSON = {
    files: scan.files,
    mdFiles: scan.mdFiles,
    links: scan.links,
    fileIndex: Object.fromEntries(scan.fileIndex),
    nameIndex: Object.fromEntries(scan.nameIndex),
    filenameIndex: Object.fromEntries(scan.filenameIndex),
  };
  return JSON.stringify(json, null, 2);
}

export function deserializeScanResult(json: string): ScanResult {
  const parsed = JSON.parse(json) as ScanResultJSON;
  return {
    files: parsed.files,
    mdFiles:
      parsed.mdFiles ??
      parsed.files.filter((f) => isMarkdownFile(f.relativePath)),
    links: parsed.links,
    fileIndex: new Map(Object.entries(parsed.fileIndex ?? {})),
    nameIndex: new Map(
      Object.entries(parsed.nameIndex ?? {}).map(([k, v]) => [
        k,
        v as VaultFile[],
      ]),
    ),
    filenameIndex: new Map(
      Object.entries(parsed.filenameIndex ?? {}).map(([k, v]) => [
        k,
        v as VaultFile[],
      ]),
    ),
  };
}

/** ReportData with timestamp as ISO string for JSON. */
interface ReportDataJSON extends Omit<ReportData, 'timestamp'> {
  timestamp: string;
}

export function serializeReportData(data: ReportData): string {
  const json: ReportDataJSON = {
    ...data,
    timestamp: data.timestamp.toISOString(),
  };
  return JSON.stringify(json, null, 2);
}

export function deserializeReportData(json: string): ReportData {
  const parsed = JSON.parse(json) as ReportDataJSON;
  return {
    ...parsed,
    timestamp: new Date(parsed.timestamp),
  };
}

export async function readScanResultFromFile(
  path: string,
): Promise<ScanResult> {
  const content = await readFile(path, 'utf-8');
  return deserializeScanResult(content);
}

export async function readReportDataFromFile(
  path: string,
): Promise<ReportData> {
  const content = await readFile(path, 'utf-8');
  return deserializeReportData(content);
}

export async function writeToFile(
  path: string,
  content: string,
): Promise<void> {
  await writeFile(path, content, 'utf-8');
}
