import { atom, map } from 'nanostores';

export interface DetectedError {
  id: string;
  type: 'action' | 'preview' | 'runtime' | 'compile';
  source: string;
  message: string;
  details?: string;
  filePath?: string;
  timestamp: number;
  dismissed: boolean;
}

type ErrorsMap = MapStore<Record<string, DetectedError>>;

class ErrorStore {
  errors: ErrorsMap = map({});

  showErrors: typeof atom<boolean> = atom(true);

  addError(error: Omit<DetectedError, 'id' | 'timestamp' | 'dismissed'>) {
    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const errors = this.errors.get();

    // Avoid duplicate errors with same message + source within 10s
    const recent = Object.values(errors).find(
      (e) =>
        e.message === error.message &&
        e.source === error.source &&
        !e.dismissed &&
        Date.now() - e.timestamp < 10000,
    );

    if (recent) {
      return recent.id;
    }

    this.errors.setKey(id, {
      ...error,
      id,
      timestamp: Date.now(),
      dismissed: false,
    } satisfies DetectedError);

    return id;
  }

  dismissError(id: string) {
    const error = this.errors.get()[id];
    if (error) {
      this.errors.setKey(id, { ...error, dismissed: true });
    }
  }

  clearAll() {
    const errors = this.errors.get();
    for (const [id, error] of Object.entries(errors)) {
      this.errors.setKey(id, { ...error, dismissed: true });
    }
  }

  getActiveErrors(): DetectedError[] {
    return Object.values(this.errors.get())
      .filter((e) => !e.dismissed)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  toggleErrors() {
    this.showErrors.set(!this.showErrors.get());
  }
}

export const errorStore = new ErrorStore();
