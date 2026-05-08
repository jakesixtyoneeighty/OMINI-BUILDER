import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { DeployViewer } from '~/components/viewer/DeployViewer.client';

export const meta: MetaFunction = ({ params }) => {
  return [
    { title: 'Omni-Builder — Deploy Preview' },
    { name: 'description', content: 'Live preview of deployed project' },
  ];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const deployId = params.id;

  if (!deployId) {
    throw new Response('Missing deploy ID', { status: 400 });
  }

  // We pass the deploy ID to the client, which will fetch the data itself
  // This keeps the server loader lightweight and avoids duplicating DB logic
  return json({
    deployId,
    origin: typeof window !== 'undefined' ? window.location.origin : '',
  });
}

export default function ViewDeploy() {
  const { deployId } = useLoaderData<typeof loader>();

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden">
      <ClientOnly
        fallback={
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-center">
              <div className="i-svg-spinners:90-ring-with-bg text-4xl text-teal-400 mx-auto mb-4" />
              <p className="text-sm text-gray-400">Loading project...</p>
            </div>
          </div>
        }
      >
        {() => <DeployViewer deployId={deployId} />}
      </ClientOnly>
    </div>
  );
}
