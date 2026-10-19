import React, { useId, useState } from "react";

/**
 * Widget fences (opt-in via the renderer's `widgets` prop): small line-based blocks that
 * render as chat-style components.
 *
 *   ```flow [vertical|horizontal]    one step per line:  Label | detail
 *   ```checklist                     - [ ] item / - [x] item
 *   ```roadmap                       - [ ] item | tag
 *   ```cards                         Title | body | note
 *   ```choice                        - Option | recommendation | detail | note
 *
 * Optional header lines before the items: `title:`, `prompt:` (choice), `unit:` (roadmap).
 * Cell text gets the renderer's inline Markdown; nothing is interpreted as HTML.
 */
export const widgetKinds = new Set(["flow", "checklist", "roadmap", "cards", "choice"]);

type Inline = (text: string) => React.ReactNode;
type Item = { checked: boolean; cells: string[] };
type Spec = { meta: Record<string, string>; items: Item[] };

function parse(source: string): Spec {
  const meta: Record<string, string> = {};
  const items: Item[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const header = !items.length && line.match(/^(title|prompt|unit):\s*(.*)$/i);
    if (header) { meta[header[1].toLowerCase()] = header[2]; continue; }
    const bullet = line.match(/^[-*+]\s+(?:\[([ xX])\]\s+)?(.*)$/);
    const body = bullet ? bullet[2] : line;
    items.push({ checked: bullet?.[1]?.toLowerCase() === "x", cells: body.split(/\s+\|\s+/).map(cell => cell.trim()) });
  }
  return { meta, items };
}

const Check = ({ checked }: { checked: boolean }) =>
  <input type="checkbox" className="hme-w-check" checked={checked} readOnly aria-label={checked ? "Done" : "Not done"} />;

const Progress = ({ done, total }: { done: number; total: number }) =>
  <div className="hme-w-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
    <div style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
  </div>;

function Flow({ spec, info, inline }: { spec: Spec; info: string; inline: Inline }) {
  const vertical = /\bvertical\b/.test(info) || (!/\bhorizontal\b/.test(info) && spec.items.length > 4);
  return <div className={"hme-widget hme-flow" + (vertical ? " is-vertical" : "")}>
    {spec.meta.title && <p className="hme-w-title">{inline(spec.meta.title)}</p>}
    <ol className="hme-flow-steps">
      {spec.items.map((step, i) => <li key={i} className="hme-flow-step">
        <span className="hme-flow-label">{inline(step.cells[0])}</span>
        {step.cells[1] && <span className="hme-flow-detail">{inline(step.cells[1])}</span>}
      </li>)}
    </ol>
  </div>;
}

function Checklist({ spec, inline }: { spec: Spec; inline: Inline }) {
  const done = spec.items.filter(item => item.checked).length;
  return <div className="hme-widget">
    <div className="hme-w-head">
      <p className="hme-w-title">{inline(spec.meta.title ?? "Checklist")}</p>
      <span className="hme-w-count">{done}/{spec.items.length}</span>
    </div>
    <ul className="hme-w-rows">
      {spec.items.map((item, i) => <li key={i}><Check checked={item.checked} /><span>{inline(item.cells[0])}</span></li>)}
    </ul>
  </div>;
}

function Roadmap({ spec, inline }: { spec: Spec; inline: Inline }) {
  const total = spec.items.length;
  const done = spec.items.filter(item => item.checked).length;
  const digits = String(total).length < 2 ? 2 : String(total).length;
  return <div className="hme-widget">
    <div className="hme-w-head">
      <p className="hme-w-title">{inline(spec.meta.title ?? "Roadmap")}</p>
      <span className="hme-w-count">{total} {spec.meta.unit ?? "steps"}</span>
    </div>
    <div className="hme-w-head hme-w-sub">
      <span>{done} of {total} completed</span>
      <strong>{total ? Math.round((done / total) * 100) : 0}%</strong>
    </div>
    <Progress done={done} total={total} />
    <ol className="hme-w-rows">
      {spec.items.map((item, i) => <li key={i}>
        <Check checked={item.checked} />
        <span className="hme-w-grow"><span className="hme-w-num">{String(i + 1).padStart(digits, "0")}.</span> {inline(item.cells[0])}</span>
        {item.cells[1] && <span className="hme-w-tag">{inline(item.cells[1])}</span>}
      </li>)}
    </ol>
  </div>;
}

function Cards({ spec, inline }: { spec: Spec; inline: Inline }) {
  return <div className="hme-widget hme-cards">
    {spec.meta.title && <p className="hme-w-title">{inline(spec.meta.title)}</p>}
    {spec.items.map((card, i) => <section key={i} className="hme-card">
      <p className="hme-card-title">{inline(card.cells[0])}</p>
      {card.cells[1] && <p>{inline(card.cells[1])}</p>}
      {card.cells[2] && <p className="hme-w-note">{inline(card.cells[2])}</p>}
    </section>)}
  </div>;
}

function Choice({ spec, inline }: { spec: Spec; inline: Inline }) {
  const name = useId();
  const [picked, setPicked] = useState(0);
  const option = spec.items[picked];
  return <div className="hme-widget">
    {spec.meta.title && <p className="hme-w-title">{inline(spec.meta.title)}</p>}
    <fieldset className="hme-choice">
      <legend className="hme-w-note">{inline(spec.meta.prompt ?? "Choose an option")}</legend>
      {spec.items.map((item, i) => <label key={i}>
        <input type="radio" name={name} checked={i === picked} onChange={() => setPicked(i)} />
        <span>{inline(item.cells[0])}</span>
      </label>)}
    </fieldset>
    {option?.cells[1] && <div className="hme-choice-result" aria-live="polite">
      <p className="hme-w-label">Recommended</p>
      <p className="hme-choice-pick">{inline(option.cells[1])}</p>
      {option.cells[2] && <p>{inline(option.cells[2])}</p>}
      {option.cells[3] && <p className="hme-w-note">{inline(option.cells[3])}</p>}
    </div>}
  </div>;
}

/** Renders a widget fence, or null when the block has no items (caller falls back to code). */
export function renderWidget(kind: string, info: string, source: string, inline: Inline): React.ReactNode | null {
  const spec = parse(source);
  if (!spec.items.length) return null;
  switch (kind) {
    case "flow": return <Flow spec={spec} info={info} inline={inline} />;
    case "checklist": return <Checklist spec={spec} inline={inline} />;
    case "roadmap": return <Roadmap spec={spec} inline={inline} />;
    case "cards": return <Cards spec={spec} inline={inline} />;
    case "choice": return <Choice spec={spec} inline={inline} />;
    default: return null;
  }
}

export const widgetCss = [
  ".hme-chat-markdown{--hme-faint:#8f8f8f}.hme-chat-markdown[data-theme='dark']{--hme-faint:#afafaf}@media(prefers-color-scheme:dark){.hme-chat-markdown[data-theme='system']{--hme-faint:#afafaf}}",
  ".hme-chat-markdown .hme-widget{display:flex;flex-direction:column;gap:12px;margin:1em 0 0;padding:12px;border:1px solid var(--hme-rule);border-radius:12px;line-height:1.5}",
  ".hme-chat-markdown .hme-widget p{margin:0}.hme-chat-markdown .hme-widget ul,.hme-chat-markdown .hme-widget ol{list-style:none;margin:0;padding:0}",
  ".hme-chat-markdown .hme-w-title{font-weight:600}.hme-chat-markdown .hme-w-head{display:flex;align-items:center;justify-content:space-between;gap:1em}",
  ".hme-chat-markdown .hme-w-count,.hme-chat-markdown .hme-w-sub span,.hme-chat-markdown .hme-w-note{font-size:12px;color:var(--hme-muted)}.hme-chat-markdown .hme-w-sub strong{font-size:12px;font-weight:500}",
  ".hme-chat-markdown .hme-w-bar{height:5px;border-radius:9999px;background:var(--hme-code);overflow:hidden}.hme-chat-markdown .hme-w-bar>div{height:100%;background:var(--hme-fg)}",
  ".hme-chat-markdown .hme-w-rows{display:flex;flex-direction:column;gap:12px}.hme-chat-markdown .hme-w-rows li{display:flex;align-items:center;gap:10px;margin:0;font-size:14px;break-inside:avoid}",
  ".hme-chat-markdown .hme-w-check{appearance:none;flex:none;width:16px;height:16px;margin:0;border:1px solid var(--hme-faint);border-radius:9999px;display:grid;place-content:center}",
  ".hme-chat-markdown .hme-w-check:checked{background:var(--hme-fg);border-color:var(--hme-fg)}.hme-chat-markdown .hme-w-check:checked::after{content:'';width:4px;height:8px;border:solid var(--hme-panel);border-width:0 2px 2px 0;transform:translateY(-1px) rotate(45deg)}",
  ".hme-chat-markdown .hme-w-grow{flex:1}.hme-chat-markdown .hme-w-num{color:var(--hme-faint)}.hme-chat-markdown .hme-w-tag{font-size:9px;color:var(--hme-faint)}",
  ".hme-chat-markdown .hme-flow-steps{display:flex;align-items:center;gap:4px}.hme-chat-markdown .hme-flow.is-vertical .hme-flow-steps{flex-direction:column;align-items:center}",
  ".hme-chat-markdown .hme-flow-step{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;margin:0;padding:8px;border-radius:6px;background:var(--hme-code);break-inside:avoid}.hme-chat-markdown .hme-flow.is-vertical .hme-flow-step{width:85%}",
  ".hme-chat-markdown .hme-flow-steps>li+li{position:relative}.hme-chat-markdown .hme-flow:not(.is-vertical) .hme-flow-steps>li+li{margin-left:18px}.hme-chat-markdown .hme-flow.is-vertical .hme-flow-steps>li+li{margin-top:18px}",
  ".hme-chat-markdown .hme-flow-steps>li+li::after{content:'→';position:absolute;left:-15px;top:50%;transform:translateY(-50%);color:var(--hme-muted);font-size:14px}",
  ".hme-chat-markdown .hme-flow.is-vertical .hme-flow-steps>li+li::after{content:'↓';left:50%;top:-17px;transform:translateX(-50%)}",
  ".hme-chat-markdown .hme-flow-label{font-size:12px;font-weight:500}.hme-chat-markdown .hme-flow.is-vertical .hme-flow-label{font-size:14px}.hme-chat-markdown .hme-flow-detail{font-size:14px;color:var(--hme-muted)}",
  ".hme-chat-markdown .hme-cards{gap:0;padding:0 12px}.hme-chat-markdown .hme-cards>.hme-w-title{padding-top:12px}.hme-chat-markdown .hme-card{display:flex;flex-direction:column;gap:6px;padding:12px 0;break-inside:avoid}",
  ".hme-chat-markdown .hme-card+.hme-card{border-top:1px solid var(--hme-border)}.hme-chat-markdown .hme-card-title{font-size:14px;font-weight:500}",
  ".hme-chat-markdown .hme-choice{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;border:0}.hme-chat-markdown .hme-choice legend{padding:0;margin-bottom:8px}",
  ".hme-chat-markdown .hme-choice label{display:flex;align-items:center;gap:10px;font-size:14px}.hme-chat-markdown .hme-choice input{margin:0;accent-color:var(--hme-fg)}",
  ".hme-chat-markdown .hme-choice-result{display:flex;flex-direction:column;gap:4px;padding-top:12px;border-top:1px solid var(--hme-border)}",
  ".hme-chat-markdown .hme-w-label{font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.02em;color:var(--hme-muted)}.hme-chat-markdown .hme-choice-pick{font-size:18px;font-weight:600}",
].join("\n");
