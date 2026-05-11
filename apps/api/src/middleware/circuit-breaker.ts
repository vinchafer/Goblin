// Circuit breaker for external API calls.
// State: CLOSED (normal) → OPEN (failing, reject all) → HALF_OPEN (test) → CLOSED

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitConfig {
  failureThreshold: number;   // failures before opening
  resetTimeout: number;       // ms to wait before HALF_OPEN attempt
  successThreshold: number;   // successes in HALF_OPEN before CLOSED
}

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 3,
  resetTimeout: 5 * 60 * 1000,  // 5 minutes
  successThreshold: 1,
};

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitConfig = DEFAULT_CONFIG,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        throw new CircuitOpenError(this.name, Math.ceil((this.config.resetTimeout - elapsed) / 60000));
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'CLOSED';
      }
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF_OPEN' || this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`[Circuit Breaker] ${this.name} OPEN after ${this.failures} failures`);
    }
  }

  getState() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

export class CircuitOpenError extends Error {
  constructor(provider: string, minutesRemaining: number) {
    super(`${provider} is temporarily unavailable. Auto-fallback kicked in. Retry in ~${minutesRemaining}min.`);
    this.name = 'CircuitOpenError';
  }
}

// Global registry
const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, config?: CircuitConfig): CircuitBreaker {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name, config));
  }
  return breakers.get(name)!;
}

export function getAllCircuitStates() {
  return Array.from(breakers.values()).map(b => b.getState());
}
