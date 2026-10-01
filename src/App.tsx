import { useEffect, useMemo, useState } from 'react';
import { PRODUCT_NAME } from './config';
import { Icon } from './components/Icon';
import { TournamentCard, SkeletonGrid } from './components/TournamentCard';
import { FilterSheet } from './components/FilterSheet';
import { SelectField } from './components/FilterPanel';
import { createProvider } from './providers';
import { LundaConnection } from './components/LundaConnection';
import type { LundaCredentials } from './providers/DirectLundaTournamentProvider';
import type { Catalog } from './providers/TournamentProvider';
import { DATE_OPTIONS, TIME_OPTIONS, SORT_OPTIONS, DEFAULT_FILTERS, filterChips, filterTournaments, readFilters, sortTournaments, writeFilters, type Filters } from './utils/filters';

export default function App() {
  const [filters, setFilters] = useState<Filters>(() => readFilters(location.search));
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [credentials, setCredentials] = useState<LundaCredentials | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false); setProgress(0); setCatalog(null);
    Promise.resolve().then(() => createProvider(credentials).loadTournaments({ signal: controller.signal, onProgress: count => { if (!controller.signal.aborted) setProgress(count); } }))
      .then(data => { if (!controller.signal.aborted) setCatalog(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, credentials]);
  useEffect(() => {
    const next = `${location.pathname}${writeFilters(filters, location.search)}${location.hash}`;
    history.replaceState(null, '', next);
  }, [filters]);
  useEffect(() => {
    const restore = () => setFilters(readFilters(location.search));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const items = catalog?.items ?? [];
  const results = useMemo(() => sortTournaments(filterTournaments(items, filters), filters.sort), [items, filters]);
  const chips = filterChips(filters, items);
  const activeCount = chips.length;
  const reset = () => setFilters({ ...DEFAULT_FILTERS });
  const clubsCount = new Set(items.map(t => t.club.id).filter(Boolean)).size;

  return <>
    <a className="skip-link" href="#catalog">К турнирам</a>
    <header className="site-header container"><a className="brand" href={import.meta.env.BASE_URL} aria-label={`${PRODUCT_NAME} — главная`}><span className="brand-mark"><Icon name="ball" size={27} /></span><span>{PRODUCT_NAME}</span></a><span className="city-label"><Icon name="pin" size={16} />Москва<span className="city-dot" /></span></header>
    <main className="container">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy"><div className="eyebrow"><span /> МЕНЬШЕ ПОИСКА. БОЛЬШЕ ИГРЫ.</div><h1 id="hero-title">Найди свой<br className="mobile-break" /> следующий <span>турнир<span className="title-dot">.</span></span></h1><p>Актуальные падел-турниры Москвы в одном месте</p></div>
        <div className="court-art" aria-hidden="true"><div className="court-lines"><i /><i /><i /></div><span className="court-ball"><Icon name="ball" size={68} /></span><span className="court-caption">SEE YOU ON COURT</span></div>
      </section>
      <section id="catalog" aria-label="Каталог турниров">
        <LundaConnection active={credentials !== null} connected={credentials !== null && catalog?.source === 'live' && !loading && !error} onConnect={setCredentials} onDisconnect={() => { setCredentials(null); setCatalog(null); }} onRefresh={() => setAttempt(value => value + 1)} />
        <div className="catalog-toolbar">
          <div className="search-wrap"><Icon name="search" size={21} /><input type="search" aria-label="Турнир, клуб или адрес" placeholder="Турнир, клуб или адрес" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />{filters.q && <button type="button" className="icon-button" aria-label="Очистить поиск" onClick={() => setFilters({ ...filters, q: '' })}><Icon name="close" size={18} /></button>}</div>
          <div className="quick-filter"><SelectField label="Дата" options={DATE_OPTIONS.filter(o => !['custom', 'range'].includes(o[0])) .concat(['custom', 'range'].includes(filters.date) ? [[filters.date, 'Свои даты']] : [])} value={filters.date} onChange={date => setFilters({ ...filters, date, from: '', to: '' })} /></div>
          <div className="quick-filter"><SelectField label="Время" options={TIME_OPTIONS.map(([id, label]) => [id, label.split(' · ')[0]])} value={filters.time} onChange={time => setFilters({ ...filters, time })} /></div>
          <button className={`filter-button${activeCount ? ' has-filters' : ''}`} type="button" onClick={() => setSheet(true)}><Icon name="filter" size={19} />Фильтры{activeCount > 0 && <span className="filter-count">{activeCount}</span>}</button>
          <label className="mobile-sort"><span>↕ Сортировка</span><select aria-label="Сортировка" value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value })}>{SORT_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        </div>
        <div className="quick-dates" aria-label="Быстрый выбор даты">{DATE_OPTIONS.slice(0, 4).map(([id, label]) => <button key={id} type="button" aria-pressed={filters.date === id} className={filters.date === id ? 'selected' : ''} onClick={() => setFilters({ ...filters, date: id, from: '', to: '' })}>{label}</button>)}<span className="quick-separator" /><label className="quick-available"><input type="checkbox" checked={filters.available} onChange={e => setFilters({ ...filters, available: e.target.checked })} /><span>Есть места</span></label></div>
        {activeCount > 0 && <div className="filter-chips" aria-label="Активные фильтры">{chips.map(chip => <button key={chip.id} type="button" className="chip" aria-label={`Убрать фильтр: ${chip.label}`} onClick={() => setFilters(chip.remove(filters))}><span>{chip.label}</span><Icon name="close" size={13} /></button>)}<button className="text-button" type="button" onClick={reset}>Сбросить всё</button></div>}
        <div className="results-heading"><div><h2>Турниры <span>{loading ? '—' : error ? '—' : results.length}</span></h2><p>{loading ? (progress ? `Загружено ${progress} · получаем остальные…` : 'Находим следующую игру…') : catalog?.source === 'demo' ? `${clubsCount} клуба · все даты и время по Москве` : 'Все даты и время по Москве'}</p></div><div className="desktop-sort"><SelectField label="Сортировка" options={SORT_OPTIONS} value={filters.sort} onChange={sort => setFilters({ ...filters, sort })} /></div></div>
        {!error && catalog && <div className={`source-notice ${catalog.source === 'live' ? 'live' : ''}`} role="status"><span className="notice-dot" /><span>{catalog.source === 'demo' ? <><strong>Демокаталог</strong><span className="notice-divider">·</span>Примеры для знакомства с сайтом. Это не реальные анонсы.</> : catalog.source === 'snapshot' ? <><strong>Локальный снимок</strong><span className="notice-divider">·</span>Сохранённые данные, без автоматического обновления.</> : <><strong>Данные LUNDA</strong><span className="notice-divider">·</span>{credentials ? 'Получены напрямую из LUNDA.' : 'Получены через подключённый источник.'}</>}</span></div>}
        {catalog && !catalog.complete && !error && <p className="warning" role="status">Загружена только часть каталога. Результаты фильтрации неполные.</p>}
        {!!catalog?.skipped && !error && <p className="muted">Некоторые закрытые или некорректные записи не включены в каталог.</p>}
        {loading ? <SkeletonGrid /> : error ? <div className="empty-state" role="alert"><span className="state-icon"><Icon name="ball" size={34} /></span><h2>Не удалось загрузить турниры</h2><p>{credentials ? 'Проверьте срок действия токена и профиль. Если они верны, запрос может блокироваться сетью или CORS LUNDA. Можно отключиться и ввести данные заново.' : 'Попробуйте ещё раз чуть позже.'}</p><button type="button" className="primary-button" onClick={() => setAttempt(v => v + 1)}>Попробовать снова</button></div> : results.length === 0 ? <div className="empty-state"><span className="state-icon"><Icon name="search" size={32} /></span><h2>По выбранным фильтрам турниров не найдено</h2><p>Попробуйте изменить параметры поиска.</p><button type="button" className="primary-button" onClick={reset}>Сбросить фильтры</button></div> : <div className="tournament-grid">{results.map(t => <TournamentCard key={t.id} tournament={t} />)}</div>}
        <p className="catalog-end">{!loading && !error && results.length > 0 ? 'Хорошая игра начинается с хорошей компании.' : '\u00a0'}</p>
      </section>
    </main>
    <footer className="site-footer container"><span>{PRODUCT_NAME}</span><span>До встречи на корте <Icon name="ball" size={16} /></span></footer>
    {sheet && <FilterSheet filters={filters} items={items} onClose={() => setSheet(false)} onApply={f => { setFilters(f); setSheet(false); }} />}
  </>;
}
