'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Receipt,
  RefreshCw, ArrowUpRight, GitBranch,
} from 'lucide-react';
import { getFinancials, getFinancialsForBranches } from '@/app/admin/actions';
import type { FinancialsResult, StaffFinancialRow, BranchFinancials, BranchRow } from '@/app/admin/actions';
import { localDateString } from '@/lib/dates';
import { useLanguage } from '@/lib/LanguageContext';

// ─── Date Presets ─────────────────────────────────────────────────────────────

function getPresets() {
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = now.getMonth();
  const today = localDateString(now);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);

  const lastMonthStart = new Date(y, m - 1, 1);
  const lastMonthEnd   = new Date(y, m, 0);

  return [
    { key: 'today_preset',  start: today,                               end: today },
    { key: 'this_week',     start: localDateString(weekStart),          end: today },
    { key: 'this_month',    start: localDateString(new Date(y, m, 1)),  end: today },
    { key: 'last_month',    start: localDateString(lastMonthStart),     end: localDateString(lastMonthEnd) },
  ] as const;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, icon: Icon, positive,
}: {
  label: string; value: string; sub?: string;
  accent?: boolean; icon: React.ElementType; positive?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-sm border p-5 flex flex-col gap-3
      ${accent ? 'bg-amber-950/20 border-amber-800/50' : 'bg-neutral-950 border-neutral-800'}`}
    >
      {accent && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(251,191,36,0.06),_transparent_70%)] pointer-events-none" />
      )}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{label}</p>
        <Icon size={14} className={accent ? 'text-amber-500' : 'text-neutral-600'} />
      </div>
      <p className={`text-2xl font-light tracking-tight ${accent ? 'text-amber-300' : 'text-neutral-100'}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-[11px] ${positive === false ? 'text-red-400' : positive ? 'text-emerald-400' : 'text-neutral-600'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Comp Badge ───────────────────────────────────────────────────────────────

const COMP_STYLE: Record<string, string> = {
  commission: 'bg-sky-950/40 border-sky-800/60 text-sky-400',
  salary:     'bg-violet-950/40 border-violet-800/60 text-violet-400',
  hybrid:     'bg-emerald-950/40 border-emerald-800/60 text-emerald-400',
};

function CompBadge({ type }: { type: string }) {
  const { t } = useLanguage();
  const label = type === 'commission' ? t('commission') : type === 'salary' ? t('salary') : t('hybrid');
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-sm border uppercase tracking-wider font-medium ${COMP_STYLE[type] ?? ''}`}>
      {label}
    </span>
  );
}

// ─── Staff Table ──────────────────────────────────────────────────────────────

function StaffTable({ rows }: { rows: StaffFinancialRow[] }) {
  const { t } = useLanguage();
  if (!rows.length) {
    return (
      <p className="text-center text-neutral-600 text-sm py-12 tracking-widest uppercase">
        {t('no_staff_data')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800">
            {[t('col_staff'), t('col_model'), t('col_done'), t('col_revenue'), t('col_projected')].map(h => (
              <th key={h} className="text-left text-[10px] text-neutral-600 uppercase tracking-widest pb-3 pr-6 font-normal">
                {h}
              </th>
            ))}
            <th className="text-left text-[10px] text-neutral-600 uppercase tracking-widest pb-3 pr-6 font-normal">
              {t('col_payout')}
            </th>
            <th className="text-left text-[10px] text-neutral-600 uppercase tracking-widest pb-3 font-normal">
              <span title={t('margin_tooltip')} className="cursor-help underline decoration-dotted decoration-neutral-700">
                {t('col_margin')}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.professional_id} className="border-b border-neutral-900 hover:bg-neutral-900/40 transition-colors">
              <td className="py-3 pr-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-neutral-400 shrink-0 overflow-hidden">
                    {row.avatar
                      ? <img src={row.avatar} alt="" className="w-full h-full object-cover" />
                      : row.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-neutral-200 font-medium whitespace-nowrap">{row.name}</span>
                </div>
              </td>
              <td className="py-3 pr-6"><CompBadge type={row.comp_type} /></td>
              <td className="py-3 pr-6 text-neutral-300">
                {row.completed_count}
                {row.scheduled_count > 0 && (
                  <span className="text-neutral-600 text-xs ml-1">+{row.scheduled_count}</span>
                )}
              </td>
              <td className="py-3 pr-6 text-neutral-200">₾{row.completed_revenue.toLocaleString()}</td>
              <td className="py-3 pr-6 text-neutral-500">
                {row.scheduled_revenue > 0 ? `₾${(row.completed_revenue + row.scheduled_revenue).toLocaleString()}` : '—'}
              </td>
              <td className="py-3 pr-6 text-amber-300 font-medium">₾{row.payout.toLocaleString()}</td>
              <td className="py-3">
                <span className={`text-sm font-medium ${row.margin >= 50 ? 'text-emerald-400' : row.margin >= 25 ? 'text-amber-400' : 'text-red-400'}`}>
                  {row.margin.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── KPI Grid ─────────────────────────────────────────────────────────────────

function KpiGrid({ data }: { data: FinancialsResult }) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <KpiCard
        label={t('gross_revenue')}
        value={`₾${data.grossRevenue.toLocaleString()}`}
        sub={`${data.completedCount} ${t('completed_count')}`}
        accent icon={DollarSign}
      />
      <KpiCard
        label={t('projected_revenue')}
        value={`₾${data.projectedRevenue.toLocaleString()}`}
        sub={t('incl_scheduled')}
        icon={ArrowUpRight}
      />
      <KpiCard
        label={t('payroll_liability')}
        value={`₾${data.payrollLiability.toLocaleString()}`}
        sub={t('all_staff_payouts')}
        icon={Users}
      />
      <KpiCard
        label={t('net_profit')}
        value={`₾${data.netProfit.toLocaleString()}`}
        sub={`${data.grossRevenue > 0 ? ((data.netProfit / data.grossRevenue) * 100).toFixed(1) : '0'}${t('margin_pct')}`}
        icon={data.netProfit >= 0 ? TrendingUp : TrendingDown}
        positive={data.netProfit >= 0}
      />
      <KpiCard
        label={t('avg_ticket')}
        value={`₾${data.avgTicket.toLocaleString()}`}
        sub={t('per_completed_booking')}
        icon={Receipt}
      />
    </div>
  );
}

// ─── Aggregate helper ─────────────────────────────────────────────────────────

function aggregateBranches(results: BranchFinancials[]): FinancialsResult {
  const grossRevenue     = results.reduce((s, r) => s + r.grossRevenue, 0);
  const projectedRevenue = results.reduce((s, r) => s + r.projectedRevenue, 0);
  const payrollLiability = results.reduce((s, r) => s + r.payrollLiability, 0);
  const netProfit        = results.reduce((s, r) => s + r.netProfit, 0);
  const completedCount   = results.reduce((s, r) => s + r.completedCount, 0);
  const avgTicket        = completedCount > 0 ? grossRevenue / completedCount : 0;
  return {
    startDate: results[0]?.startDate ?? '',
    endDate:   results[0]?.endDate   ?? '',
    grossRevenue:     Math.round(grossRevenue     * 100) / 100,
    projectedRevenue: Math.round(projectedRevenue * 100) / 100,
    payrollLiability: Math.round(payrollLiability * 100) / 100,
    netProfit:        Math.round(netProfit        * 100) / 100,
    avgTicket:        Math.round(avgTicket        * 100) / 100,
    completedCount,
    staff: results.flatMap(r => r.staff),
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface FinancialsTabProps {
  departmentId: string;
  bookingVersion?: number;
  salonId?: string;
  branches?: BranchRow[];
}

export default function FinancialsTab({
  departmentId,
  bookingVersion = 0,
  salonId,
  branches = [],
}: FinancialsTabProps) {
  const { t } = useLanguage();
  const presets = getPresets();
  const isMultiBranch = branches.length > 1;

  const [activeTab,    setActiveTab]    = useState<string>('all');
  const [activePreset, setActivePreset] = useState(2);
  const [startDate,    setStartDate]    = useState(presets[2].start);
  const [endDate,      setEndDate]      = useState(presets[2].end);
  const [data,         setData]         = useState<FinancialsResult | null>(null);
  const [multiData,    setMultiData]    = useState<BranchFinancials[] | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [pending,      startTransition] = useTransition();

  function loadSingle(start: string, end: string, deptId: string) {
    setError(null);
    startTransition(async () => {
      try { setData(await getFinancials(deptId, start, end)); }
      catch (e) { setError(String(e)); }
    });
  }

  function loadMulti(start: string, end: string) {
    if (!salonId || !branches.length) return;
    setError(null);
    startTransition(async () => {
      try {
        setMultiData(await getFinancialsForBranches(
          salonId,
          branches.map(b => ({ id: b.id, name: b.name })),
          start, end,
        ));
      } catch (e) { setError(String(e)); }
    });
  }

  function load(start: string, end: string) {
    isMultiBranch ? loadMulti(start, end) : loadSingle(start, end, departmentId);
  }

  function selectPreset(i: number) {
    const p = presets[i];
    setActivePreset(i); setStartDate(p.start); setEndDate(p.end);
    load(p.start, p.end);
  }

  function handleCustomLoad() { setActivePreset(-1); load(startDate, endDate); }

  useEffect(() => { load(presets[2].start, presets[2].end); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bookingVersion === 0) return;
    load(startDate, endDate);
  }, [bookingVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve what to display
  const displayData: FinancialsResult | null = (() => {
    if (!isMultiBranch) return data;
    if (!multiData) return null;
    if (activeTab === 'all') return aggregateBranches(multiData);
    return multiData.find(r => r.branchId === activeTab) ?? null;
  })();

  return (
    <div className="space-y-6">

      {/* Branch tabs — only when multiple branches */}
      {isMultiBranch && (
        <div className="overflow-x-auto scrollbar-none -mx-1">
          <div className="flex items-center min-w-max border-b border-neutral-800 px-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] tracking-wider uppercase border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === 'all'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <GitBranch size={11} />
              {t('all_branches')}
            </button>
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => setActiveTab(b.id)}
                className={`px-4 py-2.5 text-[11px] tracking-wider uppercase border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  activeTab === b.id
                    ? 'border-amber-500 text-amber-300'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date Range Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p, i) => (
          <button
            key={p.key}
            onClick={() => selectPreset(i)}
            className={`px-3 py-1.5 rounded-sm border text-xs tracking-wider transition-colors
              ${activePreset === i
                ? 'bg-amber-500/10 border-amber-700 text-amber-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'}`}
          >
            {t(p.key as Parameters<typeof t>[0])}
          </button>
        ))}

        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-sm px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-neutral-600"
          />
          <span className="text-neutral-700 text-xs">→</span>
          <input
            type="date" value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-sm px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-neutral-600"
          />
          <button
            onClick={handleCustomLoad}
            disabled={pending}
            className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-sm text-xs text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <RefreshCw size={11} className={pending ? 'animate-spin' : ''} />
            {pending ? t('loading') : t('apply')}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-800/50 bg-red-950/20 rounded-sm px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {displayData && (
        <>
          <KpiGrid data={displayData} />

          <div className="border border-neutral-800 rounded-sm bg-neutral-950">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              <div>
                <p className="text-xs text-neutral-200 font-medium tracking-wide">{t('staff_performance')}</p>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {displayData.startDate} → {displayData.endDate}
                </p>
              </div>
              <button
                onClick={() => load(startDate, endDate)}
                disabled={pending}
                className="p-1.5 text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 rounded-sm transition-colors disabled:opacity-40"
              >
                <RefreshCw size={13} className={pending ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="px-5 py-4">
              <StaffTable rows={displayData.staff} />
            </div>
          </div>
        </>
      )}

      {pending && !displayData && (
        <div className="flex items-center justify-center py-20">
          <p className="text-[10px] text-neutral-600 uppercase tracking-widest animate-pulse">{t('loading_financials')}</p>
        </div>
      )}
    </div>
  );
}
