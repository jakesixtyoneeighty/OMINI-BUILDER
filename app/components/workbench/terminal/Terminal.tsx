import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { registerTerminal, unregisterTerminal, touchTerminal } from '~/lib/performance';
import { getTerminalTheme } from './theme';

const logger = createScopedLogger('Terminal');

export interface TerminalRef {
  reloadStyles: () => void;
}

export interface TerminalProps {
  className?: string;
  theme: Theme;
  readonly?: boolean;
  onTerminalReady?: (terminal: XTerm) => void;
  onTerminalResize?: (cols: number, rows: number) => void;
  id?: number;
}

export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(({ className, theme, readonly, onTerminalReady, onTerminalResize, id = 0 }, ref) => {
    const terminalElementRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<XTerm>();
    const fitAddonRef = useRef<FitAddon>();
    const resizeObserverRef = useRef<ResizeObserver>();
    // Track whether the terminal DOM element is actually visible
    const [isVisible, setIsVisible] = useState(true);
    const isVisibleRef = useRef(true);

    // Observe visibility of the terminal container
    useEffect(() => {
      const el = terminalElementRef.current;
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          const visible = entry.isIntersecting && entry.intersectionRatio > 0;
          isVisibleRef.current = visible;
          setIsVisible(visible);
        },
        { threshold: 0 },
      );

      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Initialize terminal
    useEffect(() => {
      const element = terminalElementRef.current!;

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      const terminal = new XTerm({
        cursorBlink: true,
        convertEol: true,
        disableStdin: readonly,
        theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {}),
        fontSize: 12,
        fontFamily: 'Menlo, courier-new, courier, monospace',
        // Performance optimizations
        scrollback: 1000, // Limit scroll buffer (default is 1000, but let's be explicit)
        fastScrollModifier: 'shift',
        fastScrollSensitivity: 5,
        // Reduce rendering overhead
        allowTransparency: false,
        allowProposedApi: false,
      });

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(element);

      // Throttled fit to avoid excessive recalculations
      let fitTimeout: ReturnType<typeof setTimeout> | null = null;
      const throttledFit = () => {
        if (fitTimeout) return;
        fitTimeout = setTimeout(() => {
          fitTimeout = null;
          try {
            if (isVisibleRef.current) {
              fitAddon.fit();
            }
          } catch {}
        }, 100); // Throttle to max 10 fits/second
      };

      const resizeObserver = new ResizeObserver(() => {
        if (isVisibleRef.current) {
          throttledFit();
          onTerminalResize?.(terminal.cols, terminal.rows);
        }
      });

      resizeObserver.observe(element);
      resizeObserverRef.current = resizeObserver;

      // Register in performance pool for memory management
      registerTerminal(id, terminal, () => {
        try {
          resizeObserver.disconnect();
          webLinksAddon.dispose();
          fitAddon.dispose();
          terminal.dispose();
        } catch {}
      });

      logger.info('Attach terminal', id);

      onTerminalReady?.(terminal);

      return () => {
        unregisterTerminal(id);
        if (fitTimeout) clearTimeout(fitTimeout);
        resizeObserver.disconnect();
        terminal.dispose();
      };
    }, []);

    // Handle visibility changes — pause/resume rendering to save RAM
    useEffect(() => {
      const terminal = terminalRef.current;
      if (!terminal) return;

      if (isVisible) {
        // Terminal became visible — refresh and refit
        touchTerminal(id);
        try {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
          }
        } catch {}
      }
      // When not visible, xterm automatically reduces rendering
      // No need to manually handle — the IntersectionObserver handles reconnection
    }, [isVisible, id]);

    // Update theme and readonly state
    useEffect(() => {
      const terminal = terminalRef.current!;

      // we render a transparent cursor in case the terminal is readonly
      terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});

      terminal.options.disableStdin = readonly;
    }, [theme, readonly]);

    useImperativeHandle(ref, () => {
      return {
        reloadStyles: () => {
          const terminal = terminalRef.current!;
          terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
        },
      };
    }, []);

    return <div className={className} ref={terminalElementRef} />;
  }),
);
