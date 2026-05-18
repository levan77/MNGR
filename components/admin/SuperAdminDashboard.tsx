'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  Building2, ChevronRight, LogOut, ArrowLeft,
  Plus, Trash2, Pencil, Save, X, ExternalLink,
  TrendingUp, Trophy, Activity, RefreshCw, Globe, Languages, Search, RotateCcw,
} from 'lucide-react';
import { logoutAction } from '@/app/admin/login/actions';
import {
  getAllSalons, getSalons, createSalon, updateSalon, deleteSalon,
  getNetworkStats, getRecentActivity,
  setSalonSubscription, getSalonBranches, createBranch, applyMultiTenantMigration,
  type DBSalon, type NetworkStats, type ActivityBooking, type BranchRow,
} from '@/app/admin/actions';
import AdminDashboard from './AdminDashboard';
import { useLanguage } from '@/lib/LanguageContext';
import { translations, type TranslationKey } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

type EditForm = {
  name: string; slug: string; city: string;
  address: string; adminUsername: string; adminPassword: string;
};

const EMPTY_FORM: EditForm = {
  name: '', slug: '', city: '', address: '', adminUsername: '', adminPassword: '',
};

// ─── Status pill colours ──────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-300 border border-blue-500/30',
  completed:  'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  no_show:    'bg-red-500/10 text-red-400 border border-red-500/30',
  cancelled:  'bg-neutral-800 text-neutral-500 border border-neutral-700',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden border p-5 flex flex-col gap-3 ${
      accent ? 'border-amber-600/40 bg-gradient-to-br from-amber-950/30 to-neutral-950' : 'border-neutral-800 bg-neutral-950'
    }`}>
      {accent && <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />}
      <div className="flex items-start justify-between">
        <p className="text-[10px] text-neutral-500 tracking-widest uppercase">{label}</p>
        <span className={`${accent ? 'text-amber-500' : 'text-neutral-600'}`}>{icon}</span>
      </div>
      <div>
        <p className={`text-3xl font-display tracking-wider leading-none ${accent ? 'text-amber-300' : 'text-neutral-100'}`}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-neutral-600 mt-1.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed({
  items, loading, onRefresh,
}: {
  items: ActivityBooking[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="border border-neutral-800 bg-neutral-950">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <Activity size={14} className="text-neutral-500" />
          <p className="text-[11px] text-neutral-300 tracking-widest uppercase">{t('live_activity')}</p>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>
        <button onClick={onRefresh} disabled={loading} className="p-1.5 text-neutral-600 hover:text-neutral-300 transition-colors disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_90px_80px] gap-4 px-5 py-2 border-b border-neutral-800/60">
        {[t('col_client'), t('col_service'), t('col_location'), t('col_date'), t('col_status')].map(h => (
          <p key={h} className="text-[10px] text-neutral-600 uppercase tracking-widest">{h}</p>
        ))}
      </div>

      <div className="divide-y divide-neutral-800/50 max-h-[480px] overflow-y-auto">
        {loading && items.length === 0 && (
          <p className="text-center text-neutral-600 text-xs py-10 tracking-wider">{t('loading')}</p>
        )}
        {!loading && items.length === 0 && (
          <p className="text-center text-neutral-700 text-xs py-10 tracking-wider">{t('no_bookings_yet')}</p>
        )}
        {items.map((b, i) => (
          <div key={b.id} className={`px-5 py-3 transition-colors hover:bg-neutral-900/50 ${i === 0 && !loading ? 'bg-neutral-900/30' : ''}`}>
            <div className="sm:hidden space-y-0.5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-200">{b.client_name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_PILL[b.status] ?? STATUS_PILL.cancelled}`}>{b.status}</span>
              </div>
              <p className="text-xs text-neutral-500">{b.service_name} · {b.salon_name}</p>
              <p className="text-[10px] text-neutral-600">{b.date} {b.time} · {b.reference}</p>
            </div>
            <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_90px_80px] gap-4 items-center">
              <div className="min-w-0">
                <p className="text-sm text-neutral-200 truncate">{b.client_name}</p>
                <p className="text-[10px] text-neutral-600 truncate">{b.reference}</p>
              </div>
              <p className="text-xs text-neutral-400 truncate">{b.service_name}</p>
              <p className="text-xs text-neutral-500 truncate">{b.salon_name}</p>
              <p className="text-[11px] text-neutral-600 tabular-nums">{b.date}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full text-center ${STATUS_PILL[b.status] ?? STATUS_PILL.cancelled}`}>{b.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  salons, stats, activity, analyticsLoading, onRefreshActivity, onOpenSalon,
}: {
  salons: DBSalon[];
  stats: NetworkStats | null;
  activity: ActivityBooking[];
  analyticsLoading: boolean;
  onRefreshActivity: () => void;
  onOpenSalon: (id: string) => void;
}) {
  const { t } = useLanguage();
  const topSalonName = stats?.topSalon
    ? (salons.find(s => s.id === stats.topSalon!.department_id)?.name ?? '—') : '—';

  const kpis = [
    { label: t('active_salons'), value: stats?.totalSalons ?? '—', icon: <Building2 size={16} />, sub: salons.length > 0 ? salons.map(s => s.name).join(', ') : undefined },
    { label: t('network_revenue'), value: stats ? `₾${stats.globalRevenue.toLocaleString()}` : '—', icon: <TrendingUp size={16} />, sub: t('completed_bookings_only') },
    { label: t('top_performer'), value: topSalonName, icon: <Trophy size={16} />, sub: stats?.topSalon ? `${stats.topSalon.completed_count} ${t('completed_count_sub')}` : t('no_data_yet'), accent: true },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      <ActivityFeed items={activity} loading={analyticsLoading} onRefresh={onRefreshActivity} />

      {salons.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-neutral-600 tracking-widest uppercase px-0.5">{t('all_locations')}</p>
          {salons.map(s => (
            <button
              key={s.id}
              onClick={() => onOpenSalon(s.id)}
              className="w-full flex items-center justify-between p-4 border border-neutral-800 hover:border-neutral-600 bg-neutral-950 hover:bg-neutral-900 transition-colors group text-left"
            >
              <div className="flex items-center gap-3">
                <Building2 size={15} className="text-neutral-600 group-hover:text-neutral-300 transition-colors shrink-0" />
                <div>
                  <p className="text-sm text-neutral-200">{s.name}</p>
                  <p className="text-[11px] text-neutral-600 mt-0.5">/{s.slug}{s.city ? ` · ${s.city}` : ''}</p>
                </div>
              </div>
              <ChevronRight size={15} className="text-neutral-700 group-hover:text-neutral-400 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {salons.length === 0 && !analyticsLoading && (
        <div className="border border-neutral-800 p-10 text-center">
          <p className="text-neutral-600 text-sm">{t('no_salons_yet')}</p>
          <p className="text-neutral-700 text-xs mt-1">
            {t('switch_to_manage')} <span className="text-neutral-400">{t('manage_salons_link')}</span> {t('to_add_first')}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Translation Editor ───────────────────────────────────────────────────────

function TranslationEditor() {
  const { t, overrides, persistOverrides, resetOverrides, lang } = useLanguage();
  const [localEdits, setLocalEdits]   = useState<Partial<Record<TranslationKey, string>>>({});
  const [search, setSearch]           = useState('');
  const [toast,  setToast]            = useState(false);
  const [dirty,  setDirty]            = useState(false);

  // Sync from context on mount / context change
  useEffect(() => { setLocalEdits(overrides); }, [overrides]);

  const allKeys = Object.keys(translations.en) as TranslationKey[];
  const filtered = search.trim()
    ? allKeys.filter(k =>
        k.toLowerCase().includes(search.toLowerCase()) ||
        (translations.en[k] as string).toLowerCase().includes(search.toLowerCase()) ||
        (translations.ka[k] as string).toLowerCase().includes(search.toLowerCase()) ||
        (localEdits[k] ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : allKeys;

  function handleChange(key: TranslationKey, value: string) {
    setLocalEdits(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    // Strip entries that match the default so overrides stay lean
    const cleaned: Partial<Record<TranslationKey, string>> = {};
    for (const [k, v] of Object.entries(localEdits) as [TranslationKey, string][]) {
      const defaultVal = (translations[lang] as Record<string, string>)[k] ?? (translations.en as Record<string, string>)[k];
      if (v.trim() && v !== defaultVal) cleaned[k] = v;
    }
    persistOverrides(cleaned);
    setDirty(false);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }

  function handleReset() {
    resetOverrides();
    setLocalEdits({});
    setDirty(false);
  }

  return (
    <div className="space-y-4 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900/90 border border-emerald-700 text-emerald-300 text-xs px-4 py-2.5 rounded-sm shadow-xl tracking-wider">
          ✓ {t('translation_saved_toast')}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-neutral-200 text-sm font-medium tracking-wide flex items-center gap-2">
            <Languages size={15} className="text-neutral-500" />
            {t('translation_editor_title')}
          </p>
          <p className="text-[11px] text-neutral-600 mt-1">{t('translation_editor_sub')}</p>
          <p className="text-[10px] text-amber-700 mt-0.5">{t('translation_override_note')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {dirty && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-neutral-100 text-black hover:bg-white transition-colors font-medium tracking-wider"
            >
              <Save size={12} /> {t('translation_save_all')}
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 text-xs border border-neutral-700 text-neutral-500 hover:border-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <RotateCcw size={12} /> {t('translation_reset')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('translation_search')}
          className="w-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs pl-8 pr-3 py-2 focus:outline-none focus:border-neutral-600"
        />
      </div>

      {/* Table */}
      <div className="border border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[180px_1fr_1fr] gap-px bg-neutral-800">
          {[t('translation_key'), t('translation_en'), t('translation_ka')].map(h => (
            <div key={h} className="bg-neutral-950 px-3 py-2">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{h}</p>
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-neutral-800/60 max-h-[600px] overflow-y-auto">
          {filtered.map(key => {
            const enDefault = (translations.en as Record<string, string>)[key] ?? '';
            const kaDefault = (translations.ka as Record<string, string>)[key] ?? '';
            const currentKa = localEdits[key] ?? kaDefault;
            const isOverridden = (overrides[key] !== undefined) && overrides[key] !== kaDefault;

            return (
              <div key={key} className={`grid grid-cols-[180px_1fr_1fr] gap-px bg-neutral-800 ${isOverridden ? 'bg-amber-900/10' : ''}`}>
                {/* Key */}
                <div className="bg-neutral-950 px-3 py-2 flex items-start gap-1.5">
                  {isOverridden && <span className="text-amber-500 text-[10px] mt-0.5 shrink-0">●</span>}
                  <span className="text-[10px] text-neutral-600 font-mono break-all">{key}</span>
                </div>
                {/* EN (read-only reference) */}
                <div className="bg-neutral-950 px-3 py-2">
                  <p className="text-xs text-neutral-500 leading-relaxed">{enDefault}</p>
                </div>
                {/* KA (editable) */}
                <div className="bg-neutral-950 px-2 py-1.5">
                  <textarea
                    value={currentKa}
                    onChange={e => handleChange(key, e.target.value)}
                    rows={currentKa.length > 60 ? 3 : 1}
                    className={`w-full bg-transparent border rounded-sm px-2 py-1 text-xs focus:outline-none resize-none leading-relaxed transition-colors ${
                      isOverridden
                        ? 'border-amber-800/50 text-amber-200 focus:border-amber-600'
                        : 'border-neutral-800 text-neutral-300 focus:border-neutral-600'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-neutral-700">
        {filtered.length} / {allKeys.length} {lang === 'ka' ? 'გასაღები' : 'keys'}
      </p>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const { t, toggleLang, lang } = useLanguage();
  const [view, setView]             = useState<'overview' | 'salons' | 'translations'>('overview');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [salons, setSalons]         = useState<DBSalon[]>([]);
  const [stats, setStats]           = useState<NetworkStats | null>(null);
  const [activity, setActivity]     = useState<ActivityBooking[]>([]);
  const [salonsLoading, setSalonsLoading]       = useState(true);
  const [analyticsLoading, startAnalytics]      = useTransition();
  const cancelledRef = useRef(false);

  async function loadSalons() {
    cancelledRef.current = false;
    setSalonsLoading(true);
    try {
      // getAllSalons includes subscription fields; falls back to getSalons if migration not yet run
      const fresh = await getAllSalons().catch(() => getSalons());
      if (cancelledRef.current) return;
      setSalons(fresh);
    } catch (e) {
      console.error('Salons load failed', e);
    } finally {
      if (!cancelledRef.current) setSalonsLoading(false);
    }
  }

  function loadAnalytics() {
    startAnalytics(async () => {
      try {
        const [s, a] = await Promise.all([
          getNetworkStats().catch(() => null),
          getRecentActivity(10).catch(() => []),
        ]);
        if (cancelledRef.current) return;
        if (s) setStats(s);
        setActivity(a);
      } catch (e) {
        console.error('Analytics load failed', e);
      }
    });
  }

  useEffect(() => {
    loadSalons();
    loadAnalytics();
    return () => { cancelledRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSalon = selectedId ? salons.find(s => s.id === selectedId) ?? null : null;

  return (
    <div className="min-h-screen bg-black flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <a href="/" className="text-xl font-display tracking-[0.3em] text-neutral-100">ATELIER</a>
          {selectedSalon && (
            <>
              <span className="text-neutral-700 text-lg">/</span>
              <button
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1.5 text-neutral-500 text-xs tracking-widest uppercase hover:text-neutral-100 transition-colors"
              >
                <ArrowLeft size={12} /> {t('all_salons_back')}
              </button>
              <span className="text-neutral-700 text-lg">/</span>
              <span className="text-neutral-300 text-xs tracking-wider">{selectedSalon.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-neutral-600 text-[10px] tracking-widest uppercase hidden sm:block">{t('master_admin')}</span>
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 text-neutral-500 text-xs tracking-widest uppercase hover:text-neutral-100 transition-colors"
            title={lang === 'ka' ? 'Switch to English' : 'გადართვა ქართულზე'}
          >
            <Globe size={13} />
            {lang === 'ka' ? 'EN' : 'KA'}
          </button>
          <form action={logoutAction}>
            <button type="submit" className="flex items-center gap-2 text-neutral-500 text-xs tracking-widest uppercase hover:text-neutral-100 transition-colors">
              <LogOut size={14} /> {t('logout')}
            </button>
          </form>
        </div>
      </header>

      {selectedId ? (
        <AdminDashboard departmentId={selectedId} showHeader={false} />
      ) : (
        <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full space-y-6">

          {/* Tab nav */}
          <nav className="flex gap-1 border-b border-neutral-800">
            {(['overview', 'salons', 'translations'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-4 py-3 text-[11px] tracking-widest uppercase border-b-2 transition-colors ${
                  view === v ? 'border-neutral-100 text-neutral-100' : 'border-transparent text-neutral-600 hover:text-neutral-300'
                }`}
              >
                {v === 'translations' && <Languages size={12} />}
                {v === 'overview'      ? t('overview')
                  : v === 'salons'     ? t('manage_salons')
                  : t('translations_tab')}
              </button>
            ))}
          </nav>

          {salonsLoading && view !== 'translations' ? (
            <p className="text-neutral-600 text-sm text-center py-16 tracking-widest">{t('loading')}</p>
          ) : view === 'overview' ? (
            <OverviewTab
              salons={salons} stats={stats} activity={activity}
              analyticsLoading={analyticsLoading}
              onRefreshActivity={loadAnalytics}
              onOpenSalon={setSelectedId}
            />
          ) : view === 'salons' ? (
            <SalonsView salons={salons} onChange={loadSalons} />
          ) : (
            <TranslationEditor />
          )}
        </main>
      )}
    </div>
  );
}

// ─── Subscription badge ───────────────────────────────────────────────────────

const SUB_STYLE: Record<string, string> = {
  trial:     'bg-amber-950/40 border-amber-800/60 text-amber-400',
  active:    'bg-emerald-950/40 border-emerald-800/60 text-emerald-400',
  suspended: 'bg-red-950/40 border-red-800/60 text-red-400',
};

function SubBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const label = status === 'active' ? t('status_active') : status === 'suspended' ? t('status_suspended') : t('status_trial');
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-sm border uppercase tracking-wider font-medium ${SUB_STYLE[status] ?? SUB_STYLE.trial}`}>
      {label}
    </span>
  );
}

// ─── Salons Management View ───────────────────────────────────────────────────

function SalonsView({ salons, onChange }: { salons: DBSalon[]; onChange: () => void | Promise<void> }) {
  const { t } = useLanguage();
  const [adding, setAdding]         = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [branches, setBranches]     = useState<Record<string, BranchRow[]>>({});
  const [addingBranch, setAddingBranch] = useState<string | null>(null); // salonId
  const [branchForm, setBranchForm] = useState({ name: '', slug: '', city: '', address: '' });
  const [form, setForm]             = useState<EditForm & { plan: string; ownerEmail: string }>(
    { ...EMPTY_FORM, plan: 'starter', ownerEmail: '' }
  );
  const [error, setError]           = useState<string | null>(null);
  const [toast, setToast]           = useState<string | null>(null);
  const [pending, startTransition]  = useTransition();
  const [migrating, setMigrating]   = useState(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function startCreate() { setForm({ ...EMPTY_FORM, plan: 'starter', ownerEmail: '' }); setError(null); setAdding(true); setEditingId(null); }

  function startEdit(s: DBSalon) {
    setForm({ name: s.name, slug: s.slug, city: s.city, address: s.address, adminUsername: s.admin_username, adminPassword: '', plan: s.subscription_plan ?? 'starter', ownerEmail: s.owner_email ?? '' });
    setError(null); setEditingId(s.id); setAdding(false);
  }

  function cancel() { setAdding(false); setEditingId(null); setForm({ ...EMPTY_FORM, plan: 'starter', ownerEmail: '' }); setError(null); }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        if (adding) {
          const result = await createSalon({ name: form.name, slug: form.slug || undefined, city: form.city, address: form.address, adminUsername: form.adminUsername, adminPassword: form.adminPassword, subscription_plan: form.plan, owner_email: form.ownerEmail || undefined } as Parameters<typeof createSalon>[0]);
          if (!result.ok) { setError(result.error); return; }
          showToast(t('salon_created'));
        } else if (editingId) {
          const result = await updateSalon(editingId, { name: form.name, slug: form.slug, city: form.city, address: form.address, adminUsername: form.adminUsername, adminPassword: form.adminPassword || undefined });
          if (!result.ok) { setError(result.error); return; }
        }
        await onChange();
        cancel();
      } catch (e) { setError(String(e)); }
    });
  }

  function handleDelete(s: DBSalon) {
    if (!confirm(t('delete_salon_confirm').replace('{name}', s.name))) return;
    startTransition(async () => {
      try { await deleteSalon(s.id); await onChange(); }
      catch (e) { alert(t('failed_delete') + String(e)); }
    });
  }

  async function handleToggleExpand(salonId: string) {
    if (expandedId === salonId) { setExpandedId(null); return; }
    setExpandedId(salonId);
    if (!branches[salonId]) {
      const rows = await getSalonBranches(salonId).catch(() => []);
      setBranches(prev => ({ ...prev, [salonId]: rows }));
    }
  }

  function handleSetStatus(salonId: string, status: 'trial' | 'active' | 'suspended') {
    startTransition(async () => {
      try {
        await setSalonSubscription(salonId, status);
        await onChange();
      } catch (e) { alert(String(e)); }
    });
  }

  function handleAddBranch(salonId: string) {
    setBranchForm({ name: '', slug: '', city: '', address: '' });
    setAddingBranch(salonId);
  }

  function handleBranchSubmit(salonId: string) {
    startTransition(async () => {
      try {
        const result = await createBranch({ salonId, name: branchForm.name, slug: branchForm.slug || branchForm.name, city: branchForm.city, address: branchForm.address });
        if (!result.ok) { alert(result.error); return; }
        setBranches(prev => ({ ...prev, [salonId]: [...(prev[salonId] ?? []), result.branch] }));
        setAddingBranch(null);
        showToast(t('branch_created'));
      } catch (e) { alert(String(e)); }
    });
  }

  async function handleRunMigration() {
    setMigrating(true);
    try {
      const result = await applyMultiTenantMigration();
      if (result.ok) { showToast(result.message); await onChange(); }
      else alert(result.error);
    } catch (e) { alert(String(e)); }
    finally { setMigrating(false); }
  }

  const showForm = adding || editingId !== null;

  return (
    <div className="space-y-4 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900/90 border border-emerald-700 text-emerald-300 text-xs px-4 py-2.5 rounded-sm shadow-xl tracking-wider">
          ✓ {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-neutral-600 text-[10px] tracking-widest uppercase mb-1">{t('manage_salons')}</p>
          <h2 className="text-2xl font-display text-neutral-100 tracking-wider">{t('all_salons_title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunMigration}
            disabled={migrating}
            title="Run DB migration to add subscription & branches tables"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] border border-neutral-700 text-neutral-600 hover:border-amber-700 hover:text-amber-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={migrating ? 'animate-spin' : ''} /> {t('run_migration')}
          </button>
          {!showForm && (
            <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 text-[11px] border border-neutral-700 text-neutral-500 hover:border-neutral-400 hover:text-neutral-200 transition-colors">
              <Plus size={12} /> {t('new_salon')}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="border border-neutral-600 bg-neutral-950 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-neutral-300 text-[11px] tracking-wider uppercase">{adding ? t('new_salon_form') : t('edit_salon_form')}</p>
            <button onClick={cancel} className="text-neutral-600 hover:text-neutral-200 transition-colors"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('salon_name')}    value={form.name}          onChange={v => setForm(f => ({ ...f, name: v }))}          placeholder="Tbilisi Flagship" />
            <Field label={t('salon_slug')}    value={form.slug}          onChange={v => setForm(f => ({ ...f, slug: v }))}          placeholder="auto from name" hint="domain.ge/{slug}" />
            <Field label={t('salon_city')}    value={form.city}          onChange={v => setForm(f => ({ ...f, city: v }))}          placeholder="Tbilisi" />
            <Field label={t('salon_address')} value={form.address}       onChange={v => setForm(f => ({ ...f, address: v }))}       placeholder="Rustaveli 12" />
            <Field label={t('admin_username')} value={form.adminUsername} onChange={v => setForm(f => ({ ...f, adminUsername: v }))} placeholder="tbilisi" />
            <Field label={adding ? t('admin_password_new') : t('admin_password_change')} value={form.adminPassword} onChange={v => setForm(f => ({ ...f, adminPassword: v }))} type="password" />
            {adding && (
              <>
                <div className="space-y-1">
                  <label className="text-neutral-600 text-[11px]">{t('plan_label')}</label>
                  <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs px-3 py-2 focus:outline-none focus:border-neutral-400">
                    <option value="starter">{t('plan_starter')}</option>
                    <option value="pro">{t('plan_pro')}</option>
                    <option value="enterprise">{t('plan_enterprise')}</option>
                  </select>
                </div>
                <Field label={t('owner_email')} value={form.ownerEmail} onChange={v => setForm(f => ({ ...f, ownerEmail: v }))} placeholder="owner@salon.ge" />
              </>
            )}
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={cancel} className="px-4 py-2 text-[11px] border border-neutral-700 text-neutral-500 hover:text-neutral-200 transition-colors">{t('cancel')}</button>
            <button onClick={handleSubmit} disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-[11px] bg-neutral-100 text-black hover:bg-white transition-colors disabled:opacity-50">
              <Save size={12} /> {adding ? t('create_btn') : t('save_btn')}
            </button>
          </div>
        </div>
      )}

      {salons.length === 0 && !showForm && (
        <div className="border border-neutral-800 p-10 text-center">
          <p className="text-neutral-600 text-sm">{t('no_salons_yet')} <span className="text-neutral-300">{t('new_salon')}</span></p>
        </div>
      )}

      <div className="space-y-2">
        {salons.map(s => {
          const isExpanded = expandedId === s.id;
          const salonBranches = branches[s.id] ?? [];
          return (
            <div key={s.id} className="border border-neutral-800 bg-neutral-950">
              {/* Salon row */}
              <div className="p-4 flex items-center justify-between gap-4">
                <button
                  onClick={() => handleToggleExpand(s.id)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <ChevronRight size={14} className={`text-neutral-600 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-neutral-200">{s.name}</p>
                      <SubBadge status={s.subscription_status ?? 'trial'} />
                      <span className="text-[10px] text-neutral-600 uppercase">{s.subscription_plan ?? 'starter'}</span>
                    </div>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      <a href={`/${s.slug}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 hover:text-neutral-300 transition-colors">
                        /{s.slug} <ExternalLink size={10} />
                      </a>
                      {s.city && <span> · {s.city}</span>}
                      {' · '}admin: {s.admin_username}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {(s.subscription_status ?? 'trial') !== 'active' && (
                    <button onClick={() => handleSetStatus(s.id, 'active')} disabled={pending} className="px-2 py-1 text-[10px] border border-emerald-800/50 text-emerald-500 hover:bg-emerald-950/40 transition-colors disabled:opacity-40 uppercase tracking-wider">
                      {t('activate')}
                    </button>
                  )}
                  {(s.subscription_status ?? 'trial') === 'active' && (
                    <button onClick={() => handleSetStatus(s.id, 'suspended')} disabled={pending} className="px-2 py-1 text-[10px] border border-red-800/50 text-red-500 hover:bg-red-950/40 transition-colors disabled:opacity-40 uppercase tracking-wider">
                      {t('suspend')}
                    </button>
                  )}
                  <button onClick={() => startEdit(s)} disabled={pending} className="p-2 text-neutral-600 hover:text-neutral-200 transition-colors disabled:opacity-40"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(s)} disabled={pending} className="p-2 text-neutral-700 hover:text-red-400 transition-colors disabled:opacity-40"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Branches drawer */}
              {isExpanded && (
                <div className="border-t border-neutral-800 px-6 py-3 space-y-2 bg-neutral-900/30">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-neutral-600 uppercase tracking-widest">{t('branches')}</p>
                    <button
                      onClick={() => handleAddBranch(s.id)}
                      className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-200 border border-neutral-700 px-2 py-1 transition-colors"
                    >
                      <Plus size={10} /> {t('add_branch')}
                    </button>
                  </div>
                  {salonBranches.map(br => (
                    <div key={br.id} className="flex items-center gap-3 text-xs text-neutral-500 py-1 border-b border-neutral-800/40 last:border-0">
                      <Building2 size={12} className="text-neutral-700 shrink-0" />
                      <span className="text-neutral-300">{br.name}</span>
                      <a href={`/${br.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-300 transition-colors">
                        /{br.slug} <ExternalLink size={9} />
                      </a>
                      {br.city && <span>· {br.city}</span>}
                    </div>
                  ))}
                  {salonBranches.length === 0 && (
                    <p className="text-neutral-700 text-xs">{t('no_salons_yet')}</p>
                  )}

                  {/* Add branch form */}
                  {addingBranch === s.id && (
                    <div className="pt-2 space-y-2 border-t border-neutral-800">
                      <div className="grid grid-cols-2 gap-2">
                        <Field label={t('branch_name')} value={branchForm.name} onChange={v => setBranchForm(f => ({ ...f, name: v }))} placeholder="Vake Branch" />
                        <Field label={t('booking_slug')} value={branchForm.slug} onChange={v => setBranchForm(f => ({ ...f, slug: v }))} placeholder="auto from name" />
                        <Field label={t('salon_city')} value={branchForm.city} onChange={v => setBranchForm(f => ({ ...f, city: v }))} placeholder="Tbilisi" />
                        <Field label={t('salon_address')} value={branchForm.address} onChange={v => setBranchForm(f => ({ ...f, address: v }))} placeholder="Vake 5" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setAddingBranch(null)} className="px-3 py-1.5 text-[11px] border border-neutral-700 text-neutral-500 hover:text-neutral-200 transition-colors">{t('cancel')}</button>
                        <button onClick={() => handleBranchSubmit(s.id)} disabled={pending || !branchForm.name.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-neutral-200 text-black hover:bg-white transition-colors disabled:opacity-50">
                          <Save size={11} /> {t('create_btn')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, hint, type }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-neutral-600 text-[11px]">{label}</label>
      <input
        type={type ?? 'text'} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs px-3 py-2 focus:outline-none focus:border-neutral-400"
      />
      {hint && <p className="text-neutral-700 text-[10px]">{hint}</p>}
    </div>
  );
}
