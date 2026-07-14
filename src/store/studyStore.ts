import { create } from 'zustand';
import {
  StudyTreeNode, StudyNode, PublicStudy,
  getStudyTree, getStudy, getPublicStudies,
  createStudy as apiCreate, updateStudy, moveStudy as apiMove,
  deleteStudy as apiDelete, cloneStudy as apiClone,
} from '../db/studiesApi';
import { serializeState, serializeTree } from '../db/apiClient';
import { createInitialState } from '../game/GameEngine';
import { createRootNode } from '../utils/gameTreeUtils';

interface StudyStore {
  tree: StudyTreeNode[];        // the signed-in user's hierarchy (content-free)
  expanded: Set<number>;        // expanded sidebar node ids
  current: StudyNode | null;    // opened node content
  currentLoading: boolean;
  publicStudies: PublicStudy[];
  error: string | null;

  loadTree: () => Promise<void>;
  toggleExpand: (id: number) => void;
  expand: (id: number) => void;
  openStudy: (owner: string, slug: string) => Promise<StudyNode | null>;
  createStudy: (parentId: number | null, title: string) => Promise<{ id: number; slug: string; ownerName: string } | null>;
  renameStudy: (id: number, title: string) => Promise<void>;
  changeSlug: (id: number, slug: string) => Promise<string | null>;
  setPublic: (id: number, isPublic: boolean) => Promise<void>;
  moveStudy: (id: number, newParentId: number | null) => Promise<void>;
  deleteStudy: (id: number) => Promise<void>;
  cloneStudy: (id: number) => Promise<{ id: number; slug: string; ownerName: string } | null>;
  loadPublic: () => Promise<void>;
  reset: () => void;
}

// A fresh study starts from the standard opening position (board 37) with an
// empty move tree — the position editor (Etap D) can replace the setup later.
function blankStudyContent() {
  return {
    boardSize: 37 as const,
    setupJson: serializeState(createInitialState(37)),
    treeJson: serializeTree(createRootNode()),
  };
}

export const useStudyStore = create<StudyStore>((set, get) => ({
  tree: [],
  expanded: new Set<number>(),
  current: null,
  currentLoading: false,
  publicStudies: [],
  error: null,

  loadTree: async () => {
    try {
      const tree = await getStudyTree();
      set({ tree });
    } catch {
      /* guests get [] from the api layer; ignore */
    }
  },

  toggleExpand: (id) => set(s => {
    const next = new Set(s.expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    return { expanded: next };
  }),

  expand: (id) => set(s => {
    if (s.expanded.has(id)) return s;
    const next = new Set(s.expanded);
    next.add(id);
    return { expanded: next };
  }),

  openStudy: async (owner, slug) => {
    set({ currentLoading: true, error: null });
    try {
      const node = await getStudy(owner, slug);
      set({ current: node, currentLoading: false, error: node ? null : 'notFound' });
      return node;
    } catch {
      set({ current: null, currentLoading: false, error: 'loadError' });
      return null;
    }
  },

  createStudy: async (parentId, title) => {
    const { boardSize, setupJson, treeJson } = blankStudyContent();
    const r = await apiCreate({ parentId, title, boardSize, setupJson, treeJson });
    await get().loadTree();
    if (parentId != null) get().expand(parentId);
    return r;
  },

  renameStudy: async (id, title) => {
    await updateStudy(id, { title });
    await get().loadTree();
    set(s => (s.current && s.current.id === id ? { current: { ...s.current, title } } : s));
  },

  changeSlug: async (id, slug) => {
    const { slug: newSlug } = await updateStudy(id, { slug });
    await get().loadTree();
    set(s => (s.current && s.current.id === id ? { current: { ...s.current, slug: newSlug } } : s));
    return newSlug;
  },

  setPublic: async (id, isPublic) => {
    await updateStudy(id, { isPublic });
    await get().loadTree();
    set(s => (s.current && s.current.id === id ? { current: { ...s.current, isPublic } } : s));
  },

  moveStudy: async (id, newParentId) => {
    await apiMove(id, newParentId);
    await get().loadTree();
    if (newParentId != null) get().expand(newParentId);
  },

  deleteStudy: async (id) => {
    await apiDelete(id);
    await get().loadTree();
    set(s => (s.current && s.current.id === id ? { current: null } : s));
  },

  cloneStudy: async (id) => {
    const r = await apiClone(id);
    await get().loadTree();
    return r;
  },

  loadPublic: async () => {
    const publicStudies = await getPublicStudies();
    set({ publicStudies });
  },

  reset: () => set({ tree: [], expanded: new Set<number>(), current: null, publicStudies: [], error: null }),
}));
