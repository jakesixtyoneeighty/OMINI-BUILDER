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
        // WebContainer auth flow:
        // The StackBlitz OAuth is ONLY needed to access private npm packages.
        // Most users don't need this, so we skip the auth flow entirely
        // to avoid forcing a StackBlitz login redirect on every page load.
        //
        // If you need private npm package access, set WEBCONTAINER_API
        // to a valid StackBlitz OAuth clientId and the scope below to
        // a valid scope (e.g. 'read'). Then uncomment the auth block.
        //
        // NOTE: The previous scope 'api' was invalid and caused
        // "invalid_scope" errors + unwanted login redirects.

        const enableAuth = import.meta.env.WEBCONTAINER_AUTH === 'true';
        const apiToken = import.meta.env.WEBCONTAINER_API as string | undefined;

        if (enableAuth && apiToken) {
          try {
            const { auth } = await import('@webcontainer/api');

            try {
              const result = auth.init({
                clientId: apiToken,
                scope: 'read',
              });

              if (result.status === 'need-auth') {
                console.log('[WebContainer] Starting StackBlitz auth flow (popup)...');
                auth.startAuthFlow({ popup: true });
                await auth.loggedIn();
                console.log('[WebContainer] Authenticated successfully');
              } else if (result.status === 'authorized') {
                console.log('[WebContainer] Already authorized');
              }
            } catch (authFlowError: any) {
              console.warn('[WebContainer] Auth flow failed (continuing without auth):', authFlowError?.message || authFlowError);
            }
          } catch (authError) {
            console.warn('[WebContainer] Auth initialization failed, continuing without auth:', authError);
          }
        } else {
          console.log('[WebContainer] Running without StackBlitz auth (set WEBCONTAINER_AUTH=true and WEBCONTAINER_API to enable)');
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
