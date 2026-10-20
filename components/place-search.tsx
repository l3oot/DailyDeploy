"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/provider";
import {
  resolveSelectedPlace,
  suggestPlaces,
  type PlaceSuggestion,
  type ResolvedPlace,
} from "@/lib/places";

type PlaceSearchProps = {
  value: string;
  onChange: (value: string) => void;
  onResolved: (place: ResolvedPlace) => void;
  placeholder?: string;
  disabled?: boolean;
  suggestionsEnabled?: boolean;
  trailing?: React.ReactNode;
  menuAnchorRef?: RefObject<HTMLElement | null>;
  showInlineStatus?: boolean;
};

export function PlaceSearch({
  value,
  onChange,
  onResolved,
  placeholder,
  disabled,
  suggestionsEnabled = true,
  trailing,
  menuAnchorRef,
  showInlineStatus = true,
}: PlaceSearchProps) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [fromLongdo, setFromLongdo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const skipLongdo = useRef(false);
  const lastQuery = useRef("");
  const [searchTick, setSearchTick] = useState(0);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || disabled || !suggestionsEnabled) {
      setSuggestions([]);
      setFromLongdo(false);
      setError("");
      return;
    }
    const handle = window.setTimeout(() => {
      lastQuery.current = q;
      setBusy(true);
      void suggestPlaces(q, { skipLongdo: skipLongdo.current }).then((res) => {
        if (lastQuery.current !== q) return;
        setBusy(false);
        skipLongdo.current = false;
        setSuggestions(res.suggestions);
        setFromLongdo(res.fromLongdo);
        setError(res.error ?? "");
      });
    }, 500);
    return () => window.clearTimeout(handle);
  }, [value, disabled, searchTick, suggestionsEnabled]);

  async function pick(suggestion: PlaceSuggestion) {
    setResolving(true);
    setError("");
    const { place, error: resolveError } = await resolveSelectedPlace(suggestion);
    setResolving(false);
    if (!place) {
      setError(resolveError || t("longdoSearchNoResult"));
      return;
    }
    setSuggestions([]);
    setFromLongdo(false);
    onChange(place.name);
    onResolved(place);
  }

  const showMenu = suggestions.length > 0 && !resolving;

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          value={value}
          disabled={disabled || resolving}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t("taxiFareSearchHint")}
          className="w-full bg-transparent py-1 text-base disabled:bg-[#F2F2F7]"
          autoComplete="off"
        />
        {trailing}
      </div>
      {showInlineStatus && (busy || resolving) ? (
        <p className="mt-1 text-xs text-[#8E8E93]">
          {resolving ? t("resolvingPlace") : t("searchingPlaces")}
        </p>
      ) : null}
      {showInlineStatus && error ? <p className="mt-1 text-xs text-[#C33E83]">{error}</p> : null}
      {showMenu ? (
        <PlaceSearchMenu anchorRef={menuAnchorRef} fallbackRef={rootRef}>
          {suggestions.map((item) => (
            <li key={`${item.source}-${item.placeId}-${item.text}`}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[#FFF8F0]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(item)}
              >
                <span className="line-clamp-1 font-medium">{item.text}</span>
                {item.detail ? (
                  <span className="line-clamp-1 text-xs text-[#8E8E93]">{item.detail}</span>
                ) : null}
              </button>
            </li>
          ))}
          {fromLongdo ? (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-semibold text-[#4A89EA]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  skipLongdo.current = true;
                  setSearchTick((n) => n + 1);
                }}
              >
                {t("searchFromGoogleInstead")}
              </button>
            </li>
          ) : null}
        </PlaceSearchMenu>
      ) : null}
    </div>
  );
}

function PlaceSearchMenu({
  anchorRef,
  fallbackRef,
  children,
}: {
  anchorRef?: RefObject<HTMLElement | null>;
  fallbackRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    function update() {
      const anchor = anchorRef?.current ?? fallbackRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const width = Math.max(r.width, 240);
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      setBox({
        top: r.bottom + 6,
        left: Math.min(Math.max(8, r.left), maxLeft),
        width,
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchorRef, fallbackRef]);

  if (!box || typeof document === "undefined") return null;

  return createPortal(
    <ul
      className="fixed z-[80] max-h-56 overflow-auto rounded-xl border border-[#E5E5EA] bg-white shadow-lg"
      style={{ top: box.top, left: box.left, width: box.width }}
    >
      {children}
    </ul>,
    document.body,
  );
}
