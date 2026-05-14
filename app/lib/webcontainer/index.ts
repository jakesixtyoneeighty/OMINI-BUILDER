import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(async () => {
        // Read the WebContainer API key (StackBlitz OAuth clientId) from environment variable
        // This is configured via WEBCONTAINER_API in .env or Cloudflare Pages env vars
        const apiToken = import.meta.env.WEBCONTAINER_API as string | undefined;

        if (apiToken) {
          try {
            const { auth } = await import('@webcontainer/api');

            // Initialize auth with the provided API key as clientId
            // Note: We try auth first, but if it fails (e.g. invalid_scope),
            // we continue without auth — the WebContainer still works, just
            // without access to private npm packages.
            try {
              const result = auth.init({
                clientId: apiToken,
                scope: 'api',
              });

              if (result.status === 'need-auth') {
                console.log('[WebContainer] API key configured, starting auth flow...');

                // Start the OAuth flow (redirects to StackBlitz for authorization)
                auth.startAuthFlow({ popup: false });

                // Wait for the user to authorize
                await auth.loggedIn();
                console.log('[WebContainer] Authenticated successfully');
              } else if (result.status === 'authorized') {
                console.log('[WebContainer] Already authorized with API key');
              }
            } catch (authFlowError: any) {
              // Auth flow can fail with "invalid_scope" if the API token
              // is not a valid StackBlitz OAuth clientId. That's OK — we
              // just continue without auth.
              console.warn('[WebContainer] Auth flow failed (continuing without auth):', authFlowError?.message || authFlowError);
            }
          } catch (authError) {
            console.warn('[WebContainer] Auth initialization failed, continuing without auth:', authError);
          }
        } else {
          console.log('[WebContainer] No WEBCONTAINER_API key set, running without authentication');
        }

        return WebContainer.boot({
          workdirName: WORK_DIR_NAME,
        });
      })
      .then((webcontainer) => {
        webcontainerContext.loaded = true;
        return webcontainer;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}
