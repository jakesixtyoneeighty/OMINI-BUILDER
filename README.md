<div align="center">

<img src="public/logo.svg" alt="Omni-Builder Logo" width="80" height="80" />

# Omni-Builder

### AI-Powered Full-Stack Web App Builder

**Desenvolvido por [Pedro Berbis Freire](https://github.com/Pedro21062014)** com assistência de IA da [Z.ai](https://z.ai)

**Baseado no projeto open-source [Bolt.new](https://github.com/stackblitz/bolt.new) por [StackBlitz](https://stackblitz.com/)**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Remix](https://img.shields.io/badge/Remix-2.x-blue.svg)](https://remix.run/)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare_Pages-orange.svg)](https://pages.cloudflare.com/)
[![WebContainers](https://img.shields.io/badge/WebContainers-StackBlitz-green.svg)](https://webcontainers.io/)

**Acesse agora:** [https://opensouce-app-builder--omini-builder.pages.dev](https://opensouce-app-builder--omini-builder.pages.dev/)

</div>

---

## Sobre o Omni-Builder

O **Omni-Builder** é uma ferramenta open-source de desenvolvimento web com IA que permite criar, editar, executar e fazer deploy de aplicações full-stack diretamente no navegador — sem necessidade de configuração local. O projeto nasceu como um **fork expandido do [Bolt.new](https://github.com/stackblitz/bolt.new)**, o famoso AI web app builder open-source criado pela **StackBlitz**. O Omni-Builder mantém toda a base do Bolt.new e adiciona novas funcionalidades como múltiplos modos de preview, integração com GitHub/Netlify, persistência de arquivos, importação de projetos e muito mais.

## Funcionalidades

### Desenvolvimento com IA
- Chat inteligente com múltiplos modelos de IA (Claude, Gemini, OpenAI, etc.)
- Geração de código completa com criação automática de arquivos
- Edição e refatoração assistida por IA
- Enhance prompt — otimize suas instruções antes de enviar

### 6 Modos de Preview
| Modo | Descrição |
|------|-----------|
| **WebContainer** | Preview completo com servidor, terminal e hot reload |
| **Sandpack** | Preview rápido no navegador com React, Vue e HTML (Vite) |
| **Iframe SrcDoc** | Preview leve via iframe com suporte a React/JSX |
| **React Live** | Preview interativo com renderização ao vivo via react-live |
| **PlayCode** | Preview em iframe auto-contido, funciona offline |
| **New Tab** | Abre o preview em uma nova aba do navegador |

### Importação de Projetos
- Importar repositórios do **GitHub** diretamente
- Importar arquivos **ZIP**
- Importar **pastas locais** do computador
- Persistência de arquivos no **localStorage** (sobrevive a reloads de página)

### Deploy
- **GitHub**: Push direto com opção de repositório público ou privado
- **Netlify**: Deploy com um clique usando token de API
- Atualização de repositórios existentes no GitHub

### Interface
- Editor de código com **CodeMirror** (syntax highlighting, autocomplete)
- Terminal integrado com suporte a Node.js
- Gerenciador de arquivos visual (File Tree)
- Sistema de temas (claro/escuro)
- Configurações de projeto (variáveis de ambiente, preview, snapshots)

## Arquitetura

O Omni-Builder é construído com tecnologias modernas:

- **Frontend**: [Remix](https://remix.run/) + [React](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Sandbox**: [WebContainers](https://webcontainers.io/) (StackBlitz) + [Sandpack](https://sandpack.codesandbox.io/) (CodeSandbox)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/) com suporte a múltiplos provedores
- **Deploy**: [Cloudflare Pages](https://pages.cloudflare.com/) + [Workers](https://workers.cloudflare.com/)
- **Estado**: [Nanostores](https://nanostores.githhub.io/) para gerenciamento de estado reativo
- **Editor**: [CodeMirror 6](https://codemirror.net/)
- **Styling**: [UnoCSS](https://unocss.dev/) + [Framer Motion](https://www.framer.com/motion/)

## Diferença entre Omni-Builder e Bolt.new

| | **Omni-Builder** | **Bolt.new** |
|---|---|---|
| Preview modes | 6 modos (WebContainer, Sandpack, Iframe, React Live, PlayCode, New Tab) | 1 modo (WebContainer) |
| Importação | GitHub, ZIP, Pasta local | Apenas prompt |
| GitHub | Push/pull com público/privado | Não integrado |
| Netlify | Deploy com 1 clique | Não integrado |
| Persistência | localStorage (arquivos sobrevivem reload) | Não |
| Multi-modelo IA | Claude, Gemini, OpenAI, etc. | Claude apenas |
| Error Boundary | Tela de erro com botão voltar | Padrão Remix |
| Open Source | MIT (com modificações) | MIT |

## Primeiros Passos

### Pré-requisitos

- Node.js (v20.15.1+)
- pnpm (v9.4.0+)

### Ou acesse direto no navegador

Sem precisar instalar nada, acesse o Omni-Builder online:

👉 **[https://opensouce-app-builder--omini-builder.pages.dev](https://opensouce-app-builder--omini-builder.pages.dev/)**

### Instalação Local

```bash
# Clone o repositório
git clone https://github.com/Pedro21062014/Opensouce-App-builder.-Omini-builder..git

# Entre no diretório
cd Opensouce-App-builder.-Omini-builder.

# Instale as dependências
pnpm install
```

### Configuração

Crie um arquivo `.env.local` na raiz do projeto:

```
# Chave de API da Anthropic (Claude)
ANTHROPIC_API_KEY=your_key_here

# Opcional: nível de debug
VITE_LOG_LEVEL=debug
```

> ⚠️ Nunca commite seu `.env.local` no versionamento.

### Desenvolvimento

```bash
# Inicie o servidor de desenvolvimento
pnpm run dev
```

### Build

```bash
# Build de produção
pnpm run build

# Preview local do build
pnpm run preview
```

### Deploy

```bash
# Deploy para Cloudflare Pages
pnpm run deploy
```

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `pnpm run dev` | Inicia o servidor de desenvolvimento |
| `pnpm run build` | Build de produção |
| `pnpm run start` | Roda o build localmente via Wrangler Pages |
| `pnpm run preview` | Build + preview local |
| `pnpm test` | Roda os testes com Vitest |
| `pnpm run typecheck` | Verificação de tipos TypeScript |
| `pnpm run typegen` | Gera tipos TypeScript via Wrangler |
| `pnpm run deploy` | Build + deploy para Cloudflare Pages |

## Créditos

- **Criador e Mantenedor**: [Pedro Berbis Freire](https://github.com/Pedro21062014)
- **Assistência de IA**: [Z.ai](https://z.ai)
- **Projeto Base**: [Bolt.new](https://github.com/stackblitz/bolt.new) — Criado e mantido pela [StackBlitz](https://stackblitz.com/). O Omni-Builder utiliza o código open-source do Bolt.new (licença MIT) como base e expande suas funcionalidades significativamente.
- **WebContainers**: [StackBlitz](https://stackblitz.com/) — Tecnologia core que permite rodar Node.js completo no navegador
- **Sandpack**: [CodeSandbox](https://codesandbox.io/) — Sandbox de código para preview rápido no navegador
- **Remix**: [Remix Run](https://remix.run/) — Framework full-stack utilizado na construção do app
- **AI SDK**: [Vercel](https://vercel.com/) — SDK de integração com modelos de IA

## Licença

Este projeto está licenciado sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<div align="center">

**Omni-Builder** — Construído com 💜 por Pedro Berbis Freire + Z.ai | Baseado no [Bolt.new](https://github.com/stackblitz/bolt.new) da StackBlitz

</div>
