"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Category, Transaction, TransactionSource, TransactionStatus, TransactionType } from "@/lib/types";
import { CATEGORIES, TRANSACTION_SOURCES, TRANSACTION_STATUSES, TRANSACTION_TYPES } from "@/lib/types";
import { SOURCE_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/lib/labels";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";

type FilterValue<T extends string> = "all" | T;
type DateRange = "all" | "this-month" | "last-month";
type SortOrder = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

function monthKey(isoDate: string) {
  return isoDate.slice(0, 7);
}

function shiftMonthKey(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function TransactionsView({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FilterValue<Category>>("all");
  const [type, setType] = useState<FilterValue<TransactionType>>("all");
  const [source, setSource] = useState<FilterValue<TransactionSource>>("all");
  const [status, setStatus] = useState<FilterValue<TransactionStatus>>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [sort, setSort] = useState<SortOrder>("date-desc");
  const [selected, setSelected] = useState<Transaction | null>(null);

  const currentMonthKey = monthKey(new Date().toISOString());

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = transactions.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (type !== "all" && t.type !== type) return false;
      if (source !== "all" && t.source !== source) return false;
      if (status !== "all" && t.status !== status) return false;
      if (dateRange === "this-month" && monthKey(t.transactionDate) !== currentMonthKey) return false;
      if (dateRange === "last-month" && monthKey(t.transactionDate) !== shiftMonthKey(currentMonthKey, -1)) return false;
      if (query) {
        const haystack = `${t.merchant ?? ""} ${t.rawDescription}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sort === "amount-desc") return b.amount - a.amount;
      if (sort === "amount-asc") return a.amount - b.amount;
      const aKey = `${a.transactionDate}T${a.transactionTime ?? "00:00"}`;
      const bKey = `${b.transactionDate}T${b.transactionTime ?? "00:00"}`;
      return sort === "date-asc" ? aKey.localeCompare(bKey) : bKey.localeCompare(aKey);
    });

    return result;
  }, [transactions, search, category, type, source, status, dateRange, sort, currentMonthKey]);

  const hasActiveFilters =
    category !== "all" || type !== "all" || source !== "all" || status !== "all" || dateRange !== "all" || search !== "";

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setType("all");
    setSource("all");
    setStatus("all");
    setDateRange("all");
  }

  function handleSave(updated: Transaction) {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelected(null);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchant or description"
          aria-label="Search transactions"
          className="pl-10"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filters">
        <Select value={type} onChange={(e) => setType(e.target.value as FilterValue<TransactionType>)} aria-label="Filter by type">
          <option value="all">All types</option>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value as FilterValue<Category>)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={source} onChange={(e) => setSource(e.target.value as FilterValue<TransactionSource>)} aria-label="Filter by source">
          <option value="all">All sources</option>
          {TRANSACTION_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as FilterValue<TransactionStatus>)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {TRANSACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRange)} aria-label="Filter by date range">
          <option value="all">All time</option>
          <option value="this-month">This month</option>
          <option value="last-month">Last month</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)} aria-label="Sort by">
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="amount-desc">Amount: high to low</option>
          <option value="amount-asc">Amount: low to high</option>
        </Select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-9 flex-shrink-0 items-center gap-1 rounded-full border border-border px-3 text-sm font-medium text-muted"
          >
            <X size={13} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      <p className="px-1 text-sm text-muted">
        {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title="No matching transactions"
          description="Try adjusting your search or filters."
        />
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t)}
              className="block w-full text-left transition-colors hover:bg-surface-secondary"
            >
              <TransactionRow transaction={t} />
            </button>
          ))}
        </Card>
      )}

      <TransactionDetailSheet transaction={selected} onClose={() => setSelected(null)} onSave={handleSave} />
    </div>
  );
}
