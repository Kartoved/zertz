import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { slugify, uniqueSlug } from '../utils/slug.js';

const router = Router();

const BOARD_SIZES = new Set([37, 48, 61]);

// Full content row → client shape. `isOwner` lets the client decide whether to
// show edit affordances.
function mapNode(row, viewerId) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    parentId: row.parent_id,
    slug: row.slug,
    title: row.title,
    boardSize: row.board_size,
    setupJson: row.setup_json,
    treeJson: row.tree_json,
    rootComment: row.root_comment,
    meta: row.meta_json || null,
    isPublic: row.is_public,
    sort: row.sort,
    createdAt: row.created_at ? row.created_at.getTime() : null,
    updatedAt: row.updated_at ? row.updated_at.getTime() : null,
    isOwner: viewerId != null && row.owner_id === viewerId,
  };
}

// Set of the owner's existing slugs (optionally excluding one id, for updates).
async function takenSlugs(ownerId, excludeId = null) {
  const params = [ownerId];
  let sql = 'SELECT slug FROM studies WHERE owner_id = $1';
  if (excludeId != null) { sql += ' AND id <> $2'; params.push(excludeId); }
  const { rows } = await pool.query(sql, params);
  return new Set(rows.map(r => r.slug));
}

// GET /api/studies/tree — the signed-in user's whole hierarchy, content-free,
// for the sidebar. Lazy: node bodies are fetched on open via /:owner/:slug.
router.get('/tree', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, parent_id, slug, title, sort, is_public
         FROM studies
        WHERE owner_id = $1
        ORDER BY parent_id NULLS FIRST, sort ASC`,
      [req.user.id]
    );
    res.json(rows.map(r => ({
      id: r.id, parentId: r.parent_id, slug: r.slug,
      title: r.title, sort: r.sort, isPublic: r.is_public,
    })));
  } catch (err) {
    console.error('Studies tree error:', err);
    res.status(500).json({ error: 'Failed to load studies' });
  }
});

// GET /api/studies/public — public studies for the Learning list (paginated).
router.get('/public', async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.slug, s.title, s.board_size, s.updated_at,
              u.username AS owner_name, u.country AS owner_country
         FROM studies s
         JOIN users u ON u.id = s.owner_id
        WHERE s.is_public = true
        ORDER BY s.updated_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows.map(r => ({
      id: r.id, slug: r.slug, title: r.title, boardSize: r.board_size,
      ownerName: r.owner_name, ownerCountry: r.owner_country || null,
      updatedAt: r.updated_at ? r.updated_at.getTime() : null,
    })));
  } catch (err) {
    console.error('Studies public error:', err);
    res.status(500).json({ error: 'Failed to load public studies' });
  }
});

// GET /api/studies/:owner/:slug — full node content (+ direct children summary).
// Readable by the owner or when public.
router.get('/:owner/:slug', optionalAuth, async (req, res) => {
  const viewerId = req.user ? req.user.id : null;
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.username AS owner_name
         FROM studies s
         JOIN users u ON u.id = s.owner_id
        WHERE lower(u.username) = lower($1) AND s.slug = $2`,
      [req.params.owner, req.params.slug]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Study not found' });
    const row = rows[0];
    if (!row.is_public && row.owner_id !== viewerId) {
      return res.status(403).json({ error: 'This study is private' });
    }
    const children = await pool.query(
      `SELECT id, slug, title, sort, is_public FROM studies
        WHERE parent_id = $1 ORDER BY sort ASC`,
      [row.id]
    );
    res.json({
      ...mapNode(row, viewerId),
      children: children.rows.map(c => ({
        id: c.id, slug: c.slug, title: c.title, sort: c.sort, isPublic: c.is_public,
      })),
    });
  } catch (err) {
    console.error('Study get error:', err);
    res.status(500).json({ error: 'Failed to load study' });
  }
});

// POST /api/studies — create a node.
router.post('/', authRequired, async (req, res) => {
  const {
    parentId = null, title, boardSize = 37,
    setupJson, treeJson, rootComment = null, meta = null,
    isPublic = false, slug: rawSlug,
  } = req.body;

  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Title required' });
  if (!setupJson || !treeJson) return res.status(400).json({ error: 'Missing setup or tree' });
  if (!BOARD_SIZES.has(Number(boardSize))) return res.status(400).json({ error: 'Invalid board size' });

  try {
    // A given parent must belong to the caller (no attaching under others' nodes).
    if (parentId != null) {
      const p = await pool.query('SELECT owner_id FROM studies WHERE id = $1', [parentId]);
      if (p.rows.length === 0 || p.rows[0].owner_id !== req.user.id) {
        return res.status(400).json({ error: 'Invalid parent' });
      }
    }
    const base = slugify(rawSlug || title);
    const slug = uniqueSlug(base, await takenSlugs(req.user.id));

    const sortRow = await pool.query(
      `SELECT COALESCE(MAX(sort), 0) + 1 AS next FROM studies
        WHERE owner_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
      [req.user.id, parentId]
    );
    const sort = sortRow.rows[0].next;

    const { rows } = await pool.query(
      `INSERT INTO studies
         (owner_id, parent_id, slug, title, board_size, setup_json, tree_json,
          root_comment, meta_json, is_public, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
       RETURNING id, slug`,
      [req.user.id, parentId, slug, title, Number(boardSize), setupJson, treeJson,
       rootComment, meta ? JSON.stringify(meta) : null, !!isPublic, sort]
    );
    const me = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
    res.json({ id: rows[0].id, slug: rows[0].slug, ownerName: me.rows[0].username });
  } catch (err) {
    console.error('Study create error:', err);
    res.status(500).json({ error: 'Failed to create study' });
  }
});

// PUT /api/studies/:id — update a node's content. Owner only.
router.put('/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const owned = await pool.query('SELECT owner_id, slug FROM studies WHERE id = $1', [id]);
    if (owned.rows.length === 0) return res.status(404).json({ error: 'Study not found' });
    if (owned.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Not your study' });

    const { title, boardSize, setupJson, treeJson, rootComment, meta, isPublic, slug: rawSlug } = req.body;

    // Resolve a new slug only when the client sent one; keep it unique per owner.
    let slug = owned.rows[0].slug;
    if (rawSlug !== undefined) {
      slug = uniqueSlug(slugify(rawSlug || title || slug), await takenSlugs(req.user.id, id));
    }

    const { rows } = await pool.query(
      `UPDATE studies SET
         title        = COALESCE($2, title),
         board_size   = COALESCE($3, board_size),
         setup_json   = COALESCE($4, setup_json),
         tree_json    = COALESCE($5, tree_json),
         root_comment = CASE WHEN $6::boolean THEN $7 ELSE root_comment END,
         meta_json    = CASE WHEN $8::boolean THEN $9::jsonb ELSE meta_json END,
         is_public    = COALESCE($10, is_public),
         slug         = $11,
         updated_at   = NOW()
       WHERE id = $1
       RETURNING slug`,
      [
        id,
        title ?? null,
        boardSize != null && BOARD_SIZES.has(Number(boardSize)) ? Number(boardSize) : null,
        setupJson ?? null,
        treeJson ?? null,
        rootComment !== undefined, rootComment ?? null,
        meta !== undefined, meta != null ? JSON.stringify(meta) : null,
        isPublic ?? null,
        slug,
      ]
    );
    res.json({ ok: true, slug: rows[0].slug });
  } catch (err) {
    console.error('Study update error:', err);
    res.status(500).json({ error: 'Failed to update study' });
  }
});

// PUT /api/studies/:id/move — reparent/reorder. Rejects moving a node under its
// own descendant (would orphan a cycle).
router.put('/:id/move', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const { newParentId = null, sort } = req.body;
  try {
    const owned = await pool.query('SELECT owner_id FROM studies WHERE id = $1', [id]);
    if (owned.rows.length === 0) return res.status(404).json({ error: 'Study not found' });
    if (owned.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Not your study' });

    if (newParentId != null) {
      const parent = await pool.query('SELECT owner_id FROM studies WHERE id = $1', [newParentId]);
      if (parent.rows.length === 0 || parent.rows[0].owner_id !== req.user.id) {
        return res.status(400).json({ error: 'Invalid parent' });
      }
      // newParentId must not be the node itself or any of its descendants.
      const cycle = await pool.query(
        `WITH RECURSIVE sub AS (
           SELECT id FROM studies WHERE id = $1
           UNION ALL
           SELECT s.id FROM studies s JOIN sub ON s.parent_id = sub.id
         )
         SELECT 1 FROM sub WHERE id = $2 LIMIT 1`,
        [id, newParentId]
      );
      if (cycle.rows.length > 0) return res.status(400).json({ error: 'Cannot nest a study under itself' });
    }

    const nextSort = sort != null
      ? Number(sort)
      : (await pool.query(
          `SELECT COALESCE(MAX(sort), 0) + 1 AS next FROM studies
            WHERE owner_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
          [req.user.id, newParentId]
        )).rows[0].next;

    await pool.query(
      'UPDATE studies SET parent_id = $2, sort = $3, updated_at = NOW() WHERE id = $1',
      [id, newParentId, nextSort]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Study move error:', err);
    res.status(500).json({ error: 'Failed to move study' });
  }
});

// DELETE /api/studies/:id — delete a node and its whole subtree (FK cascade).
router.delete('/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const owned = await pool.query('SELECT owner_id FROM studies WHERE id = $1', [id]);
    if (owned.rows.length === 0) return res.status(404).json({ error: 'Study not found' });
    if (owned.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Not your study' });
    await pool.query('DELETE FROM studies WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Study delete error:', err);
    res.status(500).json({ error: 'Failed to delete study' });
  }
});

// POST /api/studies/:id/clone — deep-copy a readable subtree to the caller as a
// new top-level study (private). Slugs are regenerated to stay unique.
router.post('/:id/clone', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    const src = await client.query('SELECT * FROM studies WHERE id = $1', [id]);
    if (src.rows.length === 0) return res.status(404).json({ error: 'Study not found' });
    if (!src.rows[0].is_public && src.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'This study is private' });
    }

    const subtree = await client.query(
      `WITH RECURSIVE sub AS (
         SELECT * FROM studies WHERE id = $1
         UNION ALL
         SELECT s.* FROM studies s JOIN sub ON s.parent_id = sub.id
       )
       SELECT * FROM sub`,
      [id]
    );

    await client.query('BEGIN');
    const taken = await takenSlugs(req.user.id);
    const idMap = new Map(); // old id -> new id
    // Insert parents before children: order by depth via a simple pass loop.
    const rows = subtree.rows;
    const pending = new Set(rows.map(r => r.id));
    let rootNewId = null;

    while (pending.size > 0) {
      let progressed = false;
      for (const r of rows) {
        if (!pending.has(r.id)) continue;
        const isRoot = r.id === id;
        const newParent = isRoot ? null : idMap.get(r.parent_id);
        if (!isRoot && newParent === undefined) continue; // parent not inserted yet

        const slug = uniqueSlug(r.slug, taken);
        taken.add(slug);
        const ins = await client.query(
          `INSERT INTO studies
             (owner_id, parent_id, slug, title, board_size, setup_json, tree_json,
              root_comment, meta_json, is_public, sort)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,false,$10)
           RETURNING id`,
          [req.user.id, newParent, slug, r.title, r.board_size, r.setup_json, r.tree_json,
           r.root_comment, r.meta_json ? JSON.stringify(r.meta_json) : null, r.sort]
        );
        idMap.set(r.id, ins.rows[0].id);
        if (isRoot) rootNewId = ins.rows[0].id;
        pending.delete(r.id);
        progressed = true;
      }
      if (!progressed) break; // safety: avoid infinite loop on malformed data
    }

    await client.query('COMMIT');
    const me = await client.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
    const rootRow = await client.query('SELECT slug FROM studies WHERE id = $1', [rootNewId]);
    res.json({ id: rootNewId, slug: rootRow.rows[0].slug, ownerName: me.rows[0].username });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Study clone error:', err);
    res.status(500).json({ error: 'Failed to clone study' });
  } finally {
    client.release();
  }
});

export default router;
