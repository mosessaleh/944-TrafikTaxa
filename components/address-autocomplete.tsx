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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement|null>(null);
  const dropdownRef = useRef<HTMLDivElement|null>(null);

  useEffect(() => {
    const fetchSuggestions = async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      try {
        const response = await fetch(`/api/addresses?q=${encodeURIComponent(query)}&limit=20`);
        const data = await response.json();
        if (data.ok) {
          setSuggestions(data.suggestions);
          setShowDropdown(true);
        }
      } catch (error) {
        console.warn('Failed to fetch address suggestions:', error);
        setSuggestions([]);
        setShowDropdown(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.text);
    onSelect(suggestion);
    setShowDropdown(false);
  };

  return (
    <div className="grid gap-1 relative">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        ref={inputRef}
        name={name}
        value={value}
        onChange={e=> onChange(e.target.value)}
        placeholder={placeholder||label}
        autoComplete="off"
        className="w-full px-3 py-2 rounded-xl border bg-white"
        onFocus={() => value.length >= 2 && setShowDropdown(true)}
      />
      {showDropdown && suggestions.length > 0 && (
        <div ref={dropdownRef} className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-xl shadow-lg z-10 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id || index}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSelect(suggestion)}
            >
              {suggestion.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
