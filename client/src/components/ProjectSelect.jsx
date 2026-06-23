import { useState, useRef, useEffect } from 'react';

// A reliable project combo box: shows a clickable dropdown of the shared
// catalog (from the Manage tab) and still lets you type a custom value.
// Used everywhere a project name is entered so the list is common to everyone.
export default function ProjectSelect({
  value,
  options = [],
  onChange,
  readOnly = false,
  placeholder = 'Select or type a project…',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const q = (value || '').toLowerCase();
  const filtered = options.filter((o) => o.toLowerCase().includes(q));
  const list = filtered.length ? filtered : options;
  const hasOptions = options.length > 0;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="flex">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => {
            onChange(e.target.value);
            if (!readOnly) setOpen(true);
          }}
          onFocus={() => !readOnly && hasOptions && setOpen(true)}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 read-only:bg-slate-50"
        />
        {!readOnly && hasOptions && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen((o) => !o)}
            className="ml-1 px-2 rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50"
            aria-label="Show projects"
          >
            ▾
          </button>
        )}
      </div>

      {open && !readOnly && list.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {list.map((name) => (
            <li key={name}>
              <button
                type="button"
                // onMouseDown fires before the input blur so the pick registers.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-50 ${
                  name === value ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700'
                }`}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
