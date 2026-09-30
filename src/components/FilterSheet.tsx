import { useEffect, useRef, useState } from 'react';
import type { Tournament } from '../domain/tournament';
import { DEFAULT_FILTERS, filterTournaments, type Filters } from '../utils/filters';
import { FilterPanel } from './FilterPanel';
import { Icon } from './Icon';

export function FilterSheet({ filters, items, onClose, onApply }: { filters: Filters; items: Tournament[]; onClose: () => void; onApply: (f: Filters) => void }) {
  const [draft, setDraft] = useState(filters);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    el.showModal();
    return () => { el.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="filter-sheet" aria-labelledby="filter-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sheet-inner">
      <div className="sheet-header"><div><span className="eyebrow">ВАША ИГРА, ВАШИ ПРАВИЛА</span><h2 id="filter-title">Фильтры</h2></div><button className="icon-button" type="button" aria-label="Закрыть фильтры" onClick={onClose}><Icon name="close" /></button></div>
      <div className="sheet-scroll"><FilterPanel filters={draft} onChange={setDraft} items={items} /></div>
      <div className="sheet-footer"><button type="button" className="secondary-button" onClick={() => setDraft({ ...DEFAULT_FILTERS, sort: draft.sort })}>Сбросить</button><button className="primary-button" type="button" onClick={() => onApply(draft)}>Показать турниры · {filterTournaments(items, draft).length}<Icon name="arrow" size={18} /></button></div>
    </div>
  </dialog>;
}
