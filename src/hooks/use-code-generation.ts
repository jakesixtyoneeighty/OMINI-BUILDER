// ============================================================
// Omni-Builder — useCodeGeneration Hook
// ============================================================
'use client';

import { useCallback, useRef } from 'react';
import { useChatStore, useProjectStore, useAIProviderStore } from '@/store';
import { parseCodeFromResponse } from '@/services/code-parser';

export function useCodeGeneration() {
  const abortRef = useRef<AbortController | null>(null);

  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setIsGenerating = useChatStore((s) => s.setIsGenerating);
  const messages = useChatStore((s) => s.messages);
  const applyArtifacts = useProjectStore((s) => s.applyArtifacts);
  const projectFiles = useProjectStore((s) => s.project.files);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const providerConfig = useAIProviderStore((s) => s.config);

  const generate = useCallback(
    async (prompt: string) => {
      // Cancel any previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      // Add user message
      addMessage({ role: 'user', content: prompt });

      // Add assistant placeholder
      const assistantId = addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      setIsGenerating(true);
      let fullContent = '';

      try {
        // Build conversation history for context
        const history = messages
          .filter((m) => m.role !== 'system')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            files: projectFiles,
            history,
            providerConfig: {
              provider: providerConfig.provider,
              apiKey: providerConfig.apiKey,
              model: providerConfig.model,
            },
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Generation failed: ${response.status}`);
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                if (parsed.error) {
                  fullContent += `\n\n**Error:** ${parsed.error}`;
                } else if (parsed.content) {
                  fullContent += parsed.content;
                  updateMessage(assistantId, { content: fullContent });
                }
              } catch {
                // Skip unparseable chunks
              }
            }
          }
        }

        // Parse the response to extract file artifacts
        const { message, artifacts } = parseCodeFromResponse(fullContent);

        // Apply artifacts to the project
        if (artifacts.length > 0) {
          applyArtifacts(artifacts);
          updateMessage(assistantId, {
            content: message || 'Generated successfully!',
            artifacts,
            isStreaming: false,
          });

          // Auto-detect project name
          const appFile = artifacts.find(
            (a) => a.path === 'src/App.tsx' || a.path === 'index.html'
          );
          if (appFile && appFile.content.includes('<title>')) {
            const titleMatch = appFile.content.match(/<title>(.*?)<\/title>/);
            if (titleMatch) {
              setProjectName(titleMatch[1]);
            }
          }
        } else {
          updateMessage(assistantId, {
            content: fullContent,
            isStreaming: false,
          });
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          updateMessage(assistantId, {
            content: `**Error:** ${error.message || 'Failed to generate code'}`,
            isStreaming: false,
          });
        }
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [addMessage, updateMessage, setIsGenerating, messages, projectFiles, applyArtifacts, setProjectName, providerConfig]
  );

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  return { generate, stopGeneration };
}
