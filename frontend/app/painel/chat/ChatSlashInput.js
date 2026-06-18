"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import {
  CHAT_CHIP_CHAR,
  slashChipDisplayLabel,
} from "../../../lib/chatSlashMenu";

const CHIP_CLASS =
  "mx-0.5 inline rounded-[5px] bg-orange-500/20 px-1.5 py-px font-medium text-orange-900 dark:bg-orange-500/25 dark:text-orange-100";

/**
 * @param {import("../../../lib/chatSlashMenu").SlashChip} chip
 */
function createChipElement(chip) {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.chip = "1";
  span.dataset.chipType = chip.type;
  span.dataset.chipId = chip.id || "";
  if (chip.type === "modelo") {
    span.dataset.chipSlug = chip.slug || "";
    span.dataset.chipNome = chip.nome || "";
  } else {
    span.dataset.chipLabel = chip.label || "";
  }
  span.className = CHIP_CLASS;
  span.textContent = slashChipDisplayLabel(chip);
  return span;
}

/**
 * @param {HTMLElement} el
 */
function chipFromElement(el) {
  const type = el.dataset.chipType;
  if (type === "modelo") {
    return {
      type: "modelo",
      id: el.dataset.chipId || "",
      slug: el.dataset.chipSlug || "",
      nome: el.dataset.chipNome || "",
    };
  }
  return {
    type: "midia",
    id: el.dataset.chipId || "",
    label: el.dataset.chipLabel || "",
  };
}

/**
 * @param {Node} root
 * @returns {{ text: string, chips: import("../../../lib/chatSlashMenu").SlashChip[] }}
 */
export function deserializeEditable(root) {
  let text = "";
  const chips = [];

  /** @param {Node} node */
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = /** @type {HTMLElement} */ (node);
    if (el.dataset.chip === "1") {
      text += CHAT_CHIP_CHAR;
      chips.push(chipFromElement(el));
      return;
    }
    for (const child of el.childNodes) walk(child);
  }

  walk(root);
  return { text, chips };
}

/**
 * @param {HTMLElement} root
 * @param {string} text
 * @param {import("../../../lib/chatSlashMenu").SlashChip[]} chips
 */
function buildDomFromState(root, text, chips) {
  root.replaceChildren();
  let chipIdx = 0;
  let buf = "";

  const flush = () => {
    if (!buf) return;
    root.appendChild(document.createTextNode(buf));
    buf = "";
  };

  for (let i = 0; i < text.length; i++) {
    if (text[i] === CHAT_CHIP_CHAR) {
      flush();
      const chip = chips[chipIdx++];
      if (chip) root.appendChild(createChipElement(chip));
    } else {
      buf += text[i];
    }
  }
  flush();
}

/**
 * @param {HTMLElement} root
 */
export function getCursorTextOffset(root) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return 0;

  let offset = 0;
  let found = false;

  /** @param {Node} node */
  function walk(node) {
    if (found) return;

    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.startOffset;
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent || "").length;
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = /** @type {HTMLElement} */ (node);
      if (el.dataset.chip === "1") {
        offset += 1;
        return;
      }
      for (const child of el.childNodes) walk(child);
    }
  }

  for (const child of root.childNodes) walk(child);
  if (!found) return offset;
  return offset;
}

/**
 * @param {HTMLElement} root
 * @param {number} target
 */
export function setCursorAtTextOffset(root, target) {
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  let count = 0;
  let placed = false;

  /** @param {Node} node */
  function walk(node) {
    if (placed) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || "").length;
      if (count + len >= target) {
        range.setStart(node, Math.max(0, target - count));
        range.collapse(true);
        placed = true;
        return;
      }
      count += len;
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = /** @type {HTMLElement} */ (node);
      if (el.dataset.chip === "1") {
        if (target <= count) {
          range.setStartBefore(el);
          range.collapse(true);
          placed = true;
          return;
        }
        if (target <= count + 1) {
          range.setStartAfter(el);
          range.collapse(true);
          placed = true;
          return;
        }
        count += 1;
        return;
      }
      for (const child of el.childNodes) walk(child);
    }
  }

  for (const child of root.childNodes) walk(child);

  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * @param {import("../../../lib/chatSlashMenu").SlashChip[]} a
 * @param {import("../../../lib/chatSlashMenu").SlashChip[]} b
 */
function chipsEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((chip, i) => {
    const other = b[i];
    return chip.type === other.type && chip.id === other.id;
  });
}

const ChatSlashInput = forwardRef(function ChatSlashInput(
  { value, chips, onChange, onSelect, onKeyDown, placeholder, disabled, rows = 2, className = "" },
  ref,
) {
  const editableRef = useRef(null);
  const syncingRef = useRef(false);
  const lastEmittedRef = useRef("");

  const emitChange = useCallback((force = false) => {
    const root = editableRef.current;
    if (!root || syncingRef.current) return;
    const { text, chips: domChips } = deserializeEditable(root);
    const pos = getCursorTextOffset(root);
    const sig = `${text}\0${JSON.stringify(domChips)}`;
    if (!force && sig === lastEmittedRef.current) return;
    lastEmittedRef.current = sig;

    onChange?.({
      target: {
        value: text,
        selectionStart: pos,
        chips: domChips,
      },
    });
  }, [onChange]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editableRef.current?.focus(),
      setSelectionRange: (start) => {
        if (!editableRef.current) return;
        setCursorAtTextOffset(editableRef.current, start);
      },
      getEditorState: () => {
        if (!editableRef.current) return { text: "", chips: [] };
        return deserializeEditable(editableRef.current);
      },
      flushToParent: () => {
        emitChange(true);
      },
      get selectionStart() {
        return editableRef.current ? getCursorTextOffset(editableRef.current) : 0;
      },
      get value() {
        return editableRef.current ? deserializeEditable(editableRef.current).text : "";
      },
    }),
    [emitChange],
  );

  useLayoutEffect(() => {
    const root = editableRef.current;
    if (!root) return;

    const dom = deserializeEditable(root);
    if (dom.text === String(value ?? "") && chipsEqual(dom.chips, chips || [])) return;

    syncingRef.current = true;
    buildDomFromState(root, String(value ?? ""), chips || []);
    lastEmittedRef.current = `${value ?? ""}\0${JSON.stringify(chips || [])}`;
    syncingRef.current = false;
  }, [value, chips]);

  useEffect(() => {
    const root = editableRef.current;
    if (!root) return;

    const notifySelect = () => {
      if (syncingRef.current) return;
      if (!root.contains(document.activeElement)) return;
      const pos = getCursorTextOffset(root);
      onSelect?.({ currentTarget: { selectionStart: pos } });
    };

    document.addEventListener("selectionchange", notifySelect);
    root.addEventListener("keyup", notifySelect);
    root.addEventListener("mouseup", notifySelect);
    return () => {
      document.removeEventListener("selectionchange", notifySelect);
      root.removeEventListener("keyup", notifySelect);
      root.removeEventListener("mouseup", notifySelect);
    };
  }, [onSelect]);

  const minHeight = rows >= 2 ? "min-h-[44px]" : "min-h-[36px]";

  return (
    <div className={`relative w-full ${minHeight}`}>
      {!value && !(chips || []).length && placeholder ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 px-3 py-2 text-sm leading-[1.4285714286] text-muted-foreground"
        >
          {placeholder}
        </div>
      ) : null}
      <div
        ref={editableRef}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder || undefined}
        contentEditable={disabled ? "false" : "true"}
        suppressContentEditableWarning
        onInput={emitChange}
        onKeyDown={onKeyDown}
        className={[
          minHeight,
          "max-h-36 w-full overflow-y-auto whitespace-pre-wrap break-words px-3 py-2 text-sm leading-[1.4285714286] outline-none",
          "empty:min-h-[44px] disabled:cursor-not-allowed disabled:opacity-60",
          className,
        ].join(" ")}
      />
    </div>
  );
});

export default ChatSlashInput;
