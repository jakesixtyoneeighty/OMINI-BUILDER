import { useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { getSupabase } from '~/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      navigate('/');
      return;
    }
    // Supabase JS auto-detects session in URL when detectSessionInUrl is true.
    // We just wait briefly for the session to settle, then go home.
    const timeout = setTimeout(() => navigate('/'), 800);
    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center w-full h-screen bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary">
      <div className="text-center">
        <div className="i-svg-spinners:90-ring-with-bg text-3xl mx-auto mb-2" />
        <div>Signing you in…</div>
      </div>
    </div>
  );
}
