export default class SwitchableStream extends TransformStream {
  private _controller: TransformStreamDefaultController | null = null;
  private _currentReader: ReadableStreamDefaultReader | null = null;
  private _switches = 0;
  private _idleTimer: ReturnType<typeof setTimeout> | null = null;
  private _idleTimeoutMs: number;
  private _initialTimer: ReturnType<typeof setTimeout> | null = null;
  private _initialTimeoutMs: number;
  private _receivedFirstChunk = false;

  /**
   * @param idleTimeoutMs If no chunk is received within this time (ms),
   * the stream is force-closed. Default: 120s. Set to 0 to disable.
   * The timer only starts AFTER the first chunk is received, so slow
   * model start-up won't trigger a premature close.
   * @param initialTimeoutMs If no chunk is received within this time (ms)
   * after the FIRST source is switched, the stream is force-closed.
   * Default: 60s. This prevents indefinite hanging when the API never responds.
   * Set to 0 to disable.
   */
  constructor(idleTimeoutMs = 120_000, initialTimeoutMs = 60_000) {
    let controllerRef: TransformStreamDefaultController | undefined;

    super({
      start(controller) {
        controllerRef = controller;
      },
    });

    if (controllerRef === undefined) {
      throw new Error('Controller not properly initialized');
    }

    this._controller = controllerRef;
    this._idleTimeoutMs = idleTimeoutMs;
    this._initialTimeoutMs = initialTimeoutMs;
  }

  private _resetIdleTimer() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
    }
    // Only start the idle timer after we've received at least one chunk
    // This prevents premature close during slow model start-up
    if (this._idleTimeoutMs > 0 && this._receivedFirstChunk) {
      this._idleTimer = setTimeout(() => {
        console.warn(`[SwitchableStream] No data received for ${this._idleTimeoutMs / 1000}s, force-closing stream`);
        this.close();
      }, this._idleTimeoutMs);
    }
  }

  private _startInitialTimer() {
    if (this._initialTimer) {
      clearTimeout(this._initialTimer);
    }
    // Start the initial connection timer — if no data is received within this time,
    // force-close the stream to prevent indefinite hanging
    if (this._initialTimeoutMs > 0 && !this._receivedFirstChunk) {
      this._initialTimer = setTimeout(() => {
        console.warn(`[SwitchableStream] No initial data received for ${this._initialTimeoutMs / 1000}s, force-closing stream`);
        // Inject an error message into the stream before closing
        if (this._controller) {
          const errorMsg = JSON.stringify({ error: 'O modelo demorou demais para comecar a responder. Tente novamente ou escolha outro modelo.' });
          this._controller.enqueue(new TextEncoder().encode(errorMsg + '\n'));
        }
        this.close();
      }, this._initialTimeoutMs);
    }
  }

  private _clearInitialTimer() {
    if (this._initialTimer) {
      clearTimeout(this._initialTimer);
      this._initialTimer = null;
    }
  }

  async switchSource(newStream: ReadableStream) {
    if (this._currentReader) {
      await this._currentReader.cancel();
    }

    // Reset first-chunk flag for new source
    this._receivedFirstChunk = false;

    this._currentReader = newStream.getReader();

    // Start initial connection timer (will be cleared when first chunk arrives)
    this._startInitialTimer();

    this._pumpStream();

    this._switches++;
  }

  private async _pumpStream() {
    if (!this._currentReader || !this._controller) {
      throw new Error('Stream is not properly initialized');
    }

    try {
      while (true) {
        const { done, value } = await this._currentReader.read();

        if (done) {
          break;
        }

        // Mark that we've received at least one chunk
        this._receivedFirstChunk = true;

        // Clear the initial connection timer on first data
        this._clearInitialTimer();

        // Reset idle timer on each chunk received
        this._resetIdleTimer();

        this._controller.enqueue(value);
      }
    } catch (error) {
      console.log(error);
      this._controller.error(error);
    } finally {
      // Clear idle timer and initial timer when pump ends
      if (this._idleTimer) {
        clearTimeout(this._idleTimer);
        this._idleTimer = null;
      }
      this._clearInitialTimer();
    }
  }

  appendData(data: string) {
    if (this._controller) {
      this._controller.enqueue(new TextEncoder().encode(data));
    }
  }

  close() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    this._clearInitialTimer();

    if (this._currentReader) {
      this._currentReader.cancel();
    }

    this._controller?.terminate();
  }

  get switches() {
    return this._switches;
  }
}
