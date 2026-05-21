import type { Context } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { appendNdjsonLine, type NdjsonWorkflowStart } from '../fs/index.js';
import { sanitizeTextForStorage } from '../../features/tasks/execute/traceReportRedaction.js';
import {
  mapSpanEndToNdjson,
  mapSpanStartToNdjson,
  type SpanSnapshot,
} from '../../core/logging/span-to-ndjson-mapper.js';

export interface SessionLogSpanProcessorOptions {
  shadowLogPath: string;
  task: string;
  workflowName: string;
  allowSensitiveData: boolean;
}

export class SessionLogSpanProcessor implements SpanProcessor {
  private readonly shadowLogPath: string;

  constructor(options: SessionLogSpanProcessorOptions) {
    this.shadowLogPath = options.shadowLogPath;
    const startRecord: NdjsonWorkflowStart = {
      type: 'workflow_start',
      task: sanitizeTextForStorage(options.task, options.allowSensitiveData),
      workflowName: options.workflowName,
      startTime: new Date().toISOString(),
    };
    appendNdjsonLine(this.shadowLogPath, startRecord);
  }

  onStart(span: Span, _parentContext: Context): void {
    const record = mapSpanStartToNdjson(toSpanSnapshot(span));
    if (record) {
      appendNdjsonLine(this.shadowLogPath, record);
    }
  }

  onEnd(span: ReadableSpan): void {
    const record = mapSpanEndToNdjson(toSpanSnapshot(span));
    if (record) {
      appendNdjsonLine(this.shadowLogPath, record);
    }
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}

function toSpanSnapshot(span: ReadableSpan): SpanSnapshot {
  return {
    name: span.name,
    attributes: span.attributes,
    startTime: span.startTime,
    endTime: span.endTime,
  };
}
