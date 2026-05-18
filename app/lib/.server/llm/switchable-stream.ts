export default class SwitchableStream extends TransformStream {
  private _controller: TransformStreamDefaultController | null = null;
  private _currentReader: ReadableStreamDefaultReader | null = null;
  private _switches = 0;
  private _idleTimer: ReturnType<typeof setTimeout> | null = null;
  private _idleTimeoutMs: number;
  private _receivedFirstChunk = false;

  /**
   * @param idleTimeoutMs If no chunk is received within this time (ms),
   * the stream is force-closed. Default: 120s. Set to 0 to disable.
   * The timer only starts AFTER the first chunk is received, so slow
   * model start-up won't trigger a premature close.
   */
  constructor(idleTimeoutMs = 120_000) {
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

  async switchSource(newStream: ReadableStream) {
    if (this._currentReader) {
      await this._currentReader.cancel();
    }

    // Reset first-chunk flag for new source
    this._receivedFirstChunk = false;

    this._currentReader = newStream.getReader();

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

        // Reset idle timer on each chunk received
        this._resetIdleTimer();

        this._controller.enqueue(value);
      }
    } catch (error) {
      console.log(error);
      this._controller.error(error);
    } finally {
      // Clear idle timer when pump ends
      if (this._idleTimer) {
        clearTimeout(this._idleTimer);
        this._idleTimer = null;
      }
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

    if (this._currentReader) {
      this._currentReader.cancel();
    }

    this._controller?.terminate();
  }

  get switches() {
    return this._switches;
  }
}
