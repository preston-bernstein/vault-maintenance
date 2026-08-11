/**
 * File logger for pipeline runs. When enabled, appends to a day-based log file
 * (logDir/YYYY/MM/YYYY-MM-DD.log) with timestamps and run start/finish headers.
 * Safe for multiple runs per day.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { toISODateString } from './fs-helpers.js';

let currentLogPath: string | null = null;

function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Start logging to a file under logDir. Creates logDir/YYYY/MM/YYYY-MM-DD.log and
 * writes a run start header. Idempotent: if already logging, does nothing.
 */
export async function startLogFile(logDir: string, vaultPath: string): Promise<void> {
  if (currentLogPath !== null) return;
  const dateStr = toISODateString(new Date());
  const [year, month] = dateStr.split('-');
  const logDirForDay = join(logDir, year, month);
  await mkdir(logDirForDay, { recursive: true });
  const path = join(logDirForDay, `${dateStr}.log`);
  const header = `===== ${timestamp()} Run start (vault: ${vaultPath}) =====\n`;
  await appendFile(path, header, 'utf-8');
  currentLogPath = path;
}

/**
 * Append a line to the current log file with a timestamp prefix. No-op if not logging.
 */
export async function writeLogLine(message: string): Promise<void> {
  if (currentLogPath === null) return;
  const line = message.endsWith('\n') ? message : `${message}\n`;
  const stamped = `${timestamp()}  ${line}`;
  await appendFile(currentLogPath, stamped, 'utf-8');
}

/**
 * Write run finished line and stop logging. Safe to call when not logging.
 */
export async function endLogFile(exitCode: number): Promise<void> {
  if (currentLogPath === null) return;
  const line = `${timestamp()}  Run finished (exitCode=${exitCode})\n`;
  await appendFile(currentLogPath, line, 'utf-8');
  currentLogPath = null;
}

/** True if startLogFile has been called and endLogFile has not yet been called. */
export function isLogging(): boolean {
  return currentLogPath !== null;
}
