<div align="center">

<img src="public/logo.svg" alt="Omni-Builder Logo" width="60" height="60" />

# Guia de Contribuição — Omni-Builder

**Desenvolvido por [Pedro Berbis Freire](https://github.com/Pedro21062014)** com assistência de IA da [Z.ai](https://z.ai)

**Baseado no projeto open-source [Bolt.new](https://github.com/stackblitz/bolt.new) por [StackBlitz](https://stackblitz.com/)**

</div>

---

## Bem-vindo ao Omni-Builder! 🎉

Obrigado pelo seu interesse em contribuir com o **Omni-Builder**! Este guia contém tudo o que você precisa saber para começar a contribuir com o projeto.

**Acesse online:** [https://opensouce-app-builder--omini-builder.pages.dev](https://opensouce-app-builder--omini-builder.pages.dev/)

## Visão Geral

O Omni-Builder é um construtor de aplicações web com IA, baseado no código open-source do **[Bolt.new](https://github.com/stackblitz/bolt.new)** criado pela **StackBlitz**. O projeto foi significativamente expandido com novas funcionalidades como múltiplos modos de preview, deploy para GitHub/Netlify, persistência de arquivos, e importação de projetos. Utilizamos [WebContainers](https://webcontainers.io/) da StackBlitz, [Sandpack](https://sandpack.codesandbox.io/) da CodeSandbox, e [Remix](https://remix.run/) para criar uma experiência de desenvolvimento completa no navegador.

### Por que contribuir?

- Construa ferramentas de **desenvolvimento com IA** de ponta
- Trabalhe com tecnologias como WebContainers, Remix, e AI SDK
- Faça parte de uma comunidade open-source em crescimento
- Aprenda e contribua com o ecossistema JavaScript moderno

## Como Contribuir

### 1. Faça um Fork do Repositório

```bash
git clone https://github.com/Pedro21062014/Opensouce-App-builder.-Omini-builder..git
cd Opensouce-App-builder.-Omini-builder.
git checkout -b minha-feature
```

### 2. Instale as Dependências

```bash
pnpm install
```

### 3. Configure o Ambiente

Crie um arquivo `.env.local` na raiz:

```
ANTHROPIC_API_KEY=sua_chave_aqui
```

### 4. Desenvolva

```bash
pnpm run dev
```

### 5. Teste suas Alterações

```bash
# Rodar testes
pnpm test

# Verificação de tipos
pnpm run typecheck

# Build de produção
pnpm run build
```

### 6. Envie um Pull Request

Faça push do seu branch e abra um Pull Request no repositório original descrevendo suas alterações.

## Padrões de Código

### Estrutura do Projeto

```
app/
├── components/
│   ├── chat/          # Componentes do chat e mensagens
│   ├── editor/        # Editor de código (CodeMirror)
│   ├── header/        # Header, configurações, auth
│   ├── sidebar/       # Menu lateral, histórico
│   ├── ui/            # Componentes de UI reutilizáveis
│   └── workbench/     # Preview, FileTree, Terminal
├── lib/
│   ├── runtime/       # Parser de mensagens, Action Runner
│   ├── stores/        # Nanostores (estado global)
│   ├── persistence/   # Supabase, histórico de chat
│   └── webcontainer/  # Integração com WebContainer API
├── routes/            # Rotas da API e páginas
├── styles/            # SCSS global
└── utils/             # Utilitários gerais
```

### Convenções

- **Componentes React**: Use arrow functions com `memo` para performance
- **Stores**: Use Nanostores para estado global
- **Estilos**: Use UnoCSS classes + Tailwind CSS
- **Imports**: Imports absolutos com `~/` path alias
- **Tipagem**: TypeScript strict mode
- **Nomenclatura**: PascalCase para componentes, camelCase para funções/variáveis

### Exemplo de Componente

```tsx
import { memo } from 'react';
import { useStore } from '@nanostores/react';

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export const MyComponent = memo(function MyComponent({ title, onAction }: MyComponentProps) {
  // Hook de store
  // Lógica do componente
  // JSX retornado
});
```

## Áreas para Contribuição

### Alta Prioridade
- 🐛 Correção de bugs
- 🌐 Internacionalização (i18n)
- 📱 Melhorias de responsividade mobile

### Média Prioridade
- ✨ Novos templates de projeto (Svelte, Angular, etc.)
- 🎨 Temas personalizáveis
- 📊 Dashboard de uso e estatísticas

### Ideias para o Futuro
- 🔌 Plugin system para extensões
- 🤝 Colaboração em tempo real (multiplayer)
- 🔄 Integração com Git (branch, merge, diff)
- 📦 Marketplace de templates e componentes

## Reportando Bugs

Ao reportar um bug, por favor inclua:

1. **Descrição clara** do problema
2. **Passos para reproduzir** o bug
3. **Comportamento esperado** vs comportamento atual
4. **Capturas de tela** ou vídeos quando possível
5. **Ambiente**: navegador, sistema operacional, versão do Node.js
6. **Logs do console** relevantes

## Solicitando Funcionalidades

Use o template de [Feature Request](../../issues/new?template=feature_request.md) ao abrir uma issue. Inclua:

1. **Problema**: que problema essa funcionalidade resolve?
2. **Solução proposta**: como você imagina que funcionaria?
3. **Alternativas**: outras abordagens que você considerou

## Processo de Release

1. Branch `main` sempre estável
2. Novas funcionalidades vão para branches `feature/`
3. Bug fixes vão para branches `fix/`
4. Antes do merge, passe por `pnpm run typecheck` e `pnpm run test`

## Licença

Ao contribuir, você concorda que seu código será licenciado sob a **licença MIT** do projeto.

---

<div align="center">

**Omni-Builder** — Feito com 💜 por [Pedro Berbis Freire](https://github.com/Pedro21062014) + [Z.ai](https://z.ai) | Baseado no [Bolt.new](https://github.com/stackblitz/bolt.new) da StackBlitz

Se você gostou do projeto, considere dar uma ⭐ no repositório!

</div>
