import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ParticipantSession } from '../../types';
import { ChevronDown, ChevronLeft, ChevronRight, Search, Users, Check } from 'lucide-react';

export interface PickerPerson {
  key: string;
  number?: number;
  name: string;
  status?: string;
}

/** Pessoas únicas do teste (participantId ou sessão), em ordem de número. */
export function peopleFromSessions(sessions: ParticipantSession[]): PickerPerson[] {
  const m = new Map<string, PickerPerson>();
  sessions.forEach((s) => {
    const key = s.participantId || s.sessionId;
    const prev = m.get(key);
    m.set(key, {
      key,
      number: s.participantNumber ?? prev?.number,
      name: s.participantName || prev?.name || 'Participante',
      status: s.status === 'Concluído' || prev?.status === 'Concluído' ? 'Concluiu' : s.status === 'Abandonado' ? 'Saiu' : 'Em andamento'
    });
  });
  return [...m.values()].sort((a, b) => (a.number || 9999) - (b.number || 9999) || a.name.localeCompare(b.name));
}

const tag = (p: PickerPerson) => (p.number ? `#${String(p.number).padStart(2, '0')}` : '—');

/**
 * Filtro de participante para jornada e mapa de calor.
 * Até 5 pessoas: abas. Acima disso: busca com lista rolável + anterior/próximo (aguenta centenas).
 */
export const ParticipantPicker: React.FC<{
  people: PickerPerson[];
  value: string; // 'all' ou a key da pessoa
  onChange: (key: string) => void;
  allLabel?: string;
}> = ({ people, value, onChange, allLabel = 'Visão geral' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const current = people.find((p) => p.key === value);
  const idx = people.findIndex((p) => p.key === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q) || tag(p).includes(q) || String(p.number || '') === q.replace('#', ''));
  }, [people, query]);

  if (people.length === 0) return null;

  // Poucas pessoas: abas
  if (people.length <= 5) {
    return (
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit max-w-full">
        <button
          type="button"
          onClick={() => onChange('all')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${value === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <Users className="w-3.5 h-3.5" /> {allLabel} <span className="text-slate-400 font-medium">{people.length}</span>
        </button>
        {people.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${value === p.key ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <span className={value === p.key ? 'text-blue-100' : 'text-slate-400'}>{tag(p)}</span> {p.name}
          </button>
        ))}
      </div>
    );
  }

  // Muitas pessoas: busca + lista
  return (
    <div className="flex items-center gap-2" ref={boxRef}>
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${value === 'all' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'}`}
      >
        <Users className="w-3.5 h-3.5" /> {allLabel} ({people.length})
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`inline-flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl border text-xs font-semibold min-w-[220px] justify-between ${
            current ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          <span className="truncate">{current ? `${tag(current)} ${current.name}` : 'Escolher participante…'}</span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </button>
        {open && (
          <div className="absolute z-30 mt-1.5 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-2 border-b border-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou número"
                className="flex-1 text-xs outline-none py-1"
              />
              <span className="text-[11px] text-slate-400">{filtered.length}</span>
            </div>
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {filtered.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.key);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-slate-50 ${p.key === value ? 'bg-blue-50' : ''}`}
                  >
                    <span className="w-9 text-[11px] font-bold text-slate-400">{tag(p)}</span>
                    <span className="flex-1 truncate font-medium text-slate-800">{p.name}</span>
                    {p.status && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          p.status === 'Concluiu' ? 'bg-emerald-50 text-emerald-700' : p.status === 'Saiu' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    )}
                    {p.key === value && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-3 py-4 text-xs text-slate-400 text-center">Ninguém com esse nome.</li>}
            </ul>
          </div>
        )}
      </div>
      <div className="inline-flex">
        <button
          type="button"
          disabled={idx <= 0 && value !== 'all'}
          onClick={() => onChange(idx <= 0 ? people[people.length - 1].key : people[idx - 1].key)}
          className="p-2 rounded-l-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 disabled:opacity-30"
          title="Participante anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={idx >= people.length - 1}
          onClick={() => onChange(idx < 0 ? people[0].key : people[idx + 1].key)}
          className="p-2 rounded-r-xl border border-l-0 border-slate-200 bg-white text-slate-500 hover:text-slate-900 disabled:opacity-30"
          title="Próximo participante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
