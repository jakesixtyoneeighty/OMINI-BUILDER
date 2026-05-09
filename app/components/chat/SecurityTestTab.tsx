import { useState } from 'react';
import { toast } from 'react-toastify';
import { useT } from '~/lib/i18n/useT';

/**
 * Predefined security test prompts.
 * Each test has a name, description, icon, and a prompt that will be sent to the AI.
 */
const SECURITY_TESTS = [
  {
    id: 'xss',
    name: 'XSS (Cross-Site Scripting)',
    description: 'Testa se o projeto está vulnerável a ataques XSS, onde scripts maliciosos podem ser injetados em páginas web.',
    icon: 'i-ph:bug-duotone',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    prompt: `Execute uma análise completa de segurança XSS (Cross-Site Scripting) neste projeto. Para cada arquivo relevante:

1. Identifique TODOS os pontos onde dados do usuário são renderizados no DOM (innerHTML, dangerouslySetInnerHTML, document.write, etc.)
2. Verifique se há sanitização adequada de input do usuário antes de exibição
3. Teste se URLs e parâmetros de consulta são validados
4. Verifique se cookies usam flags HttpOnly, Secure e SameSite
5. Verifique se Content Security Policy (CSP) está configurada
6. Verifique se há uso de eval(), Function() ou setTimeout/setInterval com strings

Para cada vulnerabilidade encontrada, corrija o código removendo o uso inseguro e substituindo por alternativas seguras (textContent, sanitize, DOMPurify, etc.). Adicione headers de segurança se necessário. Explique cada correção.`,
  },
  {
    id: 'sql-injection',
    name: 'SQL Injection',
    description: 'Verifica se o projeto tem vulnerabilidades de injeção SQL em consultas ao banco de dados.',
    icon: 'i-ph:database-duotone',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    prompt: `Execute uma análise completa de segurança contra SQL Injection neste projeto. Para cada arquivo relevante:

1. Identifique TODOS os pontos onde queries SQL são construídas com concatenação de strings ou template literals com input do usuário
2. Verifique se prepared statements/parameterized queries são usados consistentemente
3. Verifique se ORMs estão configurados corretamente e não permitem raw queries inseguras
4. Teste se validação de input é feita antes de usar em queries
5. Verifique se há proteção contra NoSQL injection (para MongoDB, etc.)

Para cada vulnerabilidade encontrada, corrija o código usando prepared statements, ORMs seguros ou validação rigorosa de input. Explique cada correção.`,
  },
  {
    id: 'auth',
    name: 'Autenticação & Autorização',
    description: 'Analisa falhas em sistemas de login, sessões, tokens JWT, controle de acesso e permissões.',
    icon: 'i-ph:shield-check-duotone',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    prompt: `Execute uma análise completa de segurança de Autenticação e Autorização neste projeto. Para cada arquivo relevante:

1. Verifique se senhas são hasheadas com algoritmos seguros (bcrypt, argon2) e não armazenadas em texto plano
2. Verifique se JWTs são validados corretamente (assinatura, expiração, issuer)
3. Verifique se há proteção contra brute force (rate limiting, account lockout)
4. Verifique se sessões são invalidadas corretamente no logout
5. Verifique se há controle de acesso adequado (RBAC/ABAC) em todas as rotas protegidas
6. Verifique se tokens são transmitidos apenas via HTTPS e cookies seguros
7. Verifique se há proteção contra CSRF em formulários
8. Verifique se não há hardcoded credentials ou API keys no código

Para cada vulnerabilidade encontrada, corrija o código implementando as práticas de segurança adequadas. Explique cada correção.`,
  },
  {
    id: 'secrets',
    name: 'Vazamento de Segredos',
    description: 'Detecta chaves de API, senhas, tokens e outras credenciais expostas no código-fonte.',
    icon: 'i-ph:key-duotone',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    prompt: `Execute uma análise completa para detectar vazamento de segredos e credenciais neste projeto:

1. Procure por API keys hardcoded no código (padrões como sk-..., AIza..., ghpat..., etc.)
2. Verifique se arquivos .env estão no .gitignore
3. Procure por senhas, tokens e secrets em código-fonte e arquivos de configuração
4. Verifique se credenciais de banco de dados estão expostas
5. Verifique se há private keys, certificates ou secrets em arquivos commitados
6. Verifique se o .gitignore inclui todos os arquivos sensíveis (.env, *.key, *.pem, etc.)
7. Verifique se secrets são carregados de variáveis de ambiente e não hardcoded

Para cada segredo encontrado, mova para variáveis de ambiente (.env), adicione ao .gitignore, e substitua no código por process.env ou import.meta.env. Explique cada correção.`,
  },
  {
    id: 'deps',
    name: 'Dependências Vulneráveis',
    description: 'Verifica se as dependências do projeto possuem vulnerabilidades de segurança conhecidas.',
    icon: 'i-ph:package-duotone',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    prompt: `Execute uma análise de segurança das dependências deste projeto:

1. Verifique o package.json para dependências desatualizadas ou com vulnerabilidades conhecidas
2. Execute npm audit ou verifique manualmente por vulnerabilidades comuns em dependências populares
3. Verifique se há dependências não utilizadas que aumentam a superfície de ataque
4. Verifique se as versões das dependências estão fixadas (lock file) para evitar supply chain attacks
5. Verifique se há dependências com licenças incompatíveis
6. Verifique se scripts postinstall ou preinstall são seguros
7. Recomende alternativas mais seguras para dependências com problemas

Para cada problema encontrado, atualize a dependência, remova se não for necessária, ou substitua por alternativa segura. Execute npm audit fix se possível. Explique cada correção.`,
  },
  {
    id: 'headers',
    name: 'Headers de Segurança',
    description: 'Verifica se os headers HTTP de segurança estão configurados corretamente (CSP, HSTS, X-Frame-Options, etc.).',
    icon: 'i-ph:shield-warning-duotone',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    prompt: `Execute uma análise completa dos headers de segurança HTTP deste projeto:

1. Verifique se Content-Security-Policy (CSP) está configurada
2. Verifique se X-Frame-Options está definido (previne clickjacking)
3. Verifique se X-Content-Type-Options: nosniff está configurado
4. Verifique se Strict-Transport-Security (HSTS) está habilitado
5. Verifique se Referrer-Policy está configurado
6. Verifique se Permissions-Policy está definido
7. Verifique se X-XSS-Protection está configurado
8. Verifique se não há headers sensíveis expostos (X-Powered-By, Server, etc.)

Para cada header faltante ou mal configurado, adicione ou corrija no código do servidor/middleware. Configure o CSP de forma restritiva mas funcional para o projeto. Explique cada correção.`,
  },
  {
    id: 'full',
    name: 'Teste Completo',
    description: 'Executa todos os testes de segurança em uma única análise abrangente.',
    icon: 'i-ph:shield-star-duotone',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    prompt: `Execute uma auditoria de segurança COMPLETA e ABRANGENTE neste projeto. Analise TODOS os aspectos:

1. **XSS**: Procure por innerHTML, dangerouslySetInnerHTML, eval(), document.write, e dados de usuário não sanitizados
2. **SQL Injection**: Verifique queries SQL com concatenação, falta de prepared statements
3. **Autenticação**: Senhas em texto plano, JWTs mal validados, falta de rate limiting, sessões não invalidadas
4. **Vazamento de Segredos**: API keys hardcoded, senhas no código, arquivos .env não gitignored
5. **Headers de Segurança**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
6. **Dependências**: Versões vulneráveis, dependências desnecessárias
7. **CSRF**: Falta de tokens CSRF em formulários
8. **CORS**: Configuração permissiva demais
9. **Input Validation**: Falta de validação/sanitização de input
10. **File Upload**: Upload sem validação de tipo/tamanho

Para CADA vulnerabilidade encontrada, classifique como CRÍTICA, ALTA, MÉDIA ou BAIXA, corrija o código implementando a solução segura, e explique a correção. No final, forneça um resumo com a contagem de vulnerabilidades por severidade.`,
  },
];

interface SecurityTestTabProps {
  onRunTest: (prompt: string) => void;
  isStreaming?: boolean;
}

export function SecurityTestTab({ onRunTest, isStreaming }: SecurityTestTabProps) {
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [completedTests, setCompletedTests] = useState<Set<string>>(new Set());
  const t = useT();

  const handleRunTest = (test: typeof SECURITY_TESTS[number]) => {
    if (isStreaming) {
      toast.warning(t('security.waitAiResponse'));
      return;
    }

    setRunningTest(test.id);
    onRunTest(test.prompt);

    // Mark as completed after a delay (test is "running")
    setTimeout(() => {
      setCompletedTests(prev => new Set(prev).add(test.id));
      setRunningTest(null);
    }, 2000);
  };

  return (
    <div className="p-5 space-y-3">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-1">{t('security.securityTest')}</h3>
        <p className="text-xs text-bolt-elements-textTertiary leading-relaxed">
          {t('security.selectTestDescription')}
        </p>
      </div>

      {SECURITY_TESTS.map((test) => {
        const isRunning = runningTest === test.id;
        const isCompleted = completedTests.has(test.id);

        return (
          <div
            key={test.id}
            className={`rounded-lg border p-3 ${test.border} ${test.bg} transition-all`}
          >
            <div className="flex items-start gap-3">
              <div className={`shrink-0 w-8 h-8 rounded-lg ${test.bg} flex items-center justify-center`}>
                <div className={`${test.icon} text-base ${test.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-bolt-elements-textPrimary">{test.name}</span>
                  {isCompleted && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t('security.executed')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-bolt-elements-textTertiary leading-relaxed mb-2">
                  {test.description}
                </p>
                <button
                  onClick={() => handleRunTest(test)}
                  disabled={isRunning || isStreaming}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                    isRunning
                      ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary cursor-wait'
                      : isStreaming
                        ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary cursor-not-allowed'
                        : 'bg-bolt-elements-item-contentAccent/15 text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-contentAccent/25'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <div className="i-ph:spinner-gap text-sm animate-spin" />
                      {t('security.running')}
                    </>
                  ) : (
                    <>
                      <div className="i-ph:play-fill text-sm" />
                      {t('security.runTest')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
