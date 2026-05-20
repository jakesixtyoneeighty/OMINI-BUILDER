import { type MetaFunction } from '@remix-run/cloudflare';
import { useState } from 'react';
import { useT } from '~/lib/i18n/useT';
import { BrandAsset } from '~/components/ui/BrandAsset';

export const meta: MetaFunction = () => {
  return [
    { title: 'Documentacao — Omni-Builder' },
    {
      name: 'description',
      content:
        'Documentacao completa do Omni-Builder. Aprenda a criar apps com IA, configurar provedores, fazer deploy e mais.',
    },
  ];
};

/* ==============================
   Docs Sections Data
   ============================== */
interface DocSection {
  id: string;
  titleKey: string;
  icon: string;
  subsections: { id: string; titleKey: string }[];
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    titleKey: 'docs.gettingStarted',
    icon: 'i-ph:rocket-launch-duotone',
    subsections: [
      { id: 'what-is-omni', titleKey: 'docs.whatIsOmni' },
      { id: 'first-steps', titleKey: 'docs.firstSteps' },
      { id: 'creating-account', titleKey: 'docs.creatingAccount' },
    ],
  },
  {
    id: 'chat-ai',
    titleKey: 'docs.chatAI',
    icon: 'i-ph:chat-circle-dots-duotone',
    subsections: [
      { id: 'how-to-chat', titleKey: 'docs.howToChat' },
      { id: 'plan-mode', titleKey: 'docs.planMode' },
      { id: 'mention-files', titleKey: 'docs.mentionFiles' },
    ],
  },
  {
    id: 'providers',
    titleKey: 'docs.providers',
    icon: 'i-ph:plugs-connected-duotone',
    subsections: [
      { id: 'available-providers', titleKey: 'docs.availableProviders' },
      { id: 'configure-api-key', titleKey: 'docs.configureApiKey' },
      { id: 'supported-models', titleKey: 'docs.supportedModels' },
    ],
  },
  {
    id: 'projects',
    titleKey: 'docs.projects',
    icon: 'i-ph:folder-open-duotone',
    subsections: [
      { id: 'creating-project', titleKey: 'docs.creatingProject' },
      { id: 'importing-github', titleKey: 'docs.importingGithub' },
      { id: 'importing-zip', titleKey: 'docs.importingZip' },
      { id: 'saving-cloud', titleKey: 'docs.savingCloud' },
    ],
  },
  {
    id: 'editor',
    titleKey: 'docs.editorWorkbench',
    icon: 'i-ph:code-duotone',
    subsections: [
      { id: 'file-tree', titleKey: 'docs.fileTree' },
      { id: 'terminal', titleKey: 'docs.terminal' },
      { id: 'preview-modes', titleKey: 'docs.previewModes' },
      { id: 'error-fixing', titleKey: 'docs.errorFixing' },
    ],
  },
  {
    id: 'deploy',
    titleKey: 'docs.deploy',
    icon: 'i-ph:cloud-arrow-up-duotone',
    subsections: [
      { id: 'deploy-cloudflare', titleKey: 'docs.deployCloudflare' },
      { id: 'deploy-netlify', titleKey: 'docs.deployNetlify' },
      { id: 'deploy-vercel', titleKey: 'docs.deployVercel' },
      { id: 'deploy-ai', titleKey: 'docs.deployAI' },
    ],
  },
  {
    id: 'gallery',
    titleKey: 'docs.gallery',
    icon: 'i-ph:storefront-duotone',
    subsections: [
      { id: 'publishing-gallery', titleKey: 'docs.publishingGallery' },
      { id: 'exploring-gallery', titleKey: 'docs.exploringGallery' },
    ],
  },
  {
    id: 'tips',
    titleKey: 'docs.tipsTricks',
    icon: 'i-ph:lightbulb-duotone',
    subsections: [
      { id: 'best-practices', titleKey: 'docs.bestPractices' },
      { id: 'keyboard-shortcuts', titleKey: 'docs.keyboardShortcuts' },
      { id: 'faq', titleKey: 'docs.faq' },
    ],
  },
];

/* ==============================
   Section Content Renderers
   ============================== */

function GettingStartedContent({ activeSub }: { activeSub: string }) {
  const t = useT();
  if (activeSub === 'what-is-omni') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.whatIsOmni')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.whatIsOmniDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.whatIsOmniDesc2')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <FeatureCard
            icon="i-ph:chat-circle-dots-duotone"
            title={t('docs.featureChatTitle')}
            desc={t('docs.featureChatDesc')}
          />
          <FeatureCard
            icon="i-ph:code-duotone"
            title={t('docs.featureEditorTitle')}
            desc={t('docs.featureEditorDesc')}
          />
          <FeatureCard
            icon="i-ph:cloud-arrow-up-duotone"
            title={t('docs.featureDeployTitle')}
            desc={t('docs.featureDeployDesc')}
          />
          <FeatureCard
            icon="i-ph:storefront-duotone"
            title={t('docs.featureGalleryTitle')}
            desc={t('docs.featureGalleryDesc')}
          />
        </div>
      </div>
    );
  }
  if (activeSub === 'first-steps') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.firstSteps')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.firstStepsDesc')}</p>
        <ol className="space-y-4 mt-4">
          <StepCard step={1} title={t('docs.step1Title')} desc={t('docs.step1Desc')} />
          <StepCard step={2} title={t('docs.step2Title')} desc={t('docs.step2Desc')} />
          <StepCard step={3} title={t('docs.step3Title')} desc={t('docs.step3Desc')} />
          <StepCard step={4} title={t('docs.step4Title')} desc={t('docs.step4Desc')} />
        </ol>
      </div>
    );
  }
  if (activeSub === 'creating-account') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.creatingAccount')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.creatingAccountDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.creatingAccountDesc2')}</p>
        <div className="mt-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:info-duotone text-indigo-400 text-base" />
            <span className="text-sm font-medium text-indigo-300">{t('docs.important')}</span>
          </div>
          <p className="text-sm text-bolt-elements-textSecondary">{t('docs.accountLimitInfo')}</p>
        </div>
      </div>
    );
  }
  return null;
}

function ChatAIContent({ activeSub }: { activeSub: string }) {
  const t = useT();
  if (activeSub === 'how-to-chat') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.howToChat')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.howToChatDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.howToChatDesc2')}</p>
        <div className="mt-4 space-y-3">
          <TipCard icon="i-ph:paperclip-duotone" text={t('docs.chatTip1')} />
          <TipCard icon="i-ph:microphone-duotone" text={t('docs.chatTip2')} />
          <TipCard icon="i-ph:image-duotone" text={t('docs.chatTip3')} />
        </div>
      </div>
    );
  }
  if (activeSub === 'plan-mode') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.planMode')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.planModeDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.planModeDesc2')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <ModeCard
            icon="i-ph:compass-duotone"
            title={t('docs.planModeName')}
            desc={t('docs.planModeCardDesc')}
            color="indigo"
          />
          <ModeCard
            icon="i-ph:bolt-duotone"
            title={t('docs.buildModeName')}
            desc={t('docs.buildModeCardDesc')}
            color="amber"
          />
        </div>
      </div>
    );
  }
  if (activeSub === 'mention-files') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.mentionFiles')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.mentionFilesDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.mentionFilesDesc2')}</p>
        <div className="mt-4 p-4 rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor">
          <code className="text-sm text-indigo-300">{t('docs.mentionExample')}</code>
        </div>
      </div>
    );
  }
  return null;
}

function ProvidersContent({ activeSub }: { activeSub: string }) {
  const t = useT();
  if (activeSub === 'available-providers') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.availableProviders')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.availableProvidersDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <ProviderCard name="OpenAI" icon="i-ph:openai-logo" models="GPT-4o, GPT-4o-mini, o1, o3-mini" />
          <ProviderCard name="Anthropic" icon="i-ph:brain-duotone" models="Claude 4 Sonnet, Claude 3.5 Haiku" />
          <ProviderCard name="Google" icon="i-ph:google-logo" models="Gemini 2.5 Pro, Gemini 2.0 Flash" />
          <ProviderCard name="OpenRouter" icon="i-ph:shuffle-duotone" models="200+ modelos de varios provedores" />
          <ProviderCard name="Groq" icon="i-ph:lightning-duotone" models="Llama 3, Mixtral (ultra rapido)" />
          <ProviderCard name="Ollama" icon="i-ph:desktop-duotone" models="Modelos locais (Llama, Mistral, etc.)" />
        </div>
      </div>
    );
  }
  if (activeSub === 'configure-api-key') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.configureApiKey')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.configureApiKeyDesc1')}</p>
        <ol className="space-y-3 mt-4">
          <StepCard step={1} title={t('docs.apiStep1Title')} desc={t('docs.apiStep1Desc')} />
          <StepCard step={2} title={t('docs.apiStep2Title')} desc={t('docs.apiStep2Desc')} />
          <StepCard step={3} title={t('docs.apiStep3Title')} desc={t('docs.apiStep3Desc')} />
        </ol>
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:warning-duotone text-amber-400 text-base" />
            <span className="text-sm font-medium text-amber-300">{t('docs.security')}</span>
          </div>
          <p className="text-sm text-bolt-elements-textSecondary">{t('docs.apiSecurityInfo')}</p>
        </div>
      </div>
    );
  }
  if (activeSub === 'supported-models') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.supportedModels')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.supportedModelsDesc')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.supportedModelsDesc2')}</p>
        <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:sparkle-duotone text-emerald-400 text-base" />
            <span className="text-sm font-medium text-emerald-300">{t('docs.recommendation')}</span>
          </div>
          <p className="text-sm text-bolt-elements-textSecondary">{t('docs.modelRecommendation')}</p>
        </div>
      </div>
    );
  }
  return null;
}

function ProjectsContent({ activeSub }: { activeSub: string }) {
  const t = useT();
  if (activeSub === 'creating-project') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.creatingProject')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.creatingProjectDesc')}</p>
        <div className="mt-4 space-y-3">
          <TipCard icon="i-ph:text-aa-duotone" text={t('docs.projectTip1')} />
          <TipCard icon="i-ph:sliders-horizontal-duotone" text={t('docs.projectTip2')} />
          <TipCard icon="i-ph:target-duotone" text={t('docs.projectTip3')} />
        </div>
      </div>
    );
  }
  if (activeSub === 'importing-github') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.importingGithub')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.importingGithubDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.importingGithubDesc2')}</p>
        <ol className="space-y-3 mt-4">
          <StepCard step={1} title={t('docs.githubStep1Title')} desc={t('docs.githubStep1Desc')} />
          <StepCard step={2} title={t('docs.githubStep2Title')} desc={t('docs.githubStep2Desc')} />
          <StepCard step={3} title={t('docs.githubStep3Title')} desc={t('docs.githubStep3Desc')} />
        </ol>
      </div>
    );
  }
  if (activeSub === 'importing-zip') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.importingZip')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.importingZipDesc')}</p>
        <div className="mt-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:info-duotone text-indigo-400 text-base" />
            <span className="text-sm font-medium text-indigo-300">{t('docs.tip')}</span>
          </div>
          <p className="text-sm text-bolt-elements-textSecondary">{t('docs.zipTip')}</p>
        </div>
      </div>
    );
  }
  if (activeSub === 'saving-cloud') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.savingCloud')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.savingCloudDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.savingCloudDesc2')}</p>
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:warning-duotone text-amber-400 text-base" />
            <span className="text-sm font-medium text-amber-300">{t('docs.limit')}</span>
          </div>
          <p className="text-sm text-bolt-elements-textSecondary">{t('docs.tenProjectLimit')}</p>
        </div>
      </div>
    );
  }
  return null;
}

function EditorContent({ activeSub }: { activeSub: string }) {
  const t = useT();
  if (activeSub === 'file-tree') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.fileTree')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.fileTreeDesc')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.fileTreeDesc2')}</p>
      </div>
    );
  }
  if (activeSub === 'terminal') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.terminal')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.terminalDesc')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.terminalDesc2')}</p>
        <div className="mt-4 space-y-3">
          <TipCard icon="i-ph:terminal-duotone" text={t('docs.terminalTip1')} />
          <TipCard icon="i-ph:play-circle-duotone" text={t('docs.terminalTip2')} />
        </div>
      </div>
    );
  }
  if (activeSub === 'preview-modes') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.previewModes')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.previewModesDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <ModeCard icon="i-ph:globe-duotone" title="WebContainer" desc={t('docs.webcontainerDesc')} color="blue" />
          <ModeCard icon="i-ph:browser-duotone" title="Sandpack" desc={t('docs.sandpackDesc')} color="purple" />
          <ModeCard icon="i-ph:monitor-duotone" title="Iframe SrcDoc" desc={t('docs.iframeDesc')} color="green" />
          <ModeCard
            icon="i-ph:arrow-square-out-duotone"
            title={t('docs.newTabTitle')}
            desc={t('docs.newTabDesc')}
            color="orange"
          />
        </div>
      </div>
    );
  }
  if (activeSub === 'error-fixing') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.errorFixing')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.errorFixingDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.errorFixingDesc2')}</p>
        <div className="mt-4 space-y-3">
          <TipCard icon="i-ph:wrench-duotone" text={t('docs.errorTip1')} />
          <TipCard icon="i-ph:robot-duotone" text={t('docs.errorTip2')} />
          <TipCard icon="i-ph:arrows-counter-clockwise-duotone" text={t('docs.errorTip3')} />
        </div>
      </div>
    );
  }
  return null;
}

function DeployContent({ activeSub }: { activeSub: string }) {
  const t = useT();
  if (activeSub === 'deploy-cloudflare') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.deployCloudflare')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.deployCloudflareDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.deployCloudflareDesc2')}</p>
        <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:gift-duotone text-emerald-400 text-base" />
            <span className="text-sm font-medium text-emerald-300">{t('docs.free')}</span>
          </div>
          <p className="text-sm text-bolt-elements-textSecondary">{t('docs.cloudflareFreeInfo')}</p>
        </div>
      </div>
    );
  }
  if (activeSub === 'deploy-netlify') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.deployNetlify')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.deployNetlifyDesc')}</p>
        <ol className="space-y-3 mt-4">
          <StepCard step={1} title={t('docs.netlifyStep1Title')} desc={t('docs.netlifyStep1Desc')} />
          <StepCard step={2} title={t('docs.netlifyStep2Title')} desc={t('docs.netlifyStep2Desc')} />
          <StepCard step={3} title={t('docs.netlifyStep3Title')} desc={t('docs.netlifyStep3Desc')} />
        </ol>
      </div>
    );
  }
  if (activeSub === 'deploy-vercel') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.deployVercel')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.deployVercelDesc')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.deployVercelDesc2')}</p>
      </div>
    );
  }
  if (activeSub === 'deploy-ai') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.deployAI')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.deployAIDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.deployAIDesc2')}</p>
        <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:sparkle-duotone text-purple-400 text-base" />
            <span className="text-sm font-medium text-purple-300">{t('docs.aiMagic')}</span>
          </div>
          <p className="text-sm text-bolt-elements-textSecondary">{t('docs.deployAIMagic')}</p>
        </div>
      </div>
    );
  }
  return null;
}

function GalleryContent({ activeSub }: { activeSub: string }) {
  const t = useT();
  if (activeSub === 'publishing-gallery') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.publishingGallery')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.publishingGalleryDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.publishingGalleryDesc2')}</p>
      </div>
    );
  }
  if (activeSub === 'exploring-gallery') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.exploringGallery')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.exploringGalleryDesc1')}</p>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.exploringGalleryDesc2')}</p>
      </div>
    );
  }
  return null;
}

function TipsContent({ activeSub }: { activeSub: string }) {
  const t = useT();
  if (activeSub === 'best-practices') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.bestPractices')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.bestPracticesDesc')}</p>
        <div className="mt-4 space-y-3">
          <TipCard icon="i-ph:text-aa-duotone" text={t('docs.bp1')} />
          <TipCard icon="i-ph:list-dashes-duotone" text={t('docs.bp2')} />
          <TipCard icon="i-ph:magnifying-glass-duotone" text={t('docs.bp3')} />
          <TipCard icon="i-ph:arrows-clockwise-duotone" text={t('docs.bp4')} />
          <TipCard icon="i-ph:note-duotone" text={t('docs.bp5')} />
        </div>
      </div>
    );
  }
  if (activeSub === 'keyboard-shortcuts') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.keyboardShortcuts')}</h2>
        <p className="text-bolt-elements-textSecondary leading-relaxed">{t('docs.keyboardShortcutsDesc')}</p>
        <div className="mt-4 space-y-2">
          <ShortcutRow keys="Ctrl+K" action={t('docs.shortcutSearch')} />
          <ShortcutRow keys="Ctrl+S" action={t('docs.shortcutSave')} />
          <ShortcutRow keys="Ctrl+Z" action={t('docs.shortcutUndo')} />
          <ShortcutRow keys="Ctrl+B" action={t('docs.shortcutToggleSidebar')} />
        </div>
      </div>
    );
  }
  if (activeSub === 'faq') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{t('docs.faq')}</h2>
        <div className="mt-4 space-y-4">
          <FaqItem question={t('docs.faq1Q')} answer={t('docs.faq1A')} />
          <FaqItem question={t('docs.faq2Q')} answer={t('docs.faq2A')} />
          <FaqItem question={t('docs.faq3Q')} answer={t('docs.faq3A')} />
          <FaqItem question={t('docs.faq4Q')} answer={t('docs.faq4A')} />
          <FaqItem question={t('docs.faq5Q')} answer={t('docs.faq5A')} />
        </div>
      </div>
    );
  }
  return null;
}

/* ==============================
   Reusable UI Components
   ============================== */

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="p-4 rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor hover:border-indigo-500/30 transition-all">
      <div className={`${icon} text-2xl text-indigo-400 mb-3`} />
      <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-1">{title}</h3>
      <p className="text-xs text-bolt-elements-textTertiary leading-relaxed">{desc}</p>
    </div>
  );
}

function StepCard({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-bold shrink-0 mt-0.5">
        {step}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">{title}</h3>
        <p className="text-sm text-bolt-elements-textSecondary leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function TipCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor">
      <div className={`${icon} text-base text-indigo-400 shrink-0 mt-0.5`} />
      <p className="text-sm text-bolt-elements-textSecondary leading-relaxed">{text}</p>
    </div>
  );
}

function ModeCard({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    orange: 'text-orange-400',
  };
  return (
    <div className="p-4 rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor">
      <div className={`${icon} text-2xl ${colorMap[color] || 'text-indigo-400'} mb-3`} />
      <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-1">{title}</h3>
      <p className="text-xs text-bolt-elements-textTertiary leading-relaxed">{desc}</p>
    </div>
  );
}

function ProviderCard({ name, icon, models }: { name: string; icon: string; models: string }) {
  return (
    <div className="p-4 rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor hover:border-indigo-500/30 transition-all">
      <div className="flex items-center gap-2 mb-2">
        <div className={`${icon} text-lg text-indigo-400`} />
        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">{name}</h3>
      </div>
      <p className="text-xs text-bolt-elements-textTertiary leading-relaxed">{models}</p>
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor">
      <span className="text-sm text-bolt-elements-textSecondary">{action}</span>
      <kbd className="px-2.5 py-1 rounded-lg bg-bolt-elements-bg-depth-1 border border-bolt-elements-borderColor text-xs font-mono text-bolt-elements-textTertiary">
        {keys}
      </kbd>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-medium text-bolt-elements-textPrimary">{question}</span>
        <div
          className={`i-ph:caret-down text-sm text-bolt-elements-textTertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-3">
          <p className="text-sm text-bolt-elements-textSecondary leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

/* ==============================
   Section Content Router
   ============================== */

function SectionContent({ sectionId, activeSub }: { sectionId: string; activeSub: string }) {
  switch (sectionId) {
    case 'getting-started':
      return <GettingStartedContent activeSub={activeSub} />;
    case 'chat-ai':
      return <ChatAIContent activeSub={activeSub} />;
    case 'providers':
      return <ProvidersContent activeSub={activeSub} />;
    case 'projects':
      return <ProjectsContent activeSub={activeSub} />;
    case 'editor':
      return <EditorContent activeSub={activeSub} />;
    case 'deploy':
      return <DeployContent activeSub={activeSub} />;
    case 'gallery':
      return <GalleryContent activeSub={activeSub} />;
    case 'tips':
      return <TipsContent activeSub={activeSub} />;
    default:
      return null;
  }
}

/* ==============================
   Main Docs Page
   ============================== */

export default function DocsPage() {
  const t = useT();
  const [activeSection, setActiveSection] = useState('getting-started');
  const [activeSub, setActiveSub] = useState('what-is-omni');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSubClick = (sectionId: string, subId: string) => {
    setActiveSection(sectionId);
    setActiveSub(subId);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-bolt-elements-bg-depth-1 text-bolt-elements-textPrimary">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-bolt-elements-bg-depth-1/70 border-b border-bolt-elements-borderColor">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
            >
              <div className="i-ph:arrow-left text-lg" />
            </a>
            <a href="/" className="flex items-center">
              <BrandAsset src="/omini-logo.html" title="Omini" className="h-10 w-[180px] max-w-full omni-logo-themed" />
            </a>
            <div className="hidden sm:block w-px h-5 bg-bolt-elements-borderColor" />
            <span className="hidden sm:flex items-center gap-2 text-sm font-semibold text-bolt-elements-textPrimary">
              <div className="i-ph:book-open-text-duotone text-indigo-400" />
              {t('docs.documentation')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all"
            >
              <div className="i-ph:list text-base" />
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <div className="i-ph:plus-circle text-base" />
              {t('docs.createNewProject')}
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto flex">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`
          fixed lg:sticky top-16 z-40 lg:z-0
          w-[280px] h-[calc(100vh-4rem)]
          bg-bolt-elements-bg-depth-2 border-r border-bolt-elements-borderColor
          overflow-y-auto
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        >
          <div className="p-4">
            {/* Search (placeholder) */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor mb-4">
              <div className="i-ph:magnifying-glass text-sm text-bolt-elements-textTertiary" />
              <span className="text-sm text-bolt-elements-textTertiary">{t('docs.searchDocs')}</span>
            </div>

            {/* Nav sections */}
            {DOC_SECTIONS.map((section) => (
              <div key={section.id} className="mb-3">
                <button
                  onClick={() => {
                    setActiveSection(section.id);
                    setActiveSub(section.subsections[0].id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeSection === section.id
                      ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                      : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-bg-depth-3'
                  }`}
                >
                  <div
                    className={`${section.icon} text-base ${activeSection === section.id ? 'text-indigo-400' : 'text-bolt-elements-textTertiary'}`}
                  />
                  {t(section.titleKey)}
                </button>

                {/* Sub-items */}
                {activeSection === section.id && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-bolt-elements-borderColor pl-3">
                    {section.subsections.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => handleSubClick(section.id, sub.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                          activeSub === sub.id
                            ? 'text-indigo-300 bg-indigo-500/10 font-medium'
                            : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-bg-depth-3'
                        }`}
                      >
                        {t(sub.titleKey)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 sm:px-10 py-8 lg:px-16">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-bolt-elements-textTertiary mb-8">
            <a href="/" className="hover:text-bolt-elements-textSecondary transition-colors">
              Omni Builder
            </a>
            <div className="i-ph:caret-right text-[10px]" />
            <span className="text-bolt-elements-textSecondary">{t('docs.documentation')}</span>
            <div className="i-ph:caret-right text-[10px]" />
            <span className="text-indigo-400">
              {t(DOC_SECTIONS.find((s) => s.id === activeSection)?.titleKey || '')}
            </span>
          </div>

          {/* Content */}
          <div className="max-w-3xl">
            <SectionContent sectionId={activeSection} activeSub={activeSub} />
          </div>

          {/* Navigation between sections */}
          <div className="max-w-3xl mt-12 pt-6 border-t border-bolt-elements-borderColor flex items-center justify-between">
            {(() => {
              const allSubs = DOC_SECTIONS.flatMap((s) => s.subsections.map((sub) => ({ sectionId: s.id, ...sub })));
              const currentIdx = allSubs.findIndex((s) => s.id === activeSub);
              const prev = currentIdx > 0 ? allSubs[currentIdx - 1] : null;
              const next = currentIdx < allSubs.length - 1 ? allSubs[currentIdx + 1] : null;
              return (
                <>
                  {prev ? (
                    <button
                      onClick={() => handleSubClick(prev.sectionId, prev.id)}
                      className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      <div className="i-ph:caret-left text-base" />
                      {t(prev.titleKey)}
                    </button>
                  ) : (
                    <div />
                  )}
                  {next ? (
                    <button
                      onClick={() => handleSubClick(next.sectionId, next.id)}
                      className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      {t(next.titleKey)}
                      <div className="i-ph:caret-right text-base" />
                    </button>
                  ) : (
                    <div />
                  )}
                </>
              );
            })()}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-bolt-elements-borderColor mt-16">
        <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-bolt-elements-textTertiary">
          <div className="flex items-center gap-3">
            <span>Omni-Builder Docs</span>
            <span className="text-bolt-elements-textTertiary">&middot;</span>
            <span>{t('docs.madeWithAI')}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/docs" className="hover:text-bolt-elements-textSecondary transition-colors">
              {t('docs.documentation')}
            </a>
            <a href="/gallery" className="hover:text-bolt-elements-textSecondary transition-colors">
              {t('docs.gallery')}
            </a>
            <a href="/" className="hover:text-bolt-elements-textSecondary transition-colors">
              {t('docs.editor')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
