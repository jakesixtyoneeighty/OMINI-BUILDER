export interface Template {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: TemplateCategory;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  icon: string;
  gradient: string;
  featured?: boolean;
}

export type TemplateCategory =
  | 'games'
  | 'web-apps'
  | 'business'
  | 'education'
  | 'tools'
  | 'social'
  | 'ecommerce'
  | 'dashboard';

export interface CategoryInfo {
  id: TemplateCategory;
  name: string;
  icon: string;
  description: string;
}

export const categories: CategoryInfo[] = [
  { id: 'games', name: 'Games', icon: 'i-ph:game-controller-duotone', description: 'Jogos interativos e divertidos' },
  { id: 'web-apps', name: 'Web Apps', icon: 'i-ph:globe-duotone', description: 'Aplicativos web completos' },
  { id: 'business', name: 'Business', icon: 'i-ph:briefcase-duotone', description: 'Ferramentas para negocios' },
  { id: 'education', name: 'Educacao', icon: 'i-ph:graduation-cap-duotone', description: 'Plataformas de aprendizado' },
  { id: 'tools', name: 'Ferramentas', icon: 'i-ph:wrench-duotone', description: 'Utilitarios uteis' },
  { id: 'social', name: 'Social', icon: 'i-ph:chat-circle-dots-duotone', description: 'Apps de comunicacao' },
  { id: 'ecommerce', name: 'E-Commerce', icon: 'i-ph:shopping-cart-duotone', description: 'Lojas e marketplaces' },
  { id: 'dashboard', name: 'Dashboards', icon: 'i-ph:chart-bar-duotone', description: 'Paineis de controle' },
];

export const templates: Template[] = [
  // GAMES
  {
    id: 'snake-game',
    name: 'Snake Game',
    description: 'Classico jogo da cobrinha com HTML5 Canvas, placar, niveis de dificuldade e efeitos visuais modernos.',
    prompt: 'Build a modern Snake game using HTML5 Canvas with React. Features: responsive design, score tracking, high score in localStorage, 3 difficulty levels (easy, medium, hard), smooth animations, gradient snake body, particle effects when eating food, game over screen with restart option, dark theme with neon colors, mobile touch controls support.',
    category: 'games',
    tags: ['React', 'Canvas', 'Game'],
    difficulty: 'beginner',
    icon: 'i-ph:snake-duotone',
    gradient: 'from-green-500 to-emerald-600',
    featured: true,
  },
  {
    id: 'memory-game',
    name: 'Memory Card Game',
    description: 'Jogo da memoria com cartas viraveis, temporizador, contagem de movimentos e tema personalizavel.',
    prompt: 'Build a Memory Card Matching Game using React and Tailwind CSS. Features: 4x4 grid of cards with emoji icons, flip animation with CSS transforms, move counter, timer, best score tracking in localStorage, win celebration with confetti animation, restart button, difficulty options (4x3, 4x4, 5x4), beautiful card flip 3D effect, responsive design.',
    category: 'games',
    tags: ['React', 'Tailwind', 'Animation'],
    difficulty: 'beginner',
    icon: 'i-ph:playing-cards-duotone',
    gradient: 'from-pink-500 to-rose-600',
  },
  {
    id: 'tetris',
    name: 'Tetris',
    description: 'O classico Tetris com todas as pecas, rotacao, sistema de pontuacao e niveis progressivos.',
    prompt: 'Build a complete Tetris game using HTML5 Canvas with React. Features: all 7 standard tetrominoes (I, O, T, S, Z, J, L), rotation system (wall kicks), ghost piece showing where it will land, next piece preview, hold piece functionality, scoring system (lines, T-spins, combos), level progression with increasing speed, line clear animations, start screen, pause functionality, high score board in localStorage, dark theme with colorful pieces, keyboard controls.',
    category: 'games',
    tags: ['React', 'Canvas', 'Game'],
    difficulty: 'intermediate',
    icon: 'i-ph:squares-four-duotone',
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'space-invaders',
    name: 'Space Invaders',
    description: 'Jogo de naves espaciais com inimigos, tiros, power-ups e chefe final.',
    prompt: 'Build a Space Invaders style game using HTML5 Canvas and React. Features: player spaceship controlled by arrow keys, different enemy types with different behaviors, shooting mechanics, power-ups (shield, rapid fire, spread shot), boss battles every 5 waves, particle explosion effects, starfield parallax background, score system, lives counter, sound effects using Web Audio API, start screen with instructions, game over screen with restart.',
    category: 'games',
    tags: ['React', 'Canvas', 'Game'],
    difficulty: 'intermediate',
    icon: 'i-ph:rocket-launch-duotone',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'wordle-clone',
    name: 'Wordle Clone',
    description: 'Clone do popular jogo de adivinhacao de palavras com animacoes e estatisticas.',
    prompt: 'Build a Wordle word guessing game clone using React and Tailwind CSS. Features: 6 attempts to guess a 5-letter word, on-screen keyboard with color-coded feedback (green=correct position, yellow=wrong position, gray=not in word), flip animation for letter reveals, shake animation for invalid words, win/lose animations, statistics tracking (games played, win %, current streak, max streak) in localStorage, share results button, dark mode, daily word change, Portuguese word list support.',
    category: 'games',
    tags: ['React', 'Tailwind', 'Game'],
    difficulty: 'intermediate',
    icon: 'i-ph:text-aa-duotone',
    gradient: 'from-amber-500 to-orange-600',
  },

  // WEB APPS
  {
    id: 'todo-app',
    name: 'Todo App',
    description: 'Aplicativo de tarefas completo com categorias, filtros, prioridades e tema escuro.',
    prompt: 'Build a beautiful and functional Todo App using React, Tailwind CSS, and localStorage for persistence. Features: add/edit/delete tasks, mark tasks as complete, priority levels (low, medium, high) with color coding, categories/tags for organization, due date picker, search and filter (by status, priority, category), drag and drop reordering, progress bar showing completion percentage, dark/light theme toggle, responsive design, empty state illustration, confirmation dialog for delete, animated transitions.',
    category: 'web-apps',
    tags: ['React', 'Tailwind', 'LocalStorage'],
    difficulty: 'beginner',
    icon: 'i-ph:check-square-duotone',
    gradient: 'from-blue-500 to-indigo-600',
    featured: true,
  },
  {
    id: 'weather-app',
    name: 'Weather Dashboard',
    description: 'Dashboard meteorologico com previsao do tempo, graficos e busca por cidade.',
    prompt: 'Build a Weather Dashboard using React and a free weather API (OpenWeatherMap or similar). Features: search cities by name, current weather display (temperature, humidity, wind, pressure, visibility), 5-day forecast with icons, hourly forecast chart, dynamic background based on weather condition (sunny, rainy, cloudy, snowy), temperature unit toggle (Celsius/Fahrenheit), recent searches in localStorage, beautiful weather icons, animated transitions between cities, responsive grid layout, loading states, error handling.',
    category: 'web-apps',
    tags: ['React', 'API', 'Charts'],
    difficulty: 'beginner',
    icon: 'i-ph:cloud-sun-duotone',
    gradient: 'from-sky-500 to-blue-600',
  },
  {
    id: 'note-taking-app',
    name: 'Notas Rapidas',
    description: 'App de notas com editor rich text, organizacao por pastas e busca.',
    prompt: 'Build a Note Taking App using React and Tailwind CSS with localStorage. Features: rich text editor with basic formatting (bold, italic, underline, lists), create/edit/delete notes, organize notes in folders, drag and drop to move notes between folders, markdown support, search across all notes, pin important notes, color-coded labels/tags, grid and list view toggle, word count and last edited timestamp, auto-save, export notes as markdown or text, dark theme, responsive design, empty states with illustrations.',
    category: 'web-apps',
    tags: ['React', 'Tailwind', 'Markdown'],
    difficulty: 'intermediate',
    icon: 'i-ph:notebook-duotone',
    gradient: 'from-yellow-500 to-amber-600',
  },
  {
    id: 'pomodoro-timer',
    name: 'Pomodoro Timer',
    description: 'Timer Pomodoro com sessoes de trabalho, intervalos e estatisticas de produtividade.',
    prompt: 'Build a Pomodoro Timer App using React and Tailwind CSS. Features: customizable work/break durations (25min work, 5min short break, 15min long break), circular progress timer with animation, auto-start next session option, session counter (4 work sessions = long break), task label for current focus, pause/resume/stop controls, sound notification when timer ends, daily productivity statistics stored in localStorage, settings panel to customize durations, motivational quotes, minimal and clean design, dark mode, responsive.',
    category: 'web-apps',
    tags: ['React', 'Tailwind', 'Timer'],
    difficulty: 'beginner',
    icon: 'i-ph:timer-duotone',
    gradient: 'from-red-500 to-rose-600',
  },

  // BUSINESS
  {
    id: 'invoice-generator',
    name: 'Gerador de Notas Fiscais',
    description: 'Gerador de invoices profissionais com calculo automatico, PDF e gestao de clientes.',
    prompt: 'Build an Invoice Generator using React and Tailwind CSS. Features: create professional invoices with company logo upload, add client details, add multiple line items with description, quantity, unit price, auto-calculate subtotal, tax rate, discount, and total, currency formatting, invoice number auto-generation, due date, payment status tracking, invoice list with filters (paid, pending, overdue), export to PDF using browser print, duplicate invoice, client database in localStorage, responsive design, dark theme.',
    category: 'business',
    tags: ['React', 'Tailwind', 'PDF'],
    difficulty: 'intermediate',
    icon: 'i-ph:file-text-duotone',
    gradient: 'from-teal-500 to-emerald-600',
  },
  {
    id: 'project-kanban',
    name: 'Kanban Board',
    description: 'Quadro Kanban drag-and-drop para gestao de projetos com equipes.',
    prompt: 'Build a Kanban Board using React with drag and drop. Features: multiple columns (To Do, In Progress, Review, Done) that can be customized, drag and drop cards between columns using HTML5 Drag API or pointer events, add/edit/delete cards with title, description, assignee, priority, labels, due date, and checklist, card detail modal, column card count, search and filter cards, board saved in localStorage, responsive design, smooth animations, dark theme, add/remove columns.',
    category: 'business',
    tags: ['React', 'Drag&Drop', 'Kanban'],
    difficulty: 'intermediate',
    icon: 'i-ph:kanban-duotone',
    gradient: 'from-indigo-500 to-blue-600',
    featured: true,
  },
  {
    id: 'expense-tracker',
    name: 'Controle de Gastos',
    description: 'Rastreador de despesas com graficos, categorias e relatorios mensais.',
    prompt: 'Build an Expense Tracker using React and Tailwind CSS. Features: add income and expenses with amount, category, date, and notes, predefined categories (food, transport, entertainment, bills, etc.) with icons, monthly budget setting per category, pie chart for category breakdown, bar chart for monthly comparison, summary dashboard (total income, expenses, balance), transaction list with search and filters by date range and category, edit and delete transactions, data stored in localStorage, export to CSV, responsive design, dark mode.',
    category: 'business',
    tags: ['React', 'Tailwind', 'Charts'],
    difficulty: 'intermediate',
    icon: 'i-ph:wallet-duotone',
    gradient: 'from-emerald-500 to-green-600',
  },

  // EDUCATION
  {
    id: 'flashcards-app',
    name: 'Flashcards',
    description: 'App de flashcards para estudo com algoritmo de repeticao espacada.',
    prompt: 'Build a Flashcards Study App using React and Tailwind CSS. Features: create decks of flashcards with front (question) and back (answer), flip card animation, mark cards as "know" or "dont know", spaced repetition algorithm (show difficult cards more often), study progress per deck, add/edit/delete cards, import/export decks as JSON, shuffle mode, multiple choice quiz mode based on flashcard decks, progress statistics, data stored in localStorage, beautiful card flip 3D animation, dark mode, responsive.',
    category: 'education',
    tags: ['React', 'Tailwind', 'Education'],
    difficulty: 'beginner',
    icon: 'i-ph:cards-duotone',
    gradient: 'from-orange-500 to-amber-600',
  },
  {
    id: 'quiz-app',
    name: 'Quiz Interativo',
    description: 'Plataforma de quiz com multiplas categorias, placar e temporizador.',
    prompt: 'Build an Interactive Quiz App using React and Tailwind CSS. Features: multiple quiz categories (Science, History, Geography, Technology, etc.), each question has 4 options with only one correct answer, timer per question (15 seconds), score tracking with streak bonus, difficulty levels, progress bar showing current question number, correct/wrong answer feedback with explanation, leaderboard with top scores in localStorage, create custom quizzes, animated transitions between questions, results screen with detailed breakdown, responsive design, dark theme.',
    category: 'education',
    tags: ['React', 'Tailwind', 'Quiz'],
    difficulty: 'intermediate',
    icon: 'i-ph:question-duotone',
    gradient: 'from-purple-500 to-violet-600',
  },
  {
    id: 'typing-tutor',
    name: 'Typing Tutor',
    description: 'Aprenda a digitar mais rapido com exercicios praticos e estatisticas.',
    prompt: 'Build a Typing Tutor / Typing Speed Test App using React and Tailwind CSS. Features: typing test with random texts, real-time WPM (words per minute) calculation, accuracy percentage, time options (15s, 30s, 60s, 120s), highlight correct (green) and incorrect (red) characters as you type, cursor animation, results screen with WPM, accuracy, correct/incorrect/total characters, typing speed over time chart, different text categories (quotes, code, common words), personal best records in localStorage, dark theme, keyboard visualization showing which finger to use, responsive design.',
    category: 'education',
    tags: ['React', 'Tailwind', 'Education'],
    difficulty: 'intermediate',
    icon: 'i-ph:keyboard-duotone',
    gradient: 'from-slate-500 to-zinc-600',
  },

  // TOOLS
  {
    id: 'password-generator',
    name: 'Gerador de Senhas',
    description: 'Gerador de senhas seguras com configuracoes avancadas e avaliacao de forca.',
    prompt: 'Build a Password Generator using React and Tailwind CSS. Features: configurable length (8-128 characters), toggle uppercase, lowercase, numbers, special characters, exclude ambiguous characters option, generate multiple passwords at once, password strength meter with visual indicator and description, copy to clipboard with feedback, password history (last 20) in localStorage, generate PIN option, generate passphrase option (random dictionary words), dark theme, responsive design, beautiful UI with animations.',
    category: 'tools',
    tags: ['React', 'Tailwind', 'Security'],
    difficulty: 'beginner',
    icon: 'i-ph:key-duotone',
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    id: 'qr-code-generator',
    name: 'QR Code Generator',
    description: 'Gerador de QR Codes para URLs, texto, WiFi, contatos e muito mais.',
    prompt: 'Build a QR Code Generator using React and a QR code library (qrcode.react or similar). Features: generate QR codes for URLs, plain text, WiFi credentials, contact info (vCard), email, phone number, SMS, customizable QR code colors (foreground and background), adjustable size, download as PNG and SVG, copy QR code image to clipboard, QR code history in localStorage, bulk generation mode, input validation, real-time QR code preview as you type, dark theme, responsive design, clean modern UI.',
    category: 'tools',
    tags: ['React', 'QR Code', 'Utility'],
    difficulty: 'beginner',
    icon: 'i-ph:qr-code-duotone',
    gradient: 'from-fuchsia-500 to-purple-600',
  },
  {
    id: 'color-picker',
    name: 'Color Picker Pro',
    description: 'Seletor de cores avancado com paletas, harmonias e codigo CSS.',
    prompt: 'Build an Advanced Color Picker Tool using React and Tailwind CSS. Features: visual color picker (hue/saturation/lightness), hex, RGB, HSL input fields with conversion, color palette generator (5 variations from a base color), complementary, analogous, triadic, and split-complementary color harmonies, copy color codes (HEX, RGB, HSL, CSS), saved color palettes in localStorage, gradient generator (linear and radial) with CSS code, contrast checker (WCAG accessibility), recently used colors, dark theme, responsive design.',
    category: 'tools',
    tags: ['React', 'Tailwind', 'Color'],
    difficulty: 'intermediate',
    icon: 'i-ph:palette-duotone',
    gradient: 'from-pink-500 to-fuchsia-600',
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Formatador, validador e visualizador de JSON com syntax highlighting.',
    prompt: 'Build a JSON Formatter and Validator tool using React and Tailwind CSS. Features: paste or type JSON input, format/beautify JSON with proper indentation, minify JSON, validate JSON with detailed error messages and line numbers, syntax highlighting (strings in green, numbers in blue, booleans in purple, null in gray), tree view to collapse/expand JSON objects and arrays, JSON path display on hover, copy formatted JSON, clear input, sample JSON data button, max input size indicator, dark theme with monospace font, responsive layout.',
    category: 'tools',
    tags: ['React', 'Tailwind', 'JSON'],
    difficulty: 'beginner',
    icon: 'i-ph:brackets-curly-duotone',
    gradient: 'from-yellow-500 to-orange-600',
  },

  // SOCIAL
  {
    id: 'chat-ui',
    name: 'Chat UI Clone',
    description: 'Interface de chat moderna com mensagens, emojis, anexos e temas.',
    prompt: 'Build a Modern Chat UI using React and Tailwind CSS. Features: conversation list sidebar with last message preview and unread count, message input with emoji picker (using emoji-mart or similar), send text messages, simulate receiving messages, message bubbles with timestamps (left for received, right for sent), read receipts (single/double check marks), typing indicator animation, search conversations, create new conversation, delete conversation, message status (sent, delivered, read), auto-reply simulation, responsive design (mobile-first), dark/light theme, smooth scroll to latest message, online/offline status indicators.',
    category: 'social',
    tags: ['React', 'Tailwind', 'UI'],
    difficulty: 'intermediate',
    icon: 'i-ph:chat-centered-text-duotone',
    gradient: 'from-blue-500 to-cyan-600',
    featured: true,
  },
  {
    id: 'portfolio-website',
    name: 'Portfolio Pessoal',
    description: 'Site portfolio moderno com animacoes, secoes de projetos e formulario de contato.',
    prompt: 'Build a Modern Personal Portfolio Website using React and Tailwind CSS. Features: hero section with animated text and CTA buttons, about me section with photo and skills, projects showcase with filterable grid (All, Web, Mobile, Design), each project card with image placeholder, title, description, tech stack tags, and links, experience/timeline section, testimonials carousel, contact form with validation, smooth scroll navigation, responsive hamburger menu for mobile, dark mode toggle, scroll-based animations, footer with social links, clean and professional design.',
    category: 'social',
    tags: ['React', 'Tailwind', 'Portfolio'],
    difficulty: 'beginner',
    icon: 'i-ph:user-circle-duotone',
    gradient: 'from-violet-500 to-indigo-600',
  },

  // E-COMMERCE
  {
    id: 'product-catalog',
    name: 'Catalogo de Produtos',
    description: 'Catalogo de produtos com carrinho, filtros e pagina de detalhes.',
    prompt: 'Build a Product Catalog / Storefront using React and Tailwind CSS. Features: product grid with beautiful cards (image placeholder, name, price, rating stars, discount badge), search bar with autocomplete, category filter sidebar, sort by (price low-high, price high-low, rating, newest), price range slider, product detail page with image gallery, add to cart, quantity selector, shopping cart sidebar with items count, remove from cart, cart total calculation, wishlist button, product ratings display, responsive grid (1 col mobile, 2 col tablet, 3-4 col desktop), loading skeletons, empty state, dark theme.',
    category: 'ecommerce',
    tags: ['React', 'Tailwind', 'E-Commerce'],
    difficulty: 'intermediate',
    icon: 'i-ph:storefront-duotone',
    gradient: 'from-orange-500 to-red-600',
  },

  // DASHBOARD
  {
    id: 'analytics-dashboard',
    name: 'Dashboard de Analytics',
    description: 'Painel de analytics com graficos interativos, KPIs e relatorios.',
    prompt: 'Build an Analytics Dashboard using React and Tailwind CSS. Features: header with date range picker, KPI cards (total visitors, page views, bounce rate, avg session duration) with trend indicators, line chart for traffic over time, bar chart for top pages, pie/donut chart for traffic sources (direct, organic, social, referral), recent activity feed, user table with sortable columns, responsive layout with collapsible sidebar, real-time counter animation, dark theme, sample data built-in, export reports as CSV, filter by date range.',
    category: 'dashboard',
    tags: ['React', 'Tailwind', 'Charts'],
    difficulty: 'advanced',
    icon: 'i-ph:chart-line-up-duotone',
    gradient: 'from-blue-600 to-indigo-700',
    featured: true,
  },
  {
    id: 'fitness-tracker',
    name: 'Fitness Tracker',
    description: 'Rastreador de exercicios com graficos de progresso e metas pessoais.',
    prompt: 'Build a Fitness Tracker Dashboard using React and Tailwind CSS. Features: daily exercise log (exercise name, sets, reps, weight, duration), exercise categories (cardio, strength, flexibility), weekly/monthly calendar view with activity indicators, progress charts (weight lifted over time, workout frequency), personal records tracking, workout templates for quick logging, body measurements tracking with trend chart, water intake tracker, daily step counter, goal setting with progress rings, rest day detection, data stored in localStorage, dark theme, responsive design.',
    category: 'dashboard',
    tags: ['React', 'Tailwind', 'Fitness'],
    difficulty: 'intermediate',
    icon: 'i-ph:heartbeat-duotone',
    gradient: 'from-red-500 to-pink-600',
  },
  {
    id: 'habit-tracker',
    name: 'Habit Tracker',
    description: 'Rastreador de habitos com calendario, streaks e estatisticas.',
    prompt: 'Build a Habit Tracker App using React and Tailwind CSS. Features: add habits with name, icon, frequency (daily, weekly, specific days), color coding per habit, calendar view showing completion history (heatmap style like GitHub contributions), current streak counter, longest streak record, completion percentage per habit, daily checklist view, edit/delete habits, habit categories (health, productivity, learning, mindfulness), weekly/monthly progress charts, motivational quotes, data stored in localStorage, dark mode, responsive design, clean minimal UI.',
    category: 'dashboard',
    tags: ['React', 'Tailwind', 'Habits'],
    difficulty: 'beginner',
    icon: 'i-ph:target-duotone',
    gradient: 'from-emerald-500 to-teal-600',
  },
];
