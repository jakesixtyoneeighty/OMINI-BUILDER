/**
 * Omni-Builder i18n Translation System
 * All UI text is keyed here. Components use t('key') to get localized strings.
 */

export type AppLanguage = 'pt' | 'en' | 'es' | 'zh';

export const translations: Record<AppLanguage, Record<string, string>> = {
  pt: {
    // === Landing Page ===
    'landing.headline': 'O que voce vai',
    'landing.headlineAccent': 'construir',
    'landing.headlineEnd': 'hoje?',
    'landing.subtitle': 'Crie apps e sites incriveis conversando com IA.',
    'landing.letsBuild': 'Vamos construir',
    'landing.placeholder': 'Como o Omni-Builder pode te ajudar hoje? (digite @ para mencionar um arquivo)',
    'landing.orStartFrom': 'ou comece de',
    'landing.buildNow': 'Construir agora',
    'landing.standard': 'Padrao',
    'landing.designSystem': 'Design System',
    'landing.plan': 'Plano',
    'landing.searchProjects': 'Buscar projetos...',
    'landing.recentlyViewed': 'Vistos Recentemente',
    'landing.noRecentProjects': 'Nenhum projeto recente',
    'landing.startCreating': 'Comece a criar para ver seus projetos aqui!',

    // === Header ===
    'header.home': 'Inicio',
    'header.more': 'Mais',
    'header.lightMode': 'Modo Claro',
    'header.darkMode': 'Modo Escuro',
    'header.apiKeysSettings': 'Chaves API & Configuracoes',
    'header.projectSettings': 'Configuracoes do Projeto',
    'header.gallery': 'Galeria',
    'header.community': 'Comunidade',
    'header.enterprise': 'Empresa',
    'header.resources': 'Recursos',
    'header.documentation': 'Documentacao',

    // === Deploy ===
    'deploy.button': 'Deploy',
    'deploy.deploying': 'Fazendo deploy...',
    'deploy.deployed': 'Deployed!',
    'deploy.projectDeploy': 'Deploy do Projeto',
    'deploy.updateNetlify': 'Atualizar site no Netlify',
    'deploy.publishNetlify': 'Publicar no Netlify',
    'deploy.updateOnNetlify': 'Atualizar no Netlify',
    'deploy.publishOnNetlify': 'Publicar no Netlify',
    'deploy.sameUrlUpdate': 'Mesmo URL — atualiza o site existente',
    'deploy.createNewSite': 'Cria um novo site no Netlify',
    'deploy.default': 'Padrao',
    'deploy.deployWithAI': 'Deploy com IA',
    'deploy.deployWithAIDesc': 'Pede para IA preparar e fazer o deploy',
    'deploy.previewOmni': 'Preview Omni Builder',
    'deploy.previewOmniDesc': 'Preview ao vivo com WebContainer',
    'deploy.others': 'Outros',
    'deploy.configureProviders': 'Configurar Provedores',
    'deploy.lastDeploy': 'Ultimo deploy',
    'deploy.successNetlify': 'Deploy no Netlify realizado!',
    'deploy.siteUpdated': 'Site atualizado (mesmo URL)',
    'deploy.successOmni': 'Deploy realizado pelo Omni Builder!',
    'deploy.successGeneric': 'Deploy realizado com sucesso!',
    'deploy.failed': 'Falha no deploy',

    // === Chat ===
    'chat.stop': 'Parar',
    'chat.send': 'Enviar',

    // === Settings ===
    'settings.general': 'Geral',
    'settings.preview': 'Preview',
    'settings.deploy': 'Deploy',
    'settings.env': 'Variaveis de Ambiente',
    'settings.versions': 'Versoes',
    'settings.close': 'Fechar',
    'settings.save': 'Salvar',
    'settings.cancel': 'Cancelar',

    // === Auth ===
    'auth.login': 'Entrar',
    'auth.logout': 'Sair',
    'auth.signUp': 'Criar Conta',

    // === Workbench / Editor ===
    'workbench.terminal': 'Terminal',
    'workbench.editor': 'Editor',
    'workbench.preview': 'Preview',
    'workbench.newTab': 'Abrir em nova aba',
    'workbench.refresh': 'Atualizar',

    // === File Tree ===
    'filetree.newFile': 'Novo Arquivo',
    'filetree.newFolder': 'Nova Pasta',

    // === Project ===
    'project.untitled': 'Sem titulo',
    'project.loading': 'Carregando Projeto',
    'project.restoring': 'Restaurando arquivos e configuracoes...',

    // === Error Banner ===
    'error.fix': 'Corrigir',

    // === GitHub Import ===
    'github.import': 'Importar do GitHub',

    // === Clone Site ===
    'clone.title': 'Clonar Site',

    // === Save ===
    'save.project': 'Salvar Projeto',
    'save.googleDrive': 'Salvar no Google Drive',

    // === Gallery ===
    'gallery.title': 'Galeria',
    'gallery.empty': 'Nenhum projeto publicado ainda',

    // === Common ===
    'common.loading': 'Carregando...',
    'common.error': 'Erro',
    'common.success': 'Sucesso',
    'common.retry': 'Tentar novamente',
    'common.delete': 'Excluir',
    'common.edit': 'Editar',
    'common.save': 'Salvar',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.close': 'Fechar',
    'common.yes': 'Sim',
    'common.no': 'Nao',

    // === Toast messages ===
    'toast.projectRestored': 'Projeto restaurado para o estado anterior ao erro.',
    'toast.filesImported': 'arquivo(s) importado(s) com sucesso!',
    'toast.noFilesImported': 'Nenhum arquivo pode ser escrito.',
    'toast.importError': 'Erro na importacao',

    // === Model Picker ===
    'model.selectProvider': 'Selecionar provedor',
    'model.selectModel': 'Selecionar modelo',
    'model.customKey': 'Chave API personalizada',

    // === Search ===
    'search.placeholder': 'Buscar projetos...',

    // === Inspector ===
    'inspector.selectElement': 'Selecionar elemento',
    'inspector.clearAll': 'Limpar todos',
  },

  en: {
    // === Landing Page ===
    'landing.headline': 'What will you',
    'landing.headlineAccent': 'build',
    'landing.headlineEnd': 'today?',
    'landing.subtitle': 'Create stunning apps & websites by chatting with AI.',
    'landing.letsBuild': "Let's build",
    'landing.placeholder': 'How can Omni-Builder help you today? (type @ to mention a file)',
    'landing.orStartFrom': 'or start from',
    'landing.buildNow': 'Build now',
    'landing.standard': 'Standard',
    'landing.designSystem': 'Design System',
    'landing.plan': 'Plan',
    'landing.searchProjects': 'Search projects...',
    'landing.recentlyViewed': 'Recently Viewed',
    'landing.noRecentProjects': 'No recent projects',
    'landing.startCreating': 'Start creating to see your projects here!',

    // === Header ===
    'header.home': 'Home',
    'header.more': 'More',
    'header.lightMode': 'Light Mode',
    'header.darkMode': 'Dark Mode',
    'header.apiKeysSettings': 'API Keys & Settings',
    'header.projectSettings': 'Project Settings',
    'header.gallery': 'Gallery',
    'header.community': 'Community',
    'header.enterprise': 'Enterprise',
    'header.resources': 'Resources',
    'header.documentation': 'Documentation',

    // === Deploy ===
    'deploy.button': 'Deploy',
    'deploy.deploying': 'Deploying...',
    'deploy.deployed': 'Deployed!',
    'deploy.projectDeploy': 'Deploy Project',
    'deploy.updateNetlify': 'Update site on Netlify',
    'deploy.publishNetlify': 'Publish to Netlify',
    'deploy.updateOnNetlify': 'Update on Netlify',
    'deploy.publishOnNetlify': 'Publish on Netlify',
    'deploy.sameUrlUpdate': 'Same URL — updates existing site',
    'deploy.createNewSite': 'Creates a new site on Netlify',
    'deploy.default': 'Default',
    'deploy.deployWithAI': 'Deploy with AI',
    'deploy.deployWithAIDesc': 'Ask AI to prepare and deploy',
    'deploy.previewOmni': 'Preview Omni Builder',
    'deploy.previewOmniDesc': 'Live preview with WebContainer',
    'deploy.others': 'Others',
    'deploy.configureProviders': 'Configure Providers',
    'deploy.lastDeploy': 'Last deploy',
    'deploy.successNetlify': 'Deploy to Netlify successful!',
    'deploy.siteUpdated': 'Site updated (same URL)',
    'deploy.successOmni': 'Deploy via Omni Builder successful!',
    'deploy.successGeneric': 'Deploy successful!',
    'deploy.failed': 'Deploy failed',

    // === Chat ===
    'chat.stop': 'Stop',
    'chat.send': 'Send',

    // === Settings ===
    'settings.general': 'General',
    'settings.preview': 'Preview',
    'settings.deploy': 'Deploy',
    'settings.env': 'Environment Variables',
    'settings.versions': 'Versions',
    'settings.close': 'Close',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',

    // === Auth ===
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.signUp': 'Sign Up',

    // === Workbench / Editor ===
    'workbench.terminal': 'Terminal',
    'workbench.editor': 'Editor',
    'workbench.preview': 'Preview',
    'workbench.newTab': 'Open in new tab',
    'workbench.refresh': 'Refresh',

    // === File Tree ===
    'filetree.newFile': 'New File',
    'filetree.newFolder': 'New Folder',

    // === Project ===
    'project.untitled': 'Untitled',
    'project.loading': 'Loading Project',
    'project.restoring': 'Restoring files and settings...',

    // === Error Banner ===
    'error.fix': 'Fix',

    // === GitHub Import ===
    'github.import': 'Import from GitHub',

    // === Clone Site ===
    'clone.title': 'Clone Site',

    // === Save ===
    'save.project': 'Save Project',
    'save.googleDrive': 'Save to Google Drive',

    // === Gallery ===
    'gallery.title': 'Gallery',
    'gallery.empty': 'No projects published yet',

    // === Common ===
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.retry': 'Retry',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.yes': 'Yes',
    'common.no': 'No',

    // === Toast messages ===
    'toast.projectRestored': 'Project restored to previous state before the error.',
    'toast.filesImported': 'file(s) imported successfully!',
    'toast.noFilesImported': 'No files could be written.',
    'toast.importError': 'Import error',

    // === Model Picker ===
    'model.selectProvider': 'Select provider',
    'model.selectModel': 'Select model',
    'model.customKey': 'Custom API key',

    // === Search ===
    'search.placeholder': 'Search projects...',

    // === Inspector ===
    'inspector.selectElement': 'Select element',
    'inspector.clearAll': 'Clear all',
  },

  es: {
    // === Landing Page ===
    'landing.headline': 'Que vas a',
    'landing.headlineAccent': 'construir',
    'landing.headlineEnd': 'hoy?',
    'landing.subtitle': 'Crea apps y sitios web increibles chateando con IA.',
    'landing.letsBuild': 'Vamos a construir',
    'landing.placeholder': 'Como puede ayudarte Omni-Builder hoy? (escribe @ para mencionar un archivo)',
    'landing.orStartFrom': 'o empieza de',
    'landing.buildNow': 'Construir ahora',
    'landing.standard': 'Estandar',
    'landing.designSystem': 'Design System',
    'landing.plan': 'Plan',
    'landing.searchProjects': 'Buscar proyectos...',
    'landing.recentlyViewed': 'Vistos Recientemente',
    'landing.noRecentProjects': 'Sin proyectos recientes',
    'landing.startCreating': 'Comienza a crear para ver tus proyectos aqui!',

    // === Header ===
    'header.home': 'Inicio',
    'header.more': 'Mas',
    'header.lightMode': 'Modo Claro',
    'header.darkMode': 'Modo Oscuro',
    'header.apiKeysSettings': 'Claves API & Configuracion',
    'header.projectSettings': 'Configuracion del Proyecto',
    'header.gallery': 'Galeria',
    'header.community': 'Comunidad',
    'header.enterprise': 'Empresa',
    'header.resources': 'Recursos',
    'header.documentation': 'Documentacion',

    // === Deploy ===
    'deploy.button': 'Deploy',
    'deploy.deploying': 'Desplegando...',
    'deploy.deployed': 'Desplegado!',
    'deploy.projectDeploy': 'Deploy del Proyecto',
    'deploy.updateNetlify': 'Actualizar sitio en Netlify',
    'deploy.publishNetlify': 'Publicar en Netlify',
    'deploy.updateOnNetlify': 'Actualizar en Netlify',
    'deploy.publishOnNetlify': 'Publicar en Netlify',
    'deploy.sameUrlUpdate': 'Mismo URL — actualiza el sitio existente',
    'deploy.createNewSite': 'Crea un nuevo sitio en Netlify',
    'deploy.default': 'Predeterminado',
    'deploy.deployWithAI': 'Deploy con IA',
    'deploy.deployWithAIDesc': 'Pide a la IA preparar y hacer el deploy',
    'deploy.previewOmni': 'Preview Omni Builder',
    'deploy.previewOmniDesc': 'Vista previa con WebContainer',
    'deploy.others': 'Otros',
    'deploy.configureProviders': 'Configurar Proveedores',
    'deploy.lastDeploy': 'Ultimo deploy',
    'deploy.successNetlify': 'Deploy en Netlify realizado!',
    'deploy.siteUpdated': 'Sitio actualizado (mismo URL)',
    'deploy.successOmni': 'Deploy via Omni Builder realizado!',
    'deploy.successGeneric': 'Deploy realizado con exito!',
    'deploy.failed': 'Fallo el deploy',

    // === Chat ===
    'chat.stop': 'Detener',
    'chat.send': 'Enviar',

    // === Settings ===
    'settings.general': 'General',
    'settings.preview': 'Preview',
    'settings.deploy': 'Deploy',
    'settings.env': 'Variables de Entorno',
    'settings.versions': 'Versiones',
    'settings.close': 'Cerrar',
    'settings.save': 'Guardar',
    'settings.cancel': 'Cancelar',

    // === Auth ===
    'auth.login': 'Iniciar sesion',
    'auth.logout': 'Cerrar sesion',
    'auth.signUp': 'Crear cuenta',

    // === Workbench / Editor ===
    'workbench.terminal': 'Terminal',
    'workbench.editor': 'Editor',
    'workbench.preview': 'Preview',
    'workbench.newTab': 'Abrir en nueva pestana',
    'workbench.refresh': 'Actualizar',

    // === File Tree ===
    'filetree.newFile': 'Nuevo Archivo',
    'filetree.newFolder': 'Nueva Carpeta',

    // === Project ===
    'project.untitled': 'Sin titulo',
    'project.loading': 'Cargando Proyecto',
    'project.restoring': 'Restaurando archivos y configuracion...',

    // === Error Banner ===
    'error.fix': 'Corregir',

    // === GitHub Import ===
    'github.import': 'Importar de GitHub',

    // === Clone Site ===
    'clone.title': 'Clonar Sitio',

    // === Save ===
    'save.project': 'Guardar Proyecto',
    'save.googleDrive': 'Guardar en Google Drive',

    // === Gallery ===
    'gallery.title': 'Galeria',
    'gallery.empty': 'No hay proyectos publicados aun',

    // === Common ===
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Exito',
    'common.retry': 'Reintentar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.close': 'Cerrar',
    'common.yes': 'Si',
    'common.no': 'No',

    // === Toast messages ===
    'toast.projectRestored': 'Proyecto restaurado al estado anterior al error.',
    'toast.filesImported': 'archivo(s) importado(s) con exito!',
    'toast.noFilesImported': 'Ningun archivo pudo ser escrito.',
    'toast.importError': 'Error de importacion',

    // === Model Picker ===
    'model.selectProvider': 'Seleccionar proveedor',
    'model.selectModel': 'Seleccionar modelo',
    'model.customKey': 'Clave API personalizada',

    // === Search ===
    'search.placeholder': 'Buscar proyectos...',

    // === Inspector ===
    'inspector.selectElement': 'Seleccionar elemento',
    'inspector.clearAll': 'Limpiar todo',
  },

  zh: {
    // === Landing Page ===
    'landing.headline': '你今天要',
    'landing.headlineAccent': '构建',
    'landing.headlineEnd': '什么？',
    'landing.subtitle': '通过与AI对话，创建令人惊叹的应用和网站。',
    'landing.letsBuild': '开始构建',
    'landing.placeholder': 'Omni-Builder 今天能帮您什么？（输入 @ 提及文件）',
    'landing.orStartFrom': '或从以下开始',
    'landing.buildNow': '开始构建',
    'landing.standard': '标准',
    'landing.designSystem': '设计系统',
    'landing.plan': '计划',
    'landing.searchProjects': '搜索项目...',
    'landing.recentlyViewed': '最近查看',
    'landing.noRecentProjects': '没有最近的项目',
    'landing.startCreating': '开始创建以在此处查看您的项目！',

    // === Header ===
    'header.home': '首页',
    'header.more': '更多',
    'header.lightMode': '浅色模式',
    'header.darkMode': '深色模式',
    'header.apiKeysSettings': 'API 密钥和设置',
    'header.projectSettings': '项目设置',
    'header.gallery': '画廊',
    'header.community': '社区',
    'header.enterprise': '企业',
    'header.resources': '资源',
    'header.documentation': '文档',

    // === Deploy ===
    'deploy.button': '部署',
    'deploy.deploying': '部署中...',
    'deploy.deployed': '已部署！',
    'deploy.projectDeploy': '项目部署',
    'deploy.updateNetlify': '更新 Netlify 站点',
    'deploy.publishNetlify': '发布到 Netlify',
    'deploy.updateOnNetlify': '在 Netlify 上更新',
    'deploy.publishOnNetlify': '发布到 Netlify',
    'deploy.sameUrlUpdate': '相同 URL — 更新现有站点',
    'deploy.createNewSite': '在 Netlify 上创建新站点',
    'deploy.default': '默认',
    'deploy.deployWithAI': 'AI 部署',
    'deploy.deployWithAIDesc': '让 AI 准备并部署',
    'deploy.previewOmni': 'Omni Builder 预览',
    'deploy.previewOmniDesc': '使用 WebContainer 实时预览',
    'deploy.others': '其他',
    'deploy.configureProviders': '配置提供商',
    'deploy.lastDeploy': '上次部署',
    'deploy.successNetlify': 'Netlify 部署成功！',
    'deploy.siteUpdated': '站点已更新（相同 URL）',
    'deploy.successOmni': 'Omni Builder 部署成功！',
    'deploy.successGeneric': '部署成功！',
    'deploy.failed': '部署失败',

    // === Chat ===
    'chat.stop': '停止',
    'chat.send': '发送',

    // === Settings ===
    'settings.general': '常规',
    'settings.preview': '预览',
    'settings.deploy': '部署',
    'settings.env': '环境变量',
    'settings.versions': '版本',
    'settings.close': '关闭',
    'settings.save': '保存',
    'settings.cancel': '取消',

    // === Auth ===
    'auth.login': '登录',
    'auth.logout': '登出',
    'auth.signUp': '注册',

    // === Workbench / Editor ===
    'workbench.terminal': '终端',
    'workbench.editor': '编辑器',
    'workbench.preview': '预览',
    'workbench.newTab': '在新标签页打开',
    'workbench.refresh': '刷新',

    // === File Tree ===
    'filetree.newFile': '新建文件',
    'filetree.newFolder': '新建文件夹',

    // === Project ===
    'project.untitled': '无标题',
    'project.loading': '加载项目',
    'project.restoring': '正在恢复文件和设置...',

    // === Error Banner ===
    'error.fix': '修复',

    // === GitHub Import ===
    'github.import': '从 GitHub 导入',

    // === Clone Site ===
    'clone.title': '克隆网站',

    // === Save ===
    'save.project': '保存项目',
    'save.googleDrive': '保存到 Google Drive',

    // === Gallery ===
    'gallery.title': '画廊',
    'gallery.empty': '暂无已发布的项目',

    // === Common ===
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.retry': '重试',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.close': '关闭',
    'common.yes': '是',
    'common.no': '否',

    // === Toast messages ===
    'toast.projectRestored': '项目已恢复到出错前的状态。',
    'toast.filesImported': '个文件导入成功！',
    'toast.noFilesImported': '无法写入任何文件。',
    'toast.importError': '导入错误',

    // === Model Picker ===
    'model.selectProvider': '选择提供商',
    'model.selectModel': '选择模型',
    'model.customKey': '自定义 API 密钥',

    // === Search ===
    'search.placeholder': '搜索项目...',

    // === Inspector ===
    'inspector.selectElement': '选择元素',
    'inspector.clearAll': '清除全部',
  },
};
