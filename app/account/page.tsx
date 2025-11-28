import dynamic from 'next/dynamic';
import dkMessages from '../../messages/dk.json';
import enMessages from '../../messages/en.json';

// Translation function
function useTranslations() {
  const language = typeof window !== 'undefined' ? (localStorage.getItem('language') || 'dk') : 'dk';

  const t = (key: string) => {
    const keys = key.split('.');
    const messages = language === 'dk' ? dkMessages : enMessages;
    let value: any = messages;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return t;
}

const AccountClient = dynamic(() => import("@/components/account-client"), {
  ssr: false,
  loading: () => {
    const t = useTranslations();
    return (
      <div className="min-h-screen pt-20 pb-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">{t('account.loading')}</p>
          </div>
        </div>
      </div>
    );
  }
});

export default function AccountPage() {
  return <AccountClient />;
}
