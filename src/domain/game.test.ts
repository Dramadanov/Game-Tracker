import { describe, expect, it } from 'vitest'
import {
  cleanList,
  createEmptyGame,
  foldText,
  isWebUrl,
  monogram,
  newId,
  normalizeGame,
  validateGame,
  youtubeThumbnail,
  youtubeVideoId,
} from './game'
import type { Game } from './types'

const NOW = '2026-10-06T10:00:00.000Z'

function game(patch: Partial<Game> = {}): Game {
  return { ...createEmptyGame(NOW, 'g1'), title: 'Test Game', ...patch }
}

describe('newId', () => {
  it('returns distinct RFC 4122 v4 ids', () => {
    const ids = new Set(Array.from({ length: 50 }, newId))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('createEmptyGame', () => {
  it('uses the given timestamp and id, with sensible defaults', () => {
    const g = createEmptyGame(NOW, 'abc')
    expect(g).toMatchObject({
      id: 'abc',
      title: '',
      releaseDate: '',
      releaseStatus: 'announced',
      personalStatus: 'none',
      priority: 'interested',
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(g.platforms).toEqual([])
    expect(g.externalIds).toEqual({})
  })

  it('never shares arrays between games', () => {
    const a = createEmptyGame()
    const b = createEmptyGame()
    a.platforms.push('PC')
    expect(b.platforms).toEqual([])
    expect(a.id).not.toBe(b.id)
  })
})

describe('foldText', () => {
  it('ignores case, accents and surrounding whitespace', () => {
    expect(foldText('  Ötzi  ')).toBe('otzi')
    expect(foldText('Pokémon')).toBe('pokemon')
    expect(foldText('ÉLDEN Ríng')).toBe('elden ring')
    // Already-decomposed input folds the same way.
    expect(foldText('O\u0308tzi')).toBe('otzi')
  })
})

describe('cleanList', () => {
  it('trims, collapses inner whitespace and drops empty entries', () => {
    expect(cleanList(['  PC ', '', '   ', 'PlayStation   5', '\tXbox\nSeries X|S '])).toEqual([
      'PC',
      'PlayStation 5',
      'Xbox Series X|S',
    ])
  })

  it('removes case- and accent-insensitive duplicates, keeping the first spelling', () => {
    expect(cleanList(['RPG', 'rpg', ' Rpg ', 'Action'])).toEqual(['RPG', 'Action'])
    expect(cleanList(['pc', 'PC'])).toEqual(['pc'])
    expect(cleanList(['Pokémon', 'Pokemon', 'POKÉMON'])).toEqual(['Pokémon'])
  })

  it('keeps order and does not mutate the input', () => {
    const input = ['b', 'a', 'B']
    expect(cleanList(input)).toEqual(['b', 'a'])
    expect(input).toEqual(['b', 'a', 'B'])
  })
})

describe('isWebUrl', () => {
  it.each([
    'https://example.com',
    'http://example.com/a?b=c#d',
    '  https://example.com/cover.png  ',
    'HTTPS://EXAMPLE.COM/x',
  ])('accepts %j', (value) => {
    expect(isWebUrl(value)).toBe(true)
  })

  it.each([
    '',
    '   ',
    'example.com',
    '/relative/path.png',
    'cover.png',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'file:///C:/Users/me/cover.png',
    'ftp://example.com/file',
    'mailto:me@example.com',
    'http://',
  ])('rejects %j', (value) => {
    expect(isWebUrl(value)).toBe(false)
  })
})

describe('normalizeGame', () => {
  it('trims text and collapses whitespace in the title', () => {
    const g = normalizeGame(game({ title: '  Hollow   Knight\n Silksong ', summary: '\n  A summary.\n\nSecond paragraph.  ' }))
    expect(g.title).toBe('Hollow Knight Silksong')
    // Summary keeps its inner line breaks.
    expect(g.summary).toBe('A summary.\n\nSecond paragraph.')
  })

  it('cleans every list field, de-duplicating case-insensitively and keeping the first spelling', () => {
    const g = normalizeGame(
      game({
        platforms: [' PC', 'pc', 'PlayStation 5', ''],
        genres: ['RPG', 'rpg', 'Action  RPG'],
        developers: ['FromSoftware', 'fromsoftware '],
        publishers: ['Bandai Namco', 'BANDAI NAMCO', '  '],
      }),
    )
    expect(g.platforms).toEqual(['PC', 'PlayStation 5'])
    expect(g.genres).toEqual(['RPG', 'Action RPG'])
    expect(g.developers).toEqual(['FromSoftware'])
    expect(g.publishers).toEqual(['Bandai Namco'])
  })

  it('de-duplicates tag ids and locked fields and drops empty ones', () => {
    const g = normalizeGame(game({ tagIds: ['a', 'b', 'a', ''], lockedFields: ['title', 'title', ''] }))
    expect(g.tagIds).toEqual(['a', 'b'])
    expect(g.lockedFields).toEqual(['title'])
  })

  it('keeps only web URLs for the cover', () => {
    expect(normalizeGame(game({ coverUrl: '  https://img.example.com/c.jpg ' })).coverUrl).toBe(
      'https://img.example.com/c.jpg',
    )
    expect(normalizeGame(game({ coverUrl: 'javascript:alert(1)' })).coverUrl).toBe('')
    expect(normalizeGame(game({ coverUrl: 'data:image/png;base64,AAAA' })).coverUrl).toBe('')
    expect(normalizeGame(game({ coverUrl: 'cover.jpg' })).coverUrl).toBe('')
  })

  it('drops invalid and duplicate screenshot URLs', () => {
    const g = normalizeGame(
      game({
        screenshots: [
          'https://img.example.com/1.jpg',
          ' https://img.example.com/1.jpg ',
          'javascript:alert(1)',
          'not a url',
          '',
          'https://img.example.com/2.jpg',
        ],
      }),
    )
    expect(g.screenshots).toEqual(['https://img.example.com/1.jpg', 'https://img.example.com/2.jpg'])
  })

  it('treats screenshot URLs that differ only in case as different images', () => {
    // URL paths are case-sensitive (e.g. image hosts with mixed-case ids).
    const g = normalizeGame(game({ screenshots: ['https://i.example.com/aBc.png', 'https://i.example.com/abc.png'] }))
    expect(g.screenshots).toEqual(['https://i.example.com/aBc.png', 'https://i.example.com/abc.png'])
  })

  it('cleans trailers and links: web URLs only, trimmed, de-duplicated by URL', () => {
    const g = normalizeGame(
      game({
        trailers: [
          { title: '  Reveal   trailer ', url: ' https://youtu.be/dQw4w9WgXcQ ' },
          { title: 'Duplicate', url: 'https://youtu.be/dQw4w9WgXcQ' },
          { title: 'Evil', url: 'javascript:alert(1)' },
          { title: '', url: 'https://example.com/t2' },
        ],
        links: [
          { label: ' Steam ', url: 'https://store.steampowered.com/app/1' },
          { label: 'Steam again', url: 'https://store.steampowered.com/app/1' },
          { label: 'Bad', url: 'javascript:void(0)' },
          { label: 'Relative', url: '/wiki' },
        ],
      }),
    )
    expect(g.trailers).toEqual([
      { title: 'Reveal trailer', url: 'https://youtu.be/dQw4w9WgXcQ' },
      { title: '', url: 'https://example.com/t2' },
    ])
    expect(g.links).toEqual([{ label: 'Steam', url: 'https://store.steampowered.com/app/1' }])
  })

  it('falls back to defaults for unknown enum values', () => {
    const g = normalizeGame(
      game({
        priority: 'urgent' as Game['priority'],
        releaseStatus: 'delayed' as Game['releaseStatus'],
        personalStatus: 'owned' as Game['personalStatus'],
      }),
    )
    expect(g.priority).toBe('interested')
    expect(g.releaseStatus).toBe('announced')
    expect(g.personalStatus).toBe('none')
  })

  it('keeps known enum values', () => {
    const g = normalizeGame(game({ priority: 'must', releaseStatus: 'cancelled', personalStatus: 'skipped' }))
    expect(g).toMatchObject({ priority: 'must', releaseStatus: 'cancelled', personalStatus: 'skipped' })
  })

  it('trims valid release dates and clears invalid ones', () => {
    expect(normalizeGame(game({ releaseDate: ' 2027-Q2 ' })).releaseDate).toBe('2027-Q2')
    expect(normalizeGame(game({ releaseDate: '2027-02-30' })).releaseDate).toBe('')
    expect(normalizeGame(game({ releaseDate: 'soon' })).releaseDate).toBe('')
    expect(normalizeGame(game({ releaseDate: '   ' })).releaseDate).toBe('')
  })

  it('leaves id, timestamps and external ids untouched', () => {
    const input = game({ id: 'keep-me', createdAt: 'c', updatedAt: 'u', externalIds: { igdb: '1942' } })
    const g = normalizeGame(input)
    expect(g.id).toBe('keep-me')
    expect(g.createdAt).toBe('c')
    expect(g.updatedAt).toBe('u')
    expect(g.externalIds).toEqual({ igdb: '1942' })
  })

  it('does not mutate its input and is idempotent', () => {
    const input = game({ title: '  A  ', platforms: ['PC', 'pc'], screenshots: ['bad'] })
    const snapshot = structuredClone(input)
    const once = normalizeGame(input)
    expect(input).toEqual(snapshot)
    expect(normalizeGame(once)).toEqual(once)
  })
})

describe('validateGame', () => {
  it('accepts a game with a title and a valid date', () => {
    expect(validateGame(game())).toEqual([])
    expect(validateGame(game({ releaseDate: '2027-Q1' }))).toEqual([])
    expect(validateGame(game({ releaseDate: ' 2027-01-31 ' }))).toEqual([])
  })

  it('requires a non-blank title', () => {
    expect(validateGame(game({ title: '' }))).toEqual(['Title is required.'])
    expect(validateGame(game({ title: '  \n ' }))).toEqual(['Title is required.'])
  })

  it('rejects an invalid release date', () => {
    expect(validateGame(game({ releaseDate: '2027-02-30' }))).toEqual(['Release date is not valid.'])
  })

  it('reports every problem', () => {
    expect(validateGame(game({ title: '', releaseDate: '2027-13' }))).toHaveLength(2)
  })
})

describe('youtubeVideoId', () => {
  const ID = 'dQw4w9WgXcQ'

  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}`],
    [`http://youtube.com/watch?v=${ID}`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://music.youtube.com/watch?v=${ID}`],
    [`https://WWW.YOUTUBE.COM/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&t=42s`],
    [`https://www.youtube.com/watch?feature=share&v=${ID}&list=PL123`],
    [`https://www.youtube.com/watch?v=${ID}#comments`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abcdef&t=10`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube.com/embed/${ID}?autoplay=1`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://youtube-nocookie.com/embed/${ID}?start=5`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://youtube.com/shorts/${ID}?feature=share`],
    [`https://www.youtube.com/live/${ID}`],
    [`https://www.youtube.com/v/${ID}`],
    [`  https://youtu.be/${ID}  `],
  ])('extracts the id from %s', (url) => {
    expect(youtubeVideoId(url)).toBe(ID)
  })

  it('accepts ids with dashes and underscores', () => {
    expect(youtubeVideoId('https://youtu.be/a-b_c-d_e-f')).toBe('a-b_c-d_e-f')
  })

  it.each([
    [''],
    ['not a url'],
    [ID],
    ['youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch'],
    ['https://www.youtube.com/watch?v='],
    ['https://www.youtube.com/watch?v=short'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQX'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXc!'],
    ['https://youtu.be/'],
    ['https://youtu.be/tooShort'],
    ['https://www.youtube.com/embed/'],
    ['https://www.youtube.com/@SomeChannel'],
    ['https://www.youtube.com/playlist?list=PL123'],
    ['https://vimeo.com/123456789'],
    ['https://notyoutube.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'],
    ['https://evil.example/youtu.be/dQw4w9WgXcQ'],
    ['javascript:alert("https://youtu.be/dQw4w9WgXcQ")'],
  ])('returns null for %j', (url) => {
    expect(youtubeVideoId(url)).toBeNull()
  })

  it('builds a thumbnail URL', () => {
    expect(youtubeThumbnail(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`)
  })
})

describe('monogram', () => {
  it('uses the first letters of the first two words', () => {
    expect(monogram('Hollow Knight')).toBe('HK')
    expect(monogram('the legend of zelda')).toBe('TL')
  })

  it('uses the first two letters of a single word', () => {
    expect(monogram('Celeste')).toBe('CE')
    expect(monogram('x')).toBe('X')
    expect(monogram('1942')).toBe('19')
  })

  it('ignores punctuation and symbols', () => {
    expect(monogram('S.T.A.L.K.E.R. 2')).toBe('ST')
    expect(monogram('  -- Doom -- ')).toBe('DO')
    expect(monogram('🎮 Party Time')).toBe('PT')
  })

  it('keeps words with apostrophes together', () => {
    expect(monogram("Baldur's Gate 3")).toBe('BG')
    expect(monogram('Assassin’s Creed Shadows')).toBe('AC')
    expect(monogram("Don't Starve")).toBe('DS')
    expect(monogram("'Splosion Man")).toBe('SM')
  })

  it('handles non-Latin and accented titles', () => {
    expect(monogram('Ōkami')).toBe('ŌK')
    expect(monogram('ötzi örtel')).toBe('ÖÖ')
    expect(monogram('大神')).toBe('大神')
    expect(monogram('Ведьмак 3')).toBe('В3')
  })

  it('never splits characters outside the Basic Multilingual Plane', () => {
    expect(monogram('𝕏 Racer')).toBe('𝕏R')
    expect(monogram('𝕏𝕐𝕫')).toBe('𝕏𝕐')
    const wellFormed = /^(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF])*$/
    for (const value of [monogram('𝕏 Racer'), monogram('𝕏𝕐𝕫'), monogram('𝕏')]) {
      expect(value).toMatch(wellFormed)
    }
  })

  it('returns a placeholder for empty titles', () => {
    expect(monogram('')).toBe('?')
    expect(monogram('   ')).toBe('?')
    expect(monogram('!!! ???')).toBe('?')
  })
})
