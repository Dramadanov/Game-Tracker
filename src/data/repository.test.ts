import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from '../db/migrations'
import { SqlJsDb } from '../db/sqljsDb'
import { DEFAULT_FILTERS, DEFAULT_VIEW } from '../domain/constants'
import { createEmptyGame } from '../domain/game'
import type { Game, SavedView, Tag, ViewConfig } from '../domain/types'
import { Repository, rowToGame, sanitizeViewConfig } from './repository'

let SQL: SqlJsStatic
let db: SqlJsDb
let repo: Repository

beforeAll(async () => {
  SQL = await initSqlJs()
})

beforeEach(async () => {
  db = await SqlJsDb.open(SQL)
  await migrate(db)
  repo = new Repository(db)
})

function fullGame(id = 'game-1'): Game {
  return {
    id,
    title: 'Starfall Odyssey',
    summary: 'A sprawling space RPG.\n\nWith two paragraphs — and “quotes”.',
    coverUrl: 'https://img.example.com/cover.jpg',
    releaseDate: '2027-Q2',
    releaseStatus: 'early_access',
    personalStatus: 'preordered',
    priority: 'must',
    platforms: ['PC', 'PlayStation 5'],
    genres: ['RPG', 'Open World'],
    developers: ['Nebula Forge'],
    publishers: ['Orbit Interactive', 'Ötzi Publishing'],
    tagIds: ['tag-a', 'tag-b'],
    screenshots: ['https://img.example.com/1.jpg', 'https://img.example.com/2.jpg'],
    trailers: [{ title: 'Reveal', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
    links: [{ label: 'Steam', url: 'https://store.steampowered.com/app/1' }],
    lockedFields: ['title', 'coverUrl'],
    externalIds: { igdb: '1942', steam: '292030' },
    createdAt: '2026-01-02T03:04:05.006Z',
    updatedAt: '2026-02-03T04:05:06.007Z',
  }
}

function tag(id: string, name: string, color = '#7c5cff'): Tag {
  return { id, name, color, createdAt: `2026-01-01T00:00:0${id.length % 10}.000Z` }
}

function savedView(id: string, name: string, config: ViewConfig, position = 0, createdAt = '2026-01-01T00:00:00.000Z'): SavedView {
  return { id, name, config, position, createdAt }
}

async function rawGameRow(id: string): Promise<Record<string, unknown>> {
  const [row] = await db.select<Record<string, unknown>>('SELECT * FROM games WHERE id = ?', [id])
  return row
}

describe('games', () => {
  it('round-trips a fully populated game', async () => {
    const game = fullGame()
    await repo.saveGame(game)
    expect(await repo.listGames()).toEqual([game])
  })

  it('round-trips an empty game', async () => {
    const game = { ...createEmptyGame('2026-01-01T00:00:00.000Z', 'empty'), title: 'Only a title' }
    await repo.saveGame(game)
    expect(await repo.listGames()).toEqual([game])
  })

  it('normalizes before saving', async () => {
    await repo.saveGame({
      ...fullGame(),
      title: '  Spaced   out  ',
      coverUrl: 'javascript:alert(1)',
      platforms: ['PC', 'pc', ' '],
      releaseDate: '2027-02-30',
    })
    const row = await rawGameRow('game-1')
    expect(row.title).toBe('Spaced out')
    expect(row.cover_url).toBe('')
    expect(row.platforms).toBe('["PC"]')
    expect(row.release_date).toBe('')
  })

  it('upserts: saving twice keeps one row with the latest data', async () => {
    const game = fullGame()
    await repo.saveGame(game)
    const edited = { ...game, title: 'Starfall Odyssey: Remastered', tagIds: [], updatedAt: '2026-05-05T00:00:00.000Z' }
    await repo.saveGame(edited)
    const [{ n }] = await db.select<{ n: number }>('SELECT COUNT(*) AS n FROM games')
    expect(n).toBe(1)
    expect(await repo.listGames()).toEqual([edited])
  })

  it('never changes createdAt on update (the first save wins)', async () => {
    const game = fullGame()
    await repo.saveGame(game)
    await repo.saveGame({ ...game, createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z' })
    const [stored] = await repo.listGames()
    expect(stored.createdAt).toBe(game.createdAt)
    expect(stored.updatedAt).toBe('2030-01-01T00:00:00.000Z')
  })

  it('keeps games apart by id', async () => {
    await repo.saveGame(fullGame('a'))
    await repo.saveGame({ ...fullGame('b'), title: 'Other' })
    const games = await repo.listGames()
    expect(games.map((g) => g.id).sort()).toEqual(['a', 'b'])
  })

  it('deletes a game', async () => {
    await repo.saveGame(fullGame('a'))
    await repo.saveGame(fullGame('b'))
    await repo.deleteGame('a')
    expect((await repo.listGames()).map((g) => g.id)).toEqual(['b'])
    // Deleting a missing game is harmless.
    await expect(repo.deleteGame('missing')).resolves.toBeUndefined()
    expect(await repo.listGames()).toHaveLength(1)
  })

  it('stores text with quotes and SQL-looking content literally', async () => {
    const title = `Robert'); DROP TABLE games; -- "Bobby"`
    await repo.saveGame({ ...fullGame(), title })
    expect((await repo.listGames())[0].title).toBe(title)
  })
})

describe('rowToGame', () => {
  it('falls back to empty values for corrupt JSON columns instead of throwing', async () => {
    await db.execute(
      `INSERT INTO games (id, title, release_date, release_status, personal_status, priority,
        platforms, genres, developers, publishers, tag_ids, screenshots, trailers, links,
        locked_fields, external_ids, created_at, updated_at)
       VALUES ('bad', 'Corrupt', '2027-13', 'bogus', 'nope', 'urgent',
        'not json', '{"a":1}', '[1,2]', 'null', '[1,"x"]', '["javascript:alert(1)", "https://ok.example/1.png"]',
        '[{"url":5}]', '[{"url":"https://x.example"}]', '{', '[1,2]', 'c', 'u')`,
    )
    const [game] = await repo.listGames()
    expect(game).toEqual({
      ...createEmptyGame('c', 'bad'),
      title: 'Corrupt',
      // A valid JSON column survives (and is still normalized).
      screenshots: ['https://ok.example/1.png'],
      updatedAt: 'u',
    })
  })

  it('accepts trailers/links/external ids only in the right shape', () => {
    const base = {
      id: 'x',
      title: 'X',
      summary: '',
      cover_url: '',
      release_date: '',
      release_status: 'announced',
      personal_status: 'none',
      priority: 'interested',
      platforms: '[]',
      genres: '[]',
      developers: '[]',
      publishers: '[]',
      tag_ids: '[]',
      screenshots: '[]',
      trailers: '[]',
      links: '[]',
      locked_fields: '[]',
      external_ids: '{}',
      created_at: 'c',
      updated_at: 'u',
    }
    expect(rowToGame({ ...base, trailers: '[null]' }).trailers).toEqual([])
    expect(rowToGame({ ...base, trailers: '[{"title":"T","url":"https://t.example"}]' }).trailers).toEqual([
      { title: 'T', url: 'https://t.example' },
    ])
    expect(rowToGame({ ...base, links: '[{"label":1,"url":"https://t.example"}]' }).links).toEqual([])
    expect(rowToGame({ ...base, external_ids: '{"igdb":1942}' }).externalIds).toEqual({})
    expect(rowToGame({ ...base, external_ids: '{"igdb":"1942"}' }).externalIds).toEqual({ igdb: '1942' })
    expect(rowToGame({ ...base, external_ids: 'null' }).externalIds).toEqual({})
  })

  it('copes with NULL and non-string scalar columns', () => {
    const row = {
      id: 7,
      title: null,
      summary: undefined,
      cover_url: null,
      release_date: 2027,
      release_status: null,
      personal_status: null,
      priority: null,
      platforms: null,
      genres: 5,
      developers: undefined,
      publishers: '[]',
      tag_ids: '[]',
      screenshots: '[]',
      trailers: '[]',
      links: '[]',
      locked_fields: '[]',
      external_ids: '{}',
      created_at: null,
      updated_at: null,
    } as unknown as Parameters<typeof rowToGame>[0]
    expect(rowToGame(row)).toEqual({ ...createEmptyGame('', '7'), releaseDate: '2027' })
  })
})

describe('tags', () => {
  it('saves, lists and deletes tags', async () => {
    const a = tag('a', 'Co-op', '#12a594')
    const b = tag('bb', 'Story-rich')
    await repo.saveTag(a)
    await repo.saveTag(b)
    expect((await repo.listTags()).sort((x, y) => x.id.localeCompare(y.id))).toEqual([a, b])
    await repo.deleteTag('a')
    expect(await repo.listTags()).toEqual([b])
  })

  it('trims the name', async () => {
    await repo.saveTag(tag('a', '  Co-op  '))
    expect((await repo.listTags())[0].name).toBe('Co-op')
  })

  it('updates name and color in place, keeping createdAt', async () => {
    const a = tag('a', 'Co-op', '#000000')
    await repo.saveTag(a)
    await repo.saveTag({ ...a, name: 'Couch co-op', color: '#ffffff', createdAt: 'changed' })
    expect(await repo.listTags()).toEqual([{ ...a, name: 'Couch co-op', color: '#ffffff' }])
  })

  it('allows changing the case of a tag’s own name', async () => {
    const a = tag('a', 'co-op')
    await repo.saveTag(a)
    await repo.saveTag({ ...a, name: 'Co-op' })
    expect((await repo.listTags())[0].name).toBe('Co-op')
  })

  it('refuses a second tag whose name differs only in case', async () => {
    await repo.saveTag(tag('a', 'Co-op'))
    await expect(repo.saveTag(tag('b', 'co-op'))).rejects.toThrow(/UNIQUE/)
    await expect(repo.saveTag(tag('c', '  CO-OP '))).rejects.toThrow(/UNIQUE/)
    expect(await repo.listTags()).toHaveLength(1)
  })

  it('refuses renaming a tag onto another tag’s name', async () => {
    await repo.saveTag(tag('a', 'Co-op'))
    const b = tag('b', 'Solo')
    await repo.saveTag(b)
    await expect(repo.saveTag({ ...b, name: 'CO-OP' })).rejects.toThrow(/UNIQUE/)
    expect((await repo.listTags()).find((t) => t.id === 'b')?.name).toBe('Solo')
  })

  it('leaves dangling tag ids on games (the store cleans them up)', async () => {
    await repo.saveTag(tag('tag-a', 'A'))
    await repo.saveGame(fullGame())
    await repo.deleteTag('tag-a')
    expect((await repo.listGames())[0].tagIds).toEqual(['tag-a', 'tag-b'])
  })
})

describe('saved views', () => {
  const config: ViewConfig = {
    filters: {
      ...DEFAULT_FILTERS,
      search: 'odyssey',
      priorities: ['must'],
      tagIds: ['t1'],
      tagMatch: 'all',
      platforms: ['PC'],
      releaseWindow: 'upcoming',
    },
    sort: { field: 'priority', direction: 'desc' },
    mode: 'table',
  }

  it('round-trips a view', async () => {
    const view = savedView('v1', 'Must plays', config, 3)
    await repo.saveView(view)
    expect(await repo.listSavedViews(new Set(['t1']))).toEqual([view])
  })

  it('lists views by position, then creation time', async () => {
    await repo.saveView(savedView('c', 'C', DEFAULT_VIEW, 1, '2026-01-01'))
    await repo.saveView(savedView('a', 'A', DEFAULT_VIEW, 0, '2026-03-01'))
    await repo.saveView(savedView('b', 'B', DEFAULT_VIEW, 1, '2025-12-31'))
    expect((await repo.listSavedViews(new Set())).map((v) => v.id)).toEqual(['a', 'b', 'c'])
  })

  it('upserts name, config and position; trims the name', async () => {
    await repo.saveView(savedView('v1', 'Old', DEFAULT_VIEW, 0))
    await repo.saveView(savedView('v1', '  New name ', config, 5, 'changed'))
    expect(await repo.listSavedViews(new Set(['t1']))).toEqual([
      savedView('v1', 'New name', config, 5, '2026-01-01T00:00:00.000Z'),
    ])
  })

  it('drops deleted tags from the config when reading', async () => {
    await repo.saveView(savedView('v1', 'V', config))
    const [view] = await repo.listSavedViews(new Set())
    expect(view.config.filters.tagIds).toEqual([])
    expect(view.config.filters.priorities).toEqual(['must'])
  })

  it('repairs corrupted configs instead of failing', async () => {
    await db.execute(
      `INSERT INTO saved_views (id, name, config, position, created_at) VALUES
        ('broken', 'Broken', '{not json', 0, 'a'),
        ('wrong', 'Wrong shape', '[1,2,3]', 1, 'b'),
        ('partial', 'Partial', '{"sort":{"field":"bogus","direction":"down"},"mode":"list","filters":{"priorities":["must","nope"]}}', 2, 'c'),
        ('pos', 'Bad position', 'null', 'x', 'd')`,
    )
    const views = await repo.listSavedViews(new Set())
    // SQLite sorts the non-numeric position after all numbers.
    expect(views.map((v) => v.id)).toEqual(['broken', 'wrong', 'partial', 'pos'])
    const byId = new Map(views.map((v) => [v.id, v]))
    expect(byId.get('broken')!.config).toEqual(DEFAULT_VIEW)
    expect(byId.get('wrong')!.config).toEqual(DEFAULT_VIEW)
    expect(byId.get('pos')!.config).toEqual(DEFAULT_VIEW)
    expect(byId.get('pos')!.position).toBe(0)
    expect(byId.get('partial')!.config).toEqual({
      ...DEFAULT_VIEW,
      filters: { ...DEFAULT_FILTERS, priorities: ['must'] },
    })
  })

  it('deletes a view', async () => {
    await repo.saveView(savedView('v1', 'One', DEFAULT_VIEW))
    await repo.saveView(savedView('v2', 'Two', DEFAULT_VIEW, 1))
    await repo.deleteView('v1')
    expect((await repo.listSavedViews(new Set())).map((v) => v.id)).toEqual(['v2'])
  })
})

describe('settings', () => {
  it('defaults to dark theme and no last view', async () => {
    expect(await repo.getSettings(new Set())).toEqual({ theme: 'dark', lastView: null })
  })

  it('round-trips the theme', async () => {
    await repo.setSetting('theme', 'light')
    expect((await repo.getSettings(new Set())).theme).toBe('light')
    await repo.setSetting('theme', 'dark')
    expect((await repo.getSettings(new Set())).theme).toBe('dark')
  })

  it('treats an unknown theme as dark', async () => {
    await repo.setSetting('theme', 'solarized')
    expect((await repo.getSettings(new Set())).theme).toBe('dark')
  })

  it('round-trips the last view, dropping deleted tags', async () => {
    const view: ViewConfig = {
      filters: { ...DEFAULT_FILTERS, tagIds: ['keep', 'gone'], genres: ['RPG'] },
      sort: { field: 'updatedAt', direction: 'desc' },
      mode: 'table',
    }
    await repo.setSetting('lastView', view)
    expect((await repo.getSettings(new Set(['keep', 'gone']))).lastView).toEqual(view)
    expect((await repo.getSettings(new Set(['keep']))).lastView).toEqual({
      ...view,
      filters: { ...view.filters, tagIds: ['keep'] },
    })
  })

  it('overwrites a setting instead of adding a row', async () => {
    await repo.setSetting('lastView', DEFAULT_VIEW)
    await repo.setSetting('lastView', { ...DEFAULT_VIEW, mode: 'table' })
    const rows = await db.select('SELECT * FROM settings')
    expect(rows).toHaveLength(1)
    expect((await repo.getSettings(new Set())).lastView?.mode).toBe('table')
  })

  it('repairs a corrupted last view', async () => {
    await db.execute("INSERT INTO settings (key, value) VALUES ('lastView', '{oops')")
    expect((await repo.getSettings(new Set())).lastView).toEqual(DEFAULT_VIEW)
  })
})

describe('sanitizeViewConfig', () => {
  it('keeps a valid config', () => {
    const view: ViewConfig = {
      filters: { ...DEFAULT_FILTERS, releaseWindow: 'tba' },
      sort: { field: 'tags', direction: 'desc' },
      mode: 'table',
    }
    expect(sanitizeViewConfig(structuredClone(view), new Set())).toEqual(view)
  })

  it.each([null, undefined, 'x', 3, [], { sort: 'title' }, { sort: null, filters: 'x', mode: 4 }])(
    'turns %j into the default view',
    (raw) => {
      expect(sanitizeViewConfig(raw, new Set())).toEqual(DEFAULT_VIEW)
    },
  )

  it('accepts every sort field', () => {
    const fields = ['title', 'priority', 'releaseDate', 'releaseStatus', 'personalStatus', 'platforms', 'genres', 'developers', 'publishers', 'tags', 'createdAt', 'updatedAt'] as const
    for (const field of fields) {
      expect(sanitizeViewConfig({ sort: { field, direction: 'desc' } }, new Set()).sort).toEqual({ field, direction: 'desc' })
    }
  })
})
