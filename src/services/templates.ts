// ============================================================
// Omni-Builder — Project Templates
// ============================================================
import type { ProjectTemplate } from '@/types';

const VITE_CONFIG_TS = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
`;

const TAILWIND_CONFIG_JS = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;

const TAILWIND_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-rgb: 255, 255, 255;
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}
`;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const MAIN_TSX = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;

const PACKAGE_JSON_BASE = (name: string) => JSON.stringify(
  {
    name: name.toLowerCase().replace(/\s+/g, '-'),
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc && vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/react': '^18.2.15',
      '@types/react-dom': '^18.2.7',
      '@vitejs/plugin-react': '^4.0.3',
      autoprefixer: '^10.4.14',
      postcss: '^8.4.24',
      tailwindcss: '^3.3.2',
      typescript: '^5.0.2',
      vite: '^4.4.5',
    },
  },
  null,
  2
);

const POSTCSS_CONFIG = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

const TS_CONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
`;

const TS_CONFIG_NODE = `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
`;

const VITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFBD4F"></stop><stop offset="100%" stop-color="#FF9640"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>
`;

// ---- Templates ----

const BLANK_APP_TSX = `export default function App() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Your App
        </h1>
        <p className="text-gray-500 text-lg">
          Start building by editing <code className="bg-gray-100 px-2 py-1 rounded text-sm">src/App.tsx</code>
        </p>
      </div>
    </div>
  )
}
`;

const LANDING_APP_TSX = `import { useState } from 'react'

export default function App() {
  const [email, setEmail] = useState('')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-gray-900">BrandName</div>
        <div className="hidden md:flex gap-8 text-sm text-gray-600">
          <a href="#features" className="hover:text-gray-900 transition">Features</a>
          <a href="#pricing" className="hover:text-gray-900 transition">Pricing</a>
          <a href="#about" className="hover:text-gray-900 transition">About</a>
        </div>
        <button className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition">
          Get Started
        </button>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
          Build Something<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
            Amazing Today
          </span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          The modern platform that helps you ship faster with beautiful,
          production-ready components and seamless developer experience.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="px-6 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-base"
          />
          <button className="bg-violet-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-violet-700 transition">
            Start Free Trial
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { title: 'Lightning Fast', desc: 'Optimized performance that loads in milliseconds, not seconds.' },
            { title: 'Secure by Default', desc: 'Enterprise-grade security built into every layer of the platform.' },
            { title: 'Scales Infinitely', desc: 'From prototype to production, handle any scale effortlessly.' },
          ].map((f) => (
            <div key={f.title} className="p-8 rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-md transition">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
`;

const DASHBOARD_APP_TSX = `import { useState } from 'react'

interface StatCard {
  title: string
  value: string
  change: string
  positive: boolean
}

const stats: StatCard[] = [
  { title: 'Total Revenue', value: '$45,231', change: '+20.1%', positive: true },
  { title: 'Active Users', value: '2,350', change: '+15.2%', positive: true },
  { title: 'Bounce Rate', value: '12.5%', change: '-2.3%', positive: true },
  { title: 'Avg. Session', value: '4m 32s', change: '+0.8%', positive: true },
]

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={\`\${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 text-white p-4 transition-all duration-300 flex flex-col\`}>
        <div className="flex items-center justify-between mb-8">
          {sidebarOpen && <span className="text-xl font-bold">Dashboard</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white">
            {sidebarOpen ? '◁' : '▷'}
          </button>
        </div>
        <nav className="flex-1 space-y-2">
          {['Overview', 'Analytics', 'Users', 'Settings'].map((item) => (
            <button key={item} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 transition text-sm">
              {sidebarOpen && item}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
            <p className="text-gray-500 text-sm">Welcome back! Here's what's happening.</p>
          </div>
          <button className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition">
            Download Report
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((s) => (
            <div key={s.title} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-1">{s.title}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className={\`text-sm mt-2 \${s.positive ? 'text-green-600' : 'text-red-600'}\`}>
                {s.change} from last month
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {[
              { user: 'Alice', action: 'created a new project', time: '2 min ago' },
              { user: 'Bob', action: 'updated settings', time: '15 min ago' },
              { user: 'Charlie', action: 'deployed to production', time: '1 hour ago' },
            ].map((a, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                    {a.user[0]}
                  </div>
                  <div>
                    <p className="text-sm text-gray-900"><span className="font-medium">{a.user}</span> {a.action}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
`;

const TODO_APP_TSX = `import { useState } from 'react'

interface Todo {
  id: number
  text: string
  completed: boolean
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now(), text: input.trim(), completed: false }])
      setInput('')
    }
  }

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(t => t.id !== id))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">My Tasks</h1>

        <div className="flex gap-2 mb-6">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-white"
          />
          <button onClick={addTodo} className="bg-violet-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-violet-700 transition">
            Add
          </button>
        </div>

        <div className="space-y-3">
          {todos.length === 0 && (
            <p className="text-center text-gray-400 py-8">No tasks yet. Add one above!</p>
          )}
          {todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 group">
              <button
                onClick={() => toggleTodo(todo.id)}
                className={\`w-5 h-5 rounded-full border-2 flex items-center justify-center transition \${todo.completed ? 'bg-violet-600 border-violet-600' : 'border-gray-300'}\`}
              >
                {todo.completed && <span className="text-white text-xs">✓</span>}
              </button>
              <span className={\`flex-1 \${todo.completed ? 'line-through text-gray-400' : 'text-gray-900'}\`}>
                {todo.text}
              </span>
              <button onClick={() => deleteTodo(todo.id)} className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                ×
              </button>
            </div>
          ))}
        </div>

        {todos.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-400">
            {todos.filter(t => t.completed).length} of {todos.length} completed
          </div>
        )}
      </div>
    </div>
  )
}
`;

function makeBaseFiles(appName: string, appContent: string): Record<string, string> {
  return {
    'index.html': INDEX_HTML.replace('My App', appName),
    'src/main.tsx': MAIN_TSX,
    'src/App.tsx': appContent,
    'src/styles/globals.css': TAILWIND_CSS,
    'package.json': PACKAGE_JSON_BASE(appName),
    'vite.config.ts': VITE_CONFIG_TS,
    'tailwind.config.js': TAILWIND_CONFIG_JS,
    'postcss.config.js': POSTCSS_CONFIG,
    'tsconfig.json': TS_CONFIG,
    'tsconfig.node.json': TS_CONFIG_NODE,
    'public/vite.svg': VITE_SVG,
  };
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: 'Blank App',
    description: 'A minimal React + Vite + Tailwind starter',
    icon: 'FileText',
    files: makeBaseFiles('Blank App', BLANK_APP_TSX),
  },
  {
    id: 'landing',
    name: 'Landing Page',
    description: 'A modern landing page with hero, features, and CTA',
    icon: 'Layout',
    files: makeBaseFiles('Landing Page', LANDING_APP_TSX),
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'An admin dashboard with stats, sidebar, and activity feed',
    icon: 'BarChart3',
    files: makeBaseFiles('Dashboard', DASHBOARD_APP_TSX),
  },
  {
    id: 'todo',
    name: 'Todo App',
    description: 'A beautiful task manager with add, toggle, and delete',
    icon: 'CheckSquare',
    files: makeBaseFiles('Todo App', TODO_APP_TSX),
  },
];
