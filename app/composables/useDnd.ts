import { ref, computed } from "vue";

export type DragKind = "location" | "piece";

export interface DragPayload {
  kind: DragKind;
  id: number;
}

const MIME = "application/x-stocka";

const currentDrag = ref<DragPayload | null>(null);

export function useCurrentDrag() {
  return computed(() => currentDrag.value);
}

/**
 * HTML5 native drag-and-drop is not reliably triggered on touch devices
 * (Safari iOS / Chrome Android do not dispatch dragstart from a finger).
 * We disable the source/target only on devices that are *truly* touch-only:
 * `any-hover`/`any-pointer` check every input the device has, so a Windows
 * laptop or 2-in-1 with both a touchscreen and a mouse still drags fine,
 * while a phone or pure tablet does not.
 */
function isTouchOnlyDevice(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return window.matchMedia("(any-hover: none) and (any-pointer: coarse)")
    .matches;
}

export interface UseDragSourceOptions {
  disabled?: () => boolean;
  onStart?: (payload: DragPayload) => void;
  onEnd?: () => void;
  dragImage?: (e: DragEvent) => HTMLElement | null;
}

export function useDragSource(
  payloadFn: () => DragPayload,
  opts: UseDragSourceOptions = {},
) {
  const dragging = ref(false);

  function onDragStart(e: DragEvent) {
    if (opts.disabled?.() || isTouchOnlyDevice()) {
      e.preventDefault();
      return;
    }
    const payload = payloadFn();
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(MIME, JSON.stringify(payload));
      const ghost = opts.dragImage?.(e);
      if (ghost) {
        const rect = ghost.getBoundingClientRect();
        e.dataTransfer.setDragImage(
          ghost,
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
      }
    }
    currentDrag.value = payload;
    dragging.value = true;
    opts.onStart?.(payload);
  }

  function onDragEnd() {
    currentDrag.value = null;
    dragging.value = false;
    opts.onEnd?.();
  }

  const draggable = computed(() => !opts.disabled?.() && !isTouchOnlyDevice());

  return { onDragStart, onDragEnd, draggable, dragging };
}

export interface UseDropTargetOptions {
  accept: DragKind[] | ((p: DragPayload) => boolean);
  canDrop?: (p: DragPayload) => boolean;
  onDrop: (p: DragPayload) => void | Promise<void>;
}

export function useDropTarget(opts: UseDropTargetOptions) {
  const isOver = ref(false);
  const isInvalid = ref(false);
  let depth = 0;

  function accepts(p: DragPayload): boolean {
    if (Array.isArray(opts.accept)) return opts.accept.includes(p.kind);
    return opts.accept(p);
  }

  function evaluate(p: DragPayload | null) {
    if (!p) return { accept: false, allowed: false };
    const accept = accepts(p);
    const allowed = accept && (opts.canDrop ? opts.canDrop(p) : true);
    return { accept, allowed };
  }

  function onDragEnter(e: DragEvent) {
    const p = currentDrag.value;
    const { accept, allowed } = evaluate(p);
    if (!accept) return;
    e.preventDefault();
    depth += 1;
    isOver.value = true;
    isInvalid.value = !allowed;
  }

  function onDragOver(e: DragEvent) {
    const p = currentDrag.value;
    const { accept, allowed } = evaluate(p);
    if (!accept) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = allowed ? "move" : "none";
    }
    if (!isOver.value) isOver.value = true;
    isInvalid.value = !allowed;
  }

  function onDragLeave() {
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      isOver.value = false;
      isInvalid.value = false;
    }
  }

  async function onDrop(e: DragEvent) {
    const p = currentDrag.value ?? readPayload(e);
    depth = 0;
    isOver.value = false;
    isInvalid.value = false;
    if (!p) return;
    const { accept, allowed } = evaluate(p);
    if (!accept || !allowed) return;
    e.preventDefault();
    e.stopPropagation();
    await opts.onDrop(p);
  }

  return { onDragEnter, onDragOver, onDragLeave, onDrop, isOver, isInvalid };
}

function readPayload(e: DragEvent): DragPayload | null {
  const raw = e.dataTransfer?.getData(MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (
      parsed &&
      (parsed.kind === "location" || parsed.kind === "piece") &&
      typeof parsed.id === "number"
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

export function descendantIds(
  tree: Array<{ id: number; children?: Array<unknown> }>,
  rootId: number,
): Set<number> {
  const out = new Set<number>();
  const node = findNode(tree as TreeNode[], rootId);
  if (!node) return out;
  collect(node, out);
  return out;
}

interface TreeNode {
  id: number;
  children?: TreeNode[];
}

function findNode(nodes: TreeNode[], id: number): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = findNode(n.children ?? [], id);
    if (child) return child;
  }
  return null;
}

function collect(node: TreeNode, out: Set<number>) {
  out.add(node.id);
  for (const c of node.children ?? []) collect(c, out);
}
