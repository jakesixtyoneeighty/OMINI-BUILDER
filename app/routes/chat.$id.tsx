import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { Menu } from '~/components/sidebar/Menu.client';

export const meta: MetaFunction = () => {
  return [{ title: 'Omni-Builder' }, { name: 'description', content: 'Omni-Builder: AI-powered web app builder' }];
};

export async function loader(args: LoaderFunctionArgs) {
  return json({ id: args.params.id });
}

export default function ChatRoute() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <ClientOnly>{() => <Menu />}</ClientOnly>
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <Header />
        <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      </div>
    </div>
  );
}
