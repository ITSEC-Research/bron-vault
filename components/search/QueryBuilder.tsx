"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import {
  Globe,
  Mail,
  Link,
  Type,
  X,
  Plus,
  Ban,
  ChevronDown,
  Quote,
  Asterisk,
  AlignLeft,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TermType = "domain" | "email" | "url" | "keyword"
type MatchType = "contains" | "exact" | "wildcard"

interface BuilderTerm {
  id: string
  value: string
  type: TermType
  matchType: MatchType
}

interface BuilderGroup {
  id: string
  terms: BuilderTerm[]
}

interface QueryBuilderProps {
  /** Called whenever the generated query string changes */
  onQueryChange: (query: string) => void
  /** Called when user clicks Search */
  onSearch: () => void
  /** Is a search currently running? */
  isLoading: boolean
  /** Initial query to parse into the builder */
  initialQuery?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 1
function uid(): string {
  return `qb_${Date.now()}_${nextId++}`
}

function detectType(value: string): TermType {
  if (value.includes("@")) return "email"
  if (value.startsWith("http://") || value.startsWith("https://")) return "url"
  if (value.includes(".") && !value.includes(" ")) return "domain"
  return "keyword"
}

const TYPE_META: Record<TermType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  domain: { icon: Globe, label: "Domain", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  email: { icon: Mail, label: "Email", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  url: { icon: Link, label: "URL", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/30" },
  keyword: { icon: Type, label: "Keyword", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
}

const MATCH_META: Record<MatchType, { icon: React.ElementType; label: string; tip: string }> = {
  contains: { icon: AlignLeft, label: "Contains", tip: "Substring / subdomain match" },
  exact: { icon: Quote, label: "Exact", tip: 'Exact match (wraps in "...")' },
  wildcard: { icon: Asterisk, label: "Wildcard", tip: "Use * as wildcard" },
}

/**
 * Generate the text query from builder state so the search API can consume it.
 */
function buildQueryString(
  groups: BuilderGroup[],
  excludeTerms: BuilderTerm[],
): string {
  const parts: string[] = []

  for (const group of groups) {
    if (group.terms.length === 0) continue
    const groupParts = group.terms.map((t) => formatTerm(t))
    parts.push(groupParts.join(" + "))
  }

  for (const t of excludeTerms) {
    parts.push(`-${formatTerm(t)}`)
  }

  return parts.join(", ")
}

function formatTerm(t: BuilderTerm): string {
  let v = t.value
  if (t.matchType === "exact") v = `"${v}"`
  if (t.type !== "keyword" && t.type !== detectType(t.value)) {
    const prefix =
      t.type === "domain" ? "domain:" : t.type === "email" ? "user:" : t.type === "url" ? "url:" : ""
    if (prefix) v = `${prefix}${v}`
  }
  return v
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TermPill({
  term,
  onRemove,
  onChangeMatch,
}: {
  term: BuilderTerm
  onRemove: () => void
  onChangeMatch: (m: MatchType) => void
}) {
  const [showMatchMenu, setShowMatchMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const meta = TYPE_META[term.type]
  const matchMeta = MATCH_META[term.matchType]
  const Icon = meta.icon

  useEffect(() => {
    if (!showMatchMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMatchMenu(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showMatchMenu])

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm font-medium transition-all ${meta.bg} ${meta.color} select-none`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[180px]">{term.value}</span>

      {/* Match type badge */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setShowMatchMenu(!showMatchMenu)}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition text-[10px] uppercase tracking-wider opacity-70 hover:opacity-100"
          title={matchMeta.tip}
        >
          {matchMeta.label}
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
        {showMatchMenu && (
          <div className="absolute z-20 top-full left-0 mt-1 min-w-[140px] rounded-lg border border-border/50 bg-card shadow-xl py-1">
            {(Object.entries(MATCH_META) as [MatchType, typeof matchMeta][]).map(([key, m]) => {
              const MIcon = m.icon
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChangeMatch(key)
                    setShowMatchMenu(false)
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 transition ${
                    key === term.matchType ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  <MIcon className="h-3 w-3" />
                  <span>{m.label}</span>
                  <span className="ml-auto text-[10px] opacity-50">{m.tip}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-white/10 transition"
        title="Remove"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function InlineTermInput({
  onAdd,
  placeholder,
  autoFocus,
}: {
  onAdd: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [value, setValue] = useState("")
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const submit = () => {
    const v = value.trim()
    if (v) {
      onAdd(v)
      setValue("")
    }
  }

  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          submit()
        }
      }}
      onBlur={() => {
        if (value.trim()) submit()
      }}
      placeholder={placeholder || "Type and press Enter..."}
      className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/50 min-w-[120px] w-auto"
      style={{ width: `${Math.max(120, value.length * 8 + 20)}px` }}
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QueryBuilder({ onQueryChange, onSearch, isLoading, initialQuery }: QueryBuilderProps) {
  const [includeGroups, setIncludeGroups] = useState<BuilderGroup[]>([
    { id: uid(), terms: [] },
  ])
  const [excludeTerms, setExcludeTerms] = useState<BuilderTerm[]>([])
  const [showExclude, setShowExclude] = useState(false)
  const initialised = useRef(false)

  // Parse initial query into builder state (once)
  useEffect(() => {
    if (initialised.current || !initialQuery?.trim()) return
    initialised.current = true

    const segments = initialQuery.split(",")
    const newGroups: BuilderGroup[] = []
    const newExcludes: BuilderTerm[] = []

    for (const seg of segments) {
      const trimmed = seg.trim()
      if (!trimmed) continue

      if (trimmed.startsWith("-")) {
        const val = trimmed.substring(1).trim()
        if (val) {
          newExcludes.push({
            id: uid(),
            value: val.replace(/^"|"$/g, ""),
            type: detectType(val.replace(/^"|"$/g, "")),
            matchType: val.startsWith('"') && val.endsWith('"') ? "exact" : val.includes("*") ? "wildcard" : "contains",
          })
        }
        continue
      }

      const andParts = trimmed.split("+")
      const group: BuilderGroup = { id: uid(), terms: [] }
      for (const part of andParts) {
        const pv = part.trim()
        if (!pv) continue
        const cleanVal = pv.replace(/^"|"$/g, "")
        group.terms.push({
          id: uid(),
          value: cleanVal,
          type: detectType(cleanVal),
          matchType: pv.startsWith('"') && pv.endsWith('"') ? "exact" : pv.includes("*") ? "wildcard" : "contains",
        })
      }
      if (group.terms.length > 0) newGroups.push(group)
    }

    if (newGroups.length > 0) setIncludeGroups(newGroups)
    if (newExcludes.length > 0) {
      setExcludeTerms(newExcludes)
      setShowExclude(true)
    }
  }, [initialQuery])

  // Sync generated query string out whenever state changes
  const syncQuery = useCallback(
    (groups: BuilderGroup[], excludes: BuilderTerm[]) => {
      const q = buildQueryString(groups, excludes)
      onQueryChange(q)
    },
    [onQueryChange],
  )

  useEffect(() => {
    syncQuery(includeGroups, excludeTerms)
  }, [includeGroups, excludeTerms, syncQuery])

  // ---- Actions ----

  const addTermToGroup = (groupId: string, value: string) => {
    setIncludeGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              terms: [
                ...g.terms,
                {
                  id: uid(),
                  value,
                  type: detectType(value),
                  matchType: value.includes("*") ? "wildcard" : "contains",
                },
              ],
            }
          : g,
      ),
    )
  }

  const removeTermFromGroup = (groupId: string, termId: string) => {
    setIncludeGroups((prev) =>
      prev
        .map((g) =>
          g.id === groupId ? { ...g, terms: g.terms.filter((t) => t.id !== termId) } : g,
        )
        .filter((g, i) => g.terms.length > 0 || i === 0),
    )
  }

  const changeTermMatch = (groupId: string, termId: string, matchType: MatchType) => {
    setIncludeGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, terms: g.terms.map((t) => (t.id === termId ? { ...t, matchType } : t)) }
          : g,
      ),
    )
  }

  const addOrGroup = () => {
    setIncludeGroups((prev) => [...prev, { id: uid(), terms: [] }])
  }

  const removeGroup = (groupId: string) => {
    setIncludeGroups((prev) => {
      const filtered = prev.filter((g) => g.id !== groupId)
      return filtered.length === 0 ? [{ id: uid(), terms: [] }] : filtered
    })
  }

  const addExcludeTerm = (value: string) => {
    setExcludeTerms((prev) => [
      ...prev,
      {
        id: uid(),
        value,
        type: detectType(value),
        matchType: value.includes("*") ? "wildcard" : "contains",
      },
    ])
  }

  const removeExcludeTerm = (termId: string) => {
    setExcludeTerms((prev) => prev.filter((t) => t.id !== termId))
  }

  const changeExcludeMatch = (termId: string, matchType: MatchType) => {
    setExcludeTerms((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, matchType } : t)),
    )
  }

  const totalTerms = includeGroups.reduce((acc, g) => acc + g.terms.length, 0) + excludeTerms.length
  const generatedQuery = buildQueryString(includeGroups, excludeTerms)
  const hasAndGroups = includeGroups.some((g) => g.terms.length > 1)

  return (
    <div className="space-y-4">
      {/* Include Groups */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Include
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            Terms within a group = AND &bull; Groups = OR
          </span>
        </div>

        {includeGroups.map((group, groupIndex) => (
          <React.Fragment key={group.id}>
            {groupIndex > 0 && (
              <div className="flex items-center gap-3 px-4">
                <div className="flex-1 h-px bg-border/50" />
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-primary/30 text-primary bg-primary/5 px-2 py-0">
                  OR
                </Badge>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            )}

            <div className="rounded-xl border border-border/50 bg-card/30 p-3 transition-all hover:border-border/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  {includeGroups.length > 1 ? `Group ${groupIndex + 1}` : "Search Terms"}
                  {group.terms.length > 1 && (
                    <span className="ml-1.5 text-green-400/80">(AND — device must match all)</span>
                  )}
                </span>
                {includeGroups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    className="text-muted-foreground/40 hover:text-red-400 transition p-0.5"
                    title="Remove group"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {group.terms.map((term, termIndex) => (
                  <React.Fragment key={term.id}>
                    {termIndex > 0 && (
                      <span className="text-[10px] font-bold text-green-400/70 uppercase select-none px-0.5">
                        +
                      </span>
                    )}
                    <TermPill
                      term={term}
                      onRemove={() => removeTermFromGroup(group.id, term.id)}
                      onChangeMatch={(m) => changeTermMatch(group.id, term.id, m)}
                    />
                  </React.Fragment>
                ))}

                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-dashed border-border/40 hover:border-border/70 transition">
                  <Plus className="h-3 w-3 text-muted-foreground/40" />
                  <InlineTermInput
                    onAdd={(val) => addTermToGroup(group.id, val)}
                    placeholder={group.terms.length === 0 ? "e.g. example.com" : "Add AND term..."}
                  />
                </div>
              </div>
            </div>
          </React.Fragment>
        ))}

        <button
          type="button"
          onClick={addOrGroup}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-primary transition pl-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add OR group
        </button>
      </div>

      {/* Exclude Section */}
      <div>
        {!showExclude ? (
          <button
            type="button"
            onClick={() => setShowExclude(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-red-400/70 transition"
          >
            <Ban className="h-3.5 w-3.5" />
            Add exclusions...
          </button>
        ) : (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-red-400/70" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70">
                  Exclude
                </span>
              </div>
              {excludeTerms.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowExclude(false)}
                  className="text-muted-foreground/40 hover:text-foreground transition p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {excludeTerms.map((term) => (
                <TermPill
                  key={term.id}
                  term={term}
                  onRemove={() => removeExcludeTerm(term.id)}
                  onChangeMatch={(m) => changeExcludeMatch(term.id, m)}
                />
              ))}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-dashed border-red-500/20 hover:border-red-500/40 transition">
                <Plus className="h-3 w-3 text-red-400/40" />
                <InlineTermInput
                  onAdd={addExcludeTerm}
                  placeholder="Exclude term..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generated Query Preview */}
      {generatedQuery && (
        <div className="rounded-lg border border-border/30 bg-secondary/20 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Generated Query
            </span>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
              {hasAndGroups && (
                <span className="inline-flex items-center gap-1 text-green-400/70">
                  <Sparkles className="h-3 w-3" />
                  AND mode
                </span>
              )}
              <span>{totalTerms} term{totalTerms !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <code className="text-sm text-foreground/80 font-mono break-all">{generatedQuery}</code>
        </div>
      )}

      {/* Search button */}
      <Button
        onClick={onSearch}
        disabled={isLoading || totalTerms === 0}
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        size="lg"
      >
        {isLoading ? "Searching..." : `Search ${totalTerms > 0 ? `(${totalTerms} term${totalTerms !== 1 ? "s" : ""})` : ""}`}
      </Button>
    </div>
  )
}
