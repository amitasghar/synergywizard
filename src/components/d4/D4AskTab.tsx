import React, { useRef, useState } from "react";
import { api } from "../../api/client.ts";
import { useEmbedder } from "../../hooks/useEmbedder.ts";
import { useD4Store } from "../../state/d4Store.ts";
import type { Entity, SemanticSearchResult } from "../../types.ts";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  results?: Entity[];
}

function resultToEntity(r: SemanticSearchResult): Entity {
  return {
    id: r.id,
    entity_slug: r.entity_slug,
    display_name: r.display_name,
    entity_type: r.entity_type,
    mechanic_tags: r.mechanic_tags,
    damage_tags: r.damage_tags,
    class_tags: r.class_tags,
  };
}

export function D4AskTab(): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError]       = useState("");
  const { status, embed }       = useEmbedder();
  const selected                = useD4Store((s) => s.selectedEntities);
  const insertEntityAt          = useD4Store((s) => s.insertEntityAt);
  const bottomRef               = useRef<HTMLDivElement>(null);

  const buildContext = selected.length
    ? `[Build: ${selected.map((e) => e.display_name).join(", ")}] `
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || searching) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSearching(true);
    setError("");

    try {
      const vector = await embed(buildContext + query);
      const hits   = await api.d4SemanticSearch(vector);
      const entities = hits.map(resultToEntity);
      const summary =
        entities.length
          ? `Found ${entities.length} results${buildContext ? " (based on your current build)" : ""}.`
          : "No matching results. Try different terms.";
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: summary,
        results: entities.slice(0, 8),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("D4 Ask AI error:", err);
      setError("Search failed. Try again.");
    } finally {
      setSearching(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  const placeholderText =
    status === "loading" ? "Loading model (first time only)…" : 'Ask anything — "show me barbarian bleeds"…';

  return (
    <div className="flex flex-col h-full">
      {selected.length > 0 && (
        <div className="px-3 py-1.5 text-[10px] text-white/30 border-b border-white/5 truncate">
          Build context: {selected.map((e) => e.display_name).join(", ")}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-white/25 text-sm italic text-center mt-8">Ask anything about D4 skills and aspects.</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] text-sm px-3 py-2 rounded ${msg.role === "user" ? "bg-accent/20 text-white/80" : "bg-white/5 text-white/70"}`}>
              {msg.text}
            </div>
            {msg.results?.map((entity) => {
              const inBuild = selected.some((s) => s.id === entity.id);
              return (
                <div key={entity.id} className="w-full flex items-center gap-2 px-2 py-1.5 bg-white/3 rounded border border-white/5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/85 truncate">{entity.display_name}</div>
                    <div className="text-[10px] text-white/30">{entity.entity_type} · {entity.class_tags.join(", ")}</div>
                  </div>
                  {inBuild ? (
                    <span className="text-[11px] text-accent/40">✓ In build</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => insertEntityAt(entity, selected.length)}
                      className="text-[11px] border border-white/15 text-white/50 px-2 py-0.5 rounded hover:border-accent/50 hover:text-accent"
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && <p className="px-3 text-xs text-red-400">{error}</p>}
      <form onSubmit={handleSubmit} className="p-2 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholderText}
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent/50"
        />
        <button
          type="submit"
          disabled={searching || !input.trim()}
          className="px-3 py-1.5 rounded bg-accent text-background text-sm font-medium disabled:opacity-40"
        >
          {searching ? "…" : "→"}
        </button>
      </form>
    </div>
  );
}
