import cron from 'node-cron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from 'pino';
import { withLock } from '@levelup/tenancy';

export interface JobDef {
  name: string;
  /** cron expression OR interval in ms */
  schedule: string | number;
  run: () => Promise<void>;
}

interface SchedulerState {
  [job: string]: { lastRunAt: string; processedCount: number };
}

export class Scheduler {
  private tasks: cron.ScheduledTask[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private statePath: string;
  private lockDir: string;
  private log: Logger;

  constructor(dataRoot: string, log: Logger) {
    this.statePath = join(dataRoot, 'scheduler-state.json');
    this.lockDir = join(dataRoot, 'locks');
    this.log = log;
    mkdirSync(this.lockDir, { recursive: true });
  }

  register(job: JobDef): void {
    const wrapped = async () => {
      const result = await withLock(this.lockDir, job.name, async () => {
        this.log.info({ job: job.name }, 'job started');
        const start = Date.now();
        await job.run();
        const elapsed = Date.now() - start;
        this.log.info({ job: job.name, elapsed }, 'job completed');
        this.updateState(job.name);
      });
      if (result === null) {
        this.log.debug({ job: job.name }, 'job skipped — lock held');
      }
    };

    if (typeof job.schedule === 'number') {
      const interval = setInterval(() => void wrapped(), job.schedule);
      this.intervals.push(interval);
      // Also run immediately on start
      void wrapped();
    } else {
      const task = cron.schedule(job.schedule, () => void wrapped());
      this.tasks.push(task);
    }
  }

  private updateState(jobName: string): void {
    let state: SchedulerState = {};
    if (existsSync(this.statePath)) {
      try {
        state = JSON.parse(readFileSync(this.statePath, 'utf-8')) as SchedulerState;
      } catch { /* corrupted, reset */ }
    }
    const prev = state[jobName];
    state[jobName] = {
      lastRunAt: new Date().toISOString(),
      processedCount: (prev?.processedCount ?? 0) + 1,
    };
    writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  stop(): void {
    for (const t of this.tasks) t.stop();
    for (const i of this.intervals) clearInterval(i);
    this.tasks = [];
    this.intervals = [];
  }
}
