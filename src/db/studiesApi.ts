import { API_BASE, authHeaders } from './apiClient';

export interface StudyMeta {
  players?: { white?: string; black?: string };
  event?: string;
  round?: string;
  timeControl?: string;
  date?: string;
  result?: string;
  /** Author default: open the study in training mode (solution hidden). */
  training?: boolean;
}

// Content-free node for the sidebar hierarchy.
export interface StudyTreeNode {
  id: number;
  parentId: number | null;
  slug: string;
  title: string;
  sort: number;
  isPublic: boolean;
}

export interface StudyChildSummary {
  id: number;
  slug: string;
  title: string;
  sort: number;
  isPublic: boolean;
}

export interface PublicStudy {
  id: number;
  slug: string;
  title: string;
  boardSize: 37 | 48 | 61;
  ownerName: string;
  ownerCountry: string | null;
  updatedAt: number | null;
}

// Full node content (returned by GET /:owner/:slug).
export interface StudyNode {
  id: number;
  ownerId: number;
  ownerName: string;
  parentId: number | null;
  slug: string;
  title: string;
  boardSize: 37 | 48 | 61;
  setupJson: string;
  treeJson: string;
  rootComment: string | null;
  meta: StudyMeta | null;
  isPublic: boolean;
  sort: number;
  createdAt: number | null;
  updatedAt: number | null;
  isOwner: boolean;
  children: StudyChildSummary[];
}

export interface CreateStudyPayload {
  parentId?: number | null;
  title: string;
  boardSize?: 37 | 48 | 61;
  setupJson: string;
  treeJson: string;
  rootComment?: string | null;
  meta?: StudyMeta | null;
  isPublic?: boolean;
  slug?: string;
}

export interface UpdateStudyPayload {
  title?: string;
  boardSize?: 37 | 48 | 61;
  setupJson?: string;
  treeJson?: string;
  rootComment?: string | null;
  meta?: StudyMeta | null;
  isPublic?: boolean;
  slug?: string;
}

export async function getStudyTree(): Promise<StudyTreeNode[]> {
  const res = await fetch(`${API_BASE}/api/studies/tree`, { headers: authHeaders(false) });
  if (!res.ok) return [];
  return res.json();
}

export async function getPublicStudies(limit = 30, offset = 0): Promise<PublicStudy[]> {
  const res = await fetch(`${API_BASE}/api/studies/public?limit=${limit}&offset=${offset}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getStudy(owner: string, slug: string): Promise<StudyNode | null> {
  const res = await fetch(
    `${API_BASE}/api/studies/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
    { headers: authHeaders(false) }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function createStudy(payload: CreateStudyPayload): Promise<{ id: number; slug: string; ownerName: string }> {
  const res = await fetch(`${API_BASE}/api/studies`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create study');
  }
  return res.json();
}

export async function updateStudy(id: number, patch: UpdateStudyPayload): Promise<{ ok: boolean; slug: string }> {
  const res = await fetch(`${API_BASE}/api/studies/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update study');
  }
  return res.json();
}

export async function moveStudy(id: number, newParentId: number | null, sort?: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/studies/${id}/move`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ newParentId, sort }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to move study');
  }
}

export async function deleteStudy(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/studies/${id}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete study');
  }
}

export async function cloneStudy(id: number): Promise<{ id: number; slug: string; ownerName: string }> {
  const res = await fetch(`${API_BASE}/api/studies/${id}/clone`, {
    method: 'POST',
    headers: authHeaders(false),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to clone study');
  }
  return res.json();
}
