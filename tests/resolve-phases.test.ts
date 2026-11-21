import { describe, it, expect } from 'vitest';
import { resolvePhases } from '../src/run-pipeline.js';
import type { PipelineOptions, ResolvedPhases } from '../src/run-pipeline.js';

type PhaseFlags = Pick<
  PipelineOptions,
  'scanOnly' | 'analyze' | 'report' | 'input'
>;

// Recorded from the code before the pipeline split: every flag combination.
const CASES: [PhaseFlags, ResolvedPhases][] = [
  [
    { scanOnly: false, analyze: false, report: false },
    { runRead: true, runAnalyze: true, runReport: true, lastPhase: 'report' },
  ],
  [
    { scanOnly: true, analyze: false, report: false },
    { runRead: true, runAnalyze: false, runReport: false, lastPhase: 'read' },
  ],
  [
    { scanOnly: false, analyze: true, report: false },
    { runRead: true, runAnalyze: true, runReport: false, lastPhase: 'analyze' },
  ],
  [
    { scanOnly: true, analyze: true, report: false },
    { runRead: true, runAnalyze: true, runReport: false, lastPhase: 'analyze' },
  ],
  [
    { scanOnly: false, analyze: false, report: true },
    { runRead: true, runAnalyze: true, runReport: true, lastPhase: 'report' },
  ],
  [
    { scanOnly: true, analyze: false, report: true },
    { runRead: true, runAnalyze: true, runReport: true, lastPhase: 'report' },
  ],
  [
    { scanOnly: false, analyze: true, report: true },
    { runRead: true, runAnalyze: true, runReport: true, lastPhase: 'report' },
  ],
  [
    { scanOnly: true, analyze: true, report: true },
    { runRead: true, runAnalyze: true, runReport: true, lastPhase: 'report' },
  ],
  [
    { scanOnly: false, analyze: false, report: false, input: 'in.json' },
    { runRead: true, runAnalyze: true, runReport: true, lastPhase: 'report' },
  ],
  [
    { scanOnly: true, analyze: false, report: false, input: 'in.json' },
    { runRead: true, runAnalyze: false, runReport: false, lastPhase: 'read' },
  ],
  [
    { scanOnly: false, analyze: true, report: false, input: 'in.json' },
    {
      runRead: false,
      runAnalyze: true,
      runReport: false,
      lastPhase: 'analyze',
    },
  ],
  [
    { scanOnly: true, analyze: true, report: false, input: 'in.json' },
    { runRead: true, runAnalyze: true, runReport: false, lastPhase: 'analyze' },
  ],
  [
    { scanOnly: false, analyze: false, report: true, input: 'in.json' },
    { runRead: false, runAnalyze: false, runReport: true, lastPhase: 'report' },
  ],
  [
    { scanOnly: true, analyze: false, report: true, input: 'in.json' },
    { runRead: true, runAnalyze: false, runReport: true, lastPhase: 'report' },
  ],
  [
    { scanOnly: false, analyze: true, report: true, input: 'in.json' },
    { runRead: false, runAnalyze: true, runReport: true, lastPhase: 'report' },
  ],
  [
    { scanOnly: true, analyze: true, report: true, input: 'in.json' },
    { runRead: true, runAnalyze: true, runReport: true, lastPhase: 'report' },
  ],
];

describe('resolvePhases', () => {
  it.each(CASES)('resolves %j', (flags, expected) => {
    expect(resolvePhases(flags)).toEqual(expected);
  });
});
