'use client';

import { useLanguage } from '@/lib/LanguageContext';
import type { BranchRow } from '@/app/admin/actions';
import { MapPin, Phone, ArrowRight } from 'lucide-react';

interface Props {
  salonName: string;
  branches: BranchRow[];
}

export default function BranchSelector({ salonName, branches }: Props) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-luxe-bg flex flex-col items-center justify-start px-4 py-12 overflow-y-auto">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-display tracking-[0.3em] text-luxe-cream uppercase mb-3">
            {salonName}
          </h1>
          <p className="text-luxe-muted text-xs tracking-[0.25em] uppercase">{t('choose_branch')}</p>
          <p className="text-luxe-muted/50 text-xs mt-1">{t('branch_selector_sub')}</p>
        </div>

        {/* Branch cards */}
        {branches.length === 0 ? (
          <p className="text-center text-luxe-muted text-sm py-8">{t('no_branches_set_up')}</p>
        ) : (
          <div className="space-y-2">
            {branches.map(branch => (
              <a
                key={branch.id}
                href={`/${branch.slug}`}
                className="group flex items-center justify-between border border-luxe-border bg-luxe-surface hover:border-luxe-cream/60 hover:bg-neutral-900 transition-all duration-200 p-5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-luxe-cream font-medium tracking-wide group-hover:text-amber-200 transition-colors text-sm">
                    {branch.name}
                  </p>
                  {(branch.city || branch.address) && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-luxe-muted text-xs">
                      <MapPin size={10} className="shrink-0" />
                      <span className="truncate">
                        {[branch.city, branch.address].filter(Boolean).join(' — ')}
                      </span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-1.5 mt-1 text-luxe-muted text-xs">
                      <Phone size={10} className="shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                </div>
                <ArrowRight
                  size={16}
                  className="text-luxe-muted/40 group-hover:text-luxe-cream/70 group-hover:translate-x-0.5 transition-all ml-4 shrink-0"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
