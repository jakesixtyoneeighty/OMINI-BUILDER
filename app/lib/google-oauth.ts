// Configuração do Google OAuth — usado pelo login normal e pelo Save to Drive
// No Cloudflare Pages, configure a variável VITE_GOOGLE_CLIENT_ID com o Client ID do seu projeto no Google Cloud Console.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const googleDriveEnabled = !!GOOGLE_CLIENT_ID;
