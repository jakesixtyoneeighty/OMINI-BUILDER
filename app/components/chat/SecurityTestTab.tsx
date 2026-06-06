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
    description: 'Tests whether the project is vulnerable to XSS attacks, where malicious scripts can be injected into web pages.',
    icon: 'i-ph:bug-duotone',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    prompt: `Run a complete XSS (Cross-Site Scripting) security analysis on this project. For each relevant file:

1. Identify ALL points where user data is rendered in the DOM (innerHTML, dangerouslySetInnerHTML, document.write, etc.)
2. Check whether user input is properly sanitized before display
3. Test whether URLs and query parameters are validated
4. Check whether cookies use HttpOnly, Secure, and SameSite flags
5. Check whether Content Security Policy (CSP) is configured
6. Check for use of eval(), Function(), or setTimeout/setInterval with strings

For each vulnerability found, fix the code by removing unsafe usage and replacing it with secure alternatives (textContent, sanitize, DOMPurify, etc.). Add security headers if needed. Explain each fix.`,
  },
  {
    id: 'sql-injection',
    name: 'SQL Injection',
    description: 'Checks whether the project has SQL injection vulnerabilities in database queries.',
    icon: 'i-ph:database-duotone',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    prompt: `Run a complete SQL Injection security analysis on this project. For each relevant file:

1. Identify ALL points where SQL queries are built with string concatenation or template literals using user input
2. Check whether prepared statements/parameterized queries are used consistently
3. Check whether ORMs are configured correctly and do not allow unsafe raw queries
4. Test whether input validation is performed before use in queries
5. Check for protection against NoSQL injection (for MongoDB, etc.)

For each vulnerability found, fix the code using prepared statements, secure ORMs, or rigorous input validation. Explain each fix.`,
  },
  {
    id: 'auth',
    name: 'Authentication & Authorization',
    description: 'Analyzes flaws in login systems, sessions, JWT tokens, access control, and permissions.',
    icon: 'i-ph:shield-check-duotone',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    prompt: `Run a complete Authentication and Authorization security analysis on this project. For each relevant file:

1. Check whether passwords are hashed with secure algorithms (bcrypt, argon2) and not stored in plain text
2. Check whether JWTs are validated correctly (signature, expiration, issuer)
3. Check for brute force protection (rate limiting, account lockout)
4. Check whether sessions are properly invalidated on logout
5. Check for adequate access control (RBAC/ABAC) on all protected routes
6. Check whether tokens are transmitted only over HTTPS and secure cookies
7. Check for CSRF protection on forms
8. Check for hardcoded credentials or API keys in the code

For each vulnerability found, fix the code by implementing appropriate security practices. Explain each fix.`,
  },
  {
    id: 'secrets',
    name: 'Secret Leakage',
    description: 'Detects API keys, passwords, tokens, and other credentials exposed in source code.',
    icon: 'i-ph:key-duotone',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    prompt: `Run a complete analysis to detect secret and credential leakage in this project:

1. Search for hardcoded API keys in the code (patterns such as sk-..., AIza..., ghpat..., etc.)
2. Check whether .env files are in .gitignore
3. Search for passwords, tokens, and secrets in source code and configuration files
4. Check whether database credentials are exposed
5. Check for private keys, certificates, or secrets in committed files
6. Check whether .gitignore includes all sensitive files (.env, *.key, *.pem, etc.)
7. Check whether secrets are loaded from environment variables and not hardcoded

For each secret found, move it to environment variables (.env), add it to .gitignore, and replace it in the code with process.env or import.meta.env. Explain each fix.`,
  },
  {
    id: 'deps',
    name: 'Vulnerable Dependencies',
    description: 'Checks whether project dependencies have known security vulnerabilities.',
    icon: 'i-ph:package-duotone',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    prompt: `Run a dependency security analysis on this project:

1. Check package.json for outdated dependencies or known vulnerabilities
2. Run npm audit or manually check for common vulnerabilities in popular dependencies
3. Check for unused dependencies that increase the attack surface
4. Check whether dependency versions are pinned (lock file) to prevent supply chain attacks
5. Check for dependencies with incompatible licenses
6. Check whether postinstall or preinstall scripts are safe
7. Recommend more secure alternatives for problematic dependencies

For each issue found, update the dependency, remove it if unnecessary, or replace it with a secure alternative. Run npm audit fix if possible. Explain each fix.`,
  },
  {
    id: 'headers',
    name: 'Security Headers',
    description: 'Checks whether HTTP security headers are configured correctly (CSP, HSTS, X-Frame-Options, etc.).',
    icon: 'i-ph:shield-warning-duotone',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    prompt: `Run a complete HTTP security headers analysis on this project:

1. Check whether Content-Security-Policy (CSP) is configured
2. Check whether X-Frame-Options is set (prevents clickjacking)
3. Check whether X-Content-Type-Options: nosniff is configured
4. Check whether Strict-Transport-Security (HSTS) is enabled
5. Check whether Referrer-Policy is configured
6. Check whether Permissions-Policy is defined
7. Check whether X-XSS-Protection is configured
8. Check that sensitive headers are not exposed (X-Powered-By, Server, etc.)

For each missing or misconfigured header, add or fix it in the server/middleware code. Configure CSP in a restrictive but functional way for the project. Explain each fix.`,
  },
  {
    id: 'full',
    name: 'Full Test',
    description: 'Runs all security tests in a single comprehensive analysis.',
    icon: 'i-ph:shield-star-duotone',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    prompt: `Run a COMPLETE and COMPREHENSIVE security audit on this project. Analyze ALL aspects:

1. **XSS**: Look for innerHTML, dangerouslySetInnerHTML, eval(), document.write, and unsanitized user data
2. **SQL Injection**: Check SQL queries with concatenation, lack of prepared statements
3. **Authentication**: Plain text passwords, improperly validated JWTs, missing rate limiting, sessions not invalidated
4. **Secret Leakage**: Hardcoded API keys, passwords in code, .env files not gitignored
5. **Security Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
6. **Dependencies**: Vulnerable versions, unnecessary dependencies
7. **CSRF**: Missing CSRF tokens on forms
8. **CORS**: Overly permissive configuration
9. **Input Validation**: Missing input validation/sanitization
10. **File Upload**: Upload without type/size validation

For EACH vulnerability found, classify it as CRITICAL, HIGH, MEDIUM, or LOW, fix the code by implementing the secure solution, and explain the fix. At the end, provide a summary with the count of vulnerabilities by severity.`,
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
