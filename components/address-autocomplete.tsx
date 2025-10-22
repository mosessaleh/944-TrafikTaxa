"use client";
import { useEffect, useRef, useState } from 'react';

export type Suggestion = { id:string|null; text:string; postcode:string|null; city:string|null; lat:number|null; lon:number|null };

export default function AddressAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  name
}:{
  label:string;
  placeholder?:string;
  value:string;
  onChange:(v:string)=>void;
  onSelect:(s:Suggestion)=>void;
  name:string;
}){
  const [open,setOpen] = useState(false);
  const [loading,setLoading] = useState(false);
  const [items,setItems] = useState<Suggestion[]>([]);
  const [cursor,setCursor] = useState(-1);
  const boxRef = useRef<HTMLDivElement|null>(null);
  const timer = useRef<any>(null);

  useEffect(()=>{
    function onDoc(e:MouseEvent){ if(!boxRef.current) return; if(!boxRef.current.contains(e.target as any)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return ()=> document.removeEventListener('mousedown', onDoc);
  },[]);

  // Debounced fetch while typing
  useEffect(()=>{
    if(timer.current) clearTimeout(timer.current);
    if (!value || value.trim().length < 3){ setItems([]); setOpen(false); return; }
    timer.current = setTimeout(async()=>{
      try{
        setLoading(true);
        const r = await fetch(`/api/addresses?q=${encodeURIComponent(value)}&limit=8`, { cache:'no-store' });
        const j = await r.json();
        setItems(j?.suggestions||[]);
        setOpen(true);
        setCursor(-1);
      }finally{ setLoading(false); }
    }, 250);
  },[value]);

  function choose(s:Suggestion){ onSelect(s); setOpen(false); }

  function onKey(e:React.KeyboardEvent<HTMLInputElement>){
    if(!open) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); setCursor(c=> Math.min((items.length-1), c+1)); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); setCursor(c=> Math.max(0, c-1)); }
    else if(e.key==='Enter'){
      e.preventDefault(); const s = items[cursor]; if(s) choose(s);
    } else if(e.key==='Escape'){ setOpen(false); }
  }

  return (
    <div className="grid gap-1" ref={boxRef}>
      <label className="text-sm text-gray-700">{label}</label>
      <input
        name={name}
        value={value}
        onChange={e=> onChange(e.target.value)}
        onKeyDown={onKey}
        onBlur={()=> setTimeout(()=> setOpen(false), 100)}
        placeholder={placeholder||label}
        autoComplete="off"
        className="w-full px-3 py-2 rounded-xl border bg-white"
      />
      {open && items.length>0 && (
        <div className="mt-1 rounded-xl border bg-white shadow-md overflow-hidden max-h-64 overflow-y-auto">
          {items.map((s,idx)=> (
            <button key={(s.id||s.text)+idx} type="button" onClick={()=> choose(s)}
              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${idx===cursor? 'bg-gray-100':''}`}>
              <div className="font-medium">{s.text}</div>
              <div className="text-xs text-gray-500">{s.postcode||''} {s.city||''}</div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && items.length===0 && (
        <div className="mt-1 text-xs text-gray-500">No matches.</div>
      )}
    </div>
  );
}
