import type { Context } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { appendNdjsonLine, type NdjsonRecord, type NdjsonWorkflowStart } from '../fs/index.js';
import { createLogger } from '../../shared/utils/debug.js';
import {
  mapSpanEndToNdjson,
  mapSpanStartToNdjson,
  type SpanSnapshot,
} from '../../core/logging/span-to-ndjson-mapper.js';

const log = createLogger('session-log-span-processor');

export interface SessionLogSpanProcessorOptions {
  runId: string;
  shadowLogPath: string;
  sanitizedTask: string;
  workflowName: string;
}

export class SessionLogSpanProcessor implements SpanProcessor {
  private readonly registrations = new Map<string, SessionLogSpanProcessorOptions>();

  constructor(options?: SessionLogSpanProcessorOptions) {
    if (options) {
      this.register(options);
    }
  }

  register(options: SessionLogSpanProcessorOptions): () => void {
    this.registrations.set(options.runId, options);
    const startRecord: NdjsonWorkflowStart = {
      type: 'workflow_start',
      task: options.sanitizedTask,
      workflowName: options.workflowName,
      startTime: new Date().toISOString(),
    };
    this.safeAppend(options, startRecord);
    return () => {
      this.registrations.delete(options.runId);
    };
  }

  onStart(span: Span, _parentContext: Context): void {
    const options = this.optionsForSpan(span);
    if (!options) {
      return;
    }
    if (span.name.startsWith('phase.')) {
      return;
    }
    const record = mapSpanStartToNdjson(toSpanSnapshot(span));
    this.safeAppend(options, record);
  }

  onEnd(span: ReadableSpan): void {
    const options = this.optionsForSpan(span);
    if (!options) {
      return;
    }
    const snapshot = toSpanSnapshot(span);
    if (span.name.startsWith('phase.')) {
      this.safeAppend(options, mapSpanStartToNdjson(snapshot));
    }
    const record = mapSpanEndToNdjson(snapshot);
    this.safeAppend(options, record);
  }

  private optionsForSpan(span: ReadableSpan): SessionLogSpanProcessorOptions | undefined {
    const runId = span.attributes['takt.run.id'];
    return typeof runId === 'string' ? this.registrations.get(runId) : undefined;
  }

  private safeAppend(options: SessionLogSpanProcessorOptions, record: NdjsonRecord | undefined): void {
    if (!record) {
      return;
    }
    try {
      appendNdjsonLine(options.shadowLogPath, record);
    } catch (error) {
      log.error('Failed to append shadow session log record', {
        shadowLogPath: options.shadowLogPath,
        recordType: record.type,
        error,
      });
    }
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {
    this.registrations.clear();
  }
}

function toSpanSnapshot(span: ReadableSpan): SpanSnapshot {
  return {
    name: span.name,
    attributes: span.attributes,
    startTime: span.startTime,
    endTime: span.endTime,
  };
}
