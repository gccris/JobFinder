export type SyncProgressState = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  totalCompanies: number;
  processedCompanies: number;
  totalJobs: number;
  createdJobs: number;
  failures: number;
  currentSource: string | null;
  currentCompany: string | null;
  bySource: Record<
    string,
    {
      totalCompanies: number;
      processedCompanies: number;
      totalJobs: number;
      createdJobs: number;
      failures: number;
    }
  >;
};

const defaultState = (): SyncProgressState => ({
  running: false,
  startedAt: null,
  finishedAt: null,
  totalCompanies: 0,
  processedCompanies: 0,
  totalJobs: 0,
  createdJobs: 0,
  failures: 0,
  currentSource: null,
  currentCompany: null,
  bySource: {},
});

declare global {
  // eslint-disable-next-line no-var
  var __jobSyncProgress: SyncProgressState | undefined;
}

function getState() {
  if (!globalThis.__jobSyncProgress) {
    globalThis.__jobSyncProgress = defaultState();
  }

  return globalThis.__jobSyncProgress;
}

export function resetSyncProgress(totalCompanies = 0) {
  globalThis.__jobSyncProgress = {
    ...defaultState(),
    running: true,
    startedAt: new Date().toISOString(),
    totalCompanies,
  };
  return globalThis.__jobSyncProgress;
}

export function updateSyncProgress(input: Partial<SyncProgressState> & { source?: string }) {
  const state = getState();
  const next = {
    ...state,
    ...input,
  } as SyncProgressState;

  if (input.source) {
    next.bySource = {
      ...state.bySource,
      [input.source]: {
        totalCompanies: input.totalCompanies ?? state.bySource[input.source]?.totalCompanies ?? 0,
        processedCompanies:
          input.processedCompanies ?? state.bySource[input.source]?.processedCompanies ?? 0,
        totalJobs: input.totalJobs ?? state.bySource[input.source]?.totalJobs ?? 0,
        createdJobs: input.createdJobs ?? state.bySource[input.source]?.createdJobs ?? 0,
        failures: input.failures ?? state.bySource[input.source]?.failures ?? 0,
      },
    };
  }

  globalThis.__jobSyncProgress = next;
  return next;
}

export function markSourceProgress(source: string, patch: Partial<SyncProgressState["bySource"][string]>) {
  const state = getState();
  const current = state.bySource[source] || {
    totalCompanies: 0,
    processedCompanies: 0,
    totalJobs: 0,
    createdJobs: 0,
    failures: 0,
  };

  globalThis.__jobSyncProgress = {
    ...state,
    bySource: {
      ...state.bySource,
      [source]: {
        ...current,
        ...patch,
      },
    },
  };

  return globalThis.__jobSyncProgress;
}

export function getSyncProgress() {
  return getState();
}

export function finishSyncProgress() {
  const state = getState();
  globalThis.__jobSyncProgress = {
    ...state,
    running: false,
    finishedAt: new Date().toISOString(),
  };
  return globalThis.__jobSyncProgress;
}
