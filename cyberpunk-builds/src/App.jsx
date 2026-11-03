import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { CYBERPUNK_CATALOG } from './cyberpunkCatalog'
import './App.css'

const ARCHETYPES = [
  'Netrunner',
  'Samurai',
  'Gunslinger',
  'Stealth/Assassin',
  'Tank',
  'Engineer',
  'Ninja',
]

const ATTRIBUTE_NAMES = [
  'Body',
  'Reflexes',
  'Technical Ability',
  'Intelligence',
  'Cool',
]
const ATTRIBUTE_STARTING_POINTS = 3
const ATTRIBUTE_TOTAL_POINTS = 71
const ATTRIBUTE_MAX_POINTS = 20
const DEFAULT_ATTRIBUTES = Object.fromEntries(
  ATTRIBUTE_NAMES.map((attribute) => [attribute, ATTRIBUTE_STARTING_POINTS]),
)

const CYBERWARE_HIGHLIGHTS = [
  {
    name: 'Sandevistan',
    slot: 'OPERATING SYSTEM',
    feature: 'A combat-focused OS for quick, aggressive plays and time-dilation effects.',
    code: 'OS / 01',
  },
  {
    name: 'Mantis Blades',
    slot: 'ARMS',
    feature: 'Retractable arm blades built for close-range combat.',
    code: 'ARM / 02',
  },
  {
    name: 'Gorilla Arms',
    slot: 'ARMS',
    feature: 'Reinforced arms that bring extra force to melee encounters.',
    code: 'ARM / 03',
  },
  {
    name: 'Kiroshi Optics',
    slot: 'EYES',
    feature: 'Enhanced optics for scanning people, devices, and your surroundings.',
    code: 'VIS / 04',
  },
  {
    name: 'Reinforced Tendons',
    slot: 'LEGS',
    feature: 'Leg cyberware that unlocks a powerful double-jump movement option.',
    code: 'LEG / 05',
  },
  {
    name: 'Monowire',
    slot: 'ARMS',
    feature: 'A concealed filament weapon with a fast, sweeping melee style.',
    code: 'ARM / 06',
  },
]

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_KEY)
const LOCAL_BUILDS_KEY = 'neonchrome-builds'
const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

const SETUP_SQL = `create table public.builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  archetype text not null check (archetype in ('Netrunner', 'Samurai', 'Gunslinger', 'Stealth/Assassin', 'Tank', 'Engineer', 'Ninja')),
  description text not null default '',
  attributes jsonb not null default '{"Body":15,"Reflexes":14,"Technical Ability":14,"Intelligence":14,"Cool":14}'::jsonb
    check (
      jsonb_typeof(attributes) = 'object'
      and attributes ?& array['Body', 'Reflexes', 'Technical Ability', 'Intelligence', 'Cool']
      and jsonb_typeof(attributes->'Body') = 'number'
      and jsonb_typeof(attributes->'Reflexes') = 'number'
      and jsonb_typeof(attributes->'Technical Ability') = 'number'
      and jsonb_typeof(attributes->'Intelligence') = 'number'
      and jsonb_typeof(attributes->'Cool') = 'number'
      and (attributes->>'Body')::integer between 3 and 20
      and (attributes->>'Reflexes')::integer between 3 and 20
      and (attributes->>'Technical Ability')::integer between 3 and 20
      and (attributes->>'Intelligence')::integer between 3 and 20
      and (attributes->>'Cool')::integer between 3 and 20
      and (attributes->>'Body')::integer
        + (attributes->>'Reflexes')::integer
        + (attributes->>'Technical Ability')::integer
        + (attributes->>'Intelligence')::integer
        + (attributes->>'Cool')::integer = 71
    ),
  equipment jsonb not null default '[]'::jsonb check (jsonb_typeof(equipment) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.builds enable row level security;

grant select, insert, update, delete on public.builds to authenticated;

create policy "Users manage their own builds"
on public.builds for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);`

const UPDATE_SCHEMA_SQL = `alter table public.builds
  add column if not exists attributes jsonb not null
    default '{"Body":15,"Reflexes":14,"Technical Ability":14,"Intelligence":14,"Cool":14}'::jsonb
    check (
      jsonb_typeof(attributes) = 'object'
      and attributes ?& array['Body', 'Reflexes', 'Technical Ability', 'Intelligence', 'Cool']
      and jsonb_typeof(attributes->'Body') = 'number'
      and jsonb_typeof(attributes->'Reflexes') = 'number'
      and jsonb_typeof(attributes->'Technical Ability') = 'number'
      and jsonb_typeof(attributes->'Intelligence') = 'number'
      and jsonb_typeof(attributes->'Cool') = 'number'
      and (attributes->>'Body')::integer between 3 and 20
      and (attributes->>'Reflexes')::integer between 3 and 20
      and (attributes->>'Technical Ability')::integer between 3 and 20
      and (attributes->>'Intelligence')::integer between 3 and 20
      and (attributes->>'Cool')::integer between 3 and 20
      and (attributes->>'Body')::integer
        + (attributes->>'Reflexes')::integer
        + (attributes->>'Technical Ability')::integer
        + (attributes->>'Intelligence')::integer
        + (attributes->>'Cool')::integer = 71
    ),
  add column if not exists equipment jsonb not null default '[]'::jsonb
    check (jsonb_typeof(equipment) = 'array');`

function getRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean)

  if (parts.length === 0) return { page: 'home' }
  if (parts[0] === 'new') return { page: 'create' }
  if (parts[0] === 'builds' && parts[1] && parts[2] === 'edit') {
    return { page: 'edit', id: parts[1] }
  }
  if (parts[0] === 'builds' && parts[1]) {
    return { page: 'detail', id: parts[1] }
  }
  return { page: 'not-found' }
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getSafeReferenceUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

async function fetchBuildRows() {
  const { data, error } = await supabase
    .from('builds')
    .select('id, name, archetype, description, attributes, equipment, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

function readLocalBuilds() {
  try {
    const builds = JSON.parse(localStorage.getItem(LOCAL_BUILDS_KEY) ?? '[]')
    if (!Array.isArray(builds)) throw new Error('Saved builds data is not a list.')
    return {
      builds: builds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      error: '',
    }
  } catch (error) {
    return {
      builds: [],
      error: `Could not read locally saved builds: ${error.message}`,
    }
  }
}

function App() {
  const [route, setRoute] = useState(() => getRoute(window.location.pathname))
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(hasSupabaseConfig)
  const [localBuildState] = useState(() => readLocalBuilds())
  const [localMode, setLocalMode] = useState(!hasSupabaseConfig)
  const [builds, setBuilds] = useState(hasSupabaseConfig ? null : localBuildState.builds)
  const [loadError, setLoadError] = useState(localBuildState.error)
  const [notice, setNotice] = useState('')

  const user = session?.user
  const buildsLoading = Boolean(hasSupabaseConfig && (authLoading || (user && builds === null)))

  const navigate = useCallback((path) => {
    const [pathname, hash] = path.split('#')
    window.history.pushState({}, '', path)
    setRoute(getRoute(pathname || '/'))
    setNotice('')
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
      })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRoute(window.location.pathname))
      setNotice('')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let active = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setBuilds(nextSession ? null : [])
        setLoadError('')
      }
    })

    async function initializeSession() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!active) return

        if (data.session) {
          setSession(data.session)
          return
        }

        const { data: anonymousData, error: anonymousError } =
          await supabase.auth.signInAnonymously()
        if (anonymousError) throw anonymousError
        if (active) setSession(anonymousData.session)
      } catch (error) {
        if (active) {
          setLocalMode(true)
          setBuilds(localBuildState.builds)
          setLoadError(`Could not connect to Supabase: ${error.message}. Builds will be saved in this browser.`)
        }
      } finally {
        if (active) setAuthLoading(false)
      }
    }

    initializeSession()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [localBuildState])

  const refreshBuilds = useCallback(async () => {
    if (!localMode && supabase && user) {
      setLoadError('')
      try {
        setBuilds(await fetchBuildRows())
      } catch (error) {
        setLoadError(`Could not load your builds: ${error.message}`)
      }
      return
    }

    if (localMode) {
      const localBuilds = readLocalBuilds()
      if (localBuilds.error) throw new Error(localBuilds.error)
      setBuilds(localBuilds.builds)
    }
  }, [localMode, user])

  useEffect(() => {
    if (!user || localMode) return undefined

    let active = true
    fetchBuildRows().then((rows) => {
      if (active) setBuilds(rows)
    }).catch((error) => {
      if (!active) return
      setBuilds([])
      setLoadError(`Could not load your builds: ${error.message}`)
    })

    return () => {
      active = false
    }
  }, [localMode, user])

  const selectedBuild = useMemo(
    () => builds?.find((build) => build.id === route.id),
    [builds, route.id],
  )

  async function saveBuild(event, buildId) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    let attributes
    let equipment
    try {
      attributes = JSON.parse(String(formData.get('attributes')))
      equipment = JSON.parse(String(formData.get('equipment')))
    } catch (error) {
      setLoadError(`Could not read the build attributes or equipment: ${error.message}`)
      return
    }

    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
      setLoadError('Choose valid values for all five attributes.')
      return
    }

    attributes = Object.fromEntries(
      ATTRIBUTE_NAMES.map((attribute) => [attribute, Number(attributes[attribute])]),
    )
    const attributeValues = Object.values(attributes)
    const totalAttributePoints = attributeValues.reduce((total, points) => total + points, 0)
    if (
      attributeValues.some((points) => !Number.isInteger(points) || points < ATTRIBUTE_STARTING_POINTS || points > ATTRIBUTE_MAX_POINTS)
      || totalAttributePoints !== ATTRIBUTE_TOTAL_POINTS
    ) {
      setLoadError(`Attributes must total ${ATTRIBUTE_TOTAL_POINTS} points, with each between ${ATTRIBUTE_STARTING_POINTS} and ${ATTRIBUTE_MAX_POINTS}.`)
      return
    }

    if (!Array.isArray(equipment)) {
      setLoadError('Could not read the weapons and gear list.')
      return
    }

    equipment = equipment
      .filter((item) => String(item.name ?? '').trim())
      .map((item) => ({
        id: item.id,
        catalogId: item.catalogId,
        type: item.type === 'Gear' ? 'Gear' : 'Weapon',
        category: String(item.category ?? ''),
        name: String(item.name).trim(),
        description: String(item.description ?? ''),
        notes: String(item.notes ?? ''),
        referenceUrl: String(item.referenceUrl ?? '').trim(),
      }))
    for (const item of equipment) {
      if (item.referenceUrl) {
        try {
          const referenceUrl = new URL(item.referenceUrl)
          if (!['http:', 'https:'].includes(referenceUrl.protocol)) throw new Error('Use an http or https link.')
        } catch (error) {
          setLoadError(`Invalid Wiki reference for "${item.name}": ${error.message}`)
          return
        }
      }
    }

    const values = {
      name: String(formData.get('name')).trim(),
      archetype: String(formData.get('archetype')),
      description: String(formData.get('description')).trim(),
      attributes,
      equipment,
      updated_at: new Date().toISOString(),
    }

    if (!values.name) {
      setLoadError('Enter a name for your build.')
      return
    }

    setLoadError('')
    setNotice('')
    try {
      if (!localMode && supabase && user) {
        if (buildId) {
          const { data, error } = await supabase
            .from('builds')
            .update(values)
            .eq('id', buildId)
            .select('id')
            .single()
          if (error) throw error
          if (!data) throw new Error('That build is no longer available.')
          await refreshBuilds()
          setNotice('Build updated.')
          setRoute({ page: 'edit', id: buildId })
        } else {
          const { data, error } = await supabase
            .from('builds')
            .insert({ ...values, user_id: user.id })
            .select('id')
            .single()
          if (error) throw error
          await refreshBuilds()
          navigate(`/builds/${data.id}`)
          setNotice('Build created.')
        }
      } else if (!localMode && supabase) {
        throw new Error('Your anonymous session is unavailable. Refresh the page to try again.')
      } else {
        const now = new Date().toISOString()
        const savedBuilds = JSON.parse(localStorage.getItem(LOCAL_BUILDS_KEY) ?? '[]')
        let nextBuilds
        let savedBuildId = buildId
        if (buildId) {
          let found = false
          nextBuilds = savedBuilds.map((build) => {
            if (build.id !== buildId) return build
            found = true
            return { ...build, ...values }
          })
          if (!found) throw new Error('That build is no longer available.')
          setNotice('Build updated. It is saved in this browser.')
        } else {
          savedBuildId = crypto.randomUUID()
          nextBuilds = [
            { ...values, id: savedBuildId, created_at: now },
            ...savedBuilds,
          ]
        }
        localStorage.setItem(LOCAL_BUILDS_KEY, JSON.stringify(nextBuilds))
        setBuilds(nextBuilds)
        if (buildId) setRoute({ page: 'edit', id: buildId })
        else {
          navigate(`/builds/${savedBuildId}`)
          setNotice('Build created. It is saved in this browser.')
        }
        if (buildId) setNotice('Build updated. It is saved in this browser.')
      }
    } catch (error) {
      setLoadError(`Could not save your build: ${error.message}`)
    }
  }

  async function deleteBuild(buildId) {
    if (!window.confirm('Delete this build? This cannot be undone.')) return

    setLoadError('')
    try {
      if (!localMode && supabase && user) {
        const { data, error } = await supabase
          .from('builds')
          .delete()
          .eq('id', buildId)
          .select('id')
          .single()
        if (error) throw error
        if (!data) throw new Error('That build is no longer available.')
        await refreshBuilds()
      } else if (!localMode && supabase) {
        throw new Error('Your anonymous session is unavailable. Refresh the page to try again.')
      } else {
        const savedBuilds = JSON.parse(localStorage.getItem(LOCAL_BUILDS_KEY) ?? '[]')
        const nextBuilds = savedBuilds.filter((build) => build.id !== buildId)
        if (nextBuilds.length === savedBuilds.length) throw new Error('That build is no longer available.')
        localStorage.setItem(LOCAL_BUILDS_KEY, JSON.stringify(nextBuilds))
        setBuilds(nextBuilds)
      }
      navigate('/')
      setNotice('Build deleted.')
    } catch (error) {
      setLoadError(`Could not delete your build: ${error.message}`)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate('/')}>
          <span className="brand-mark">NC</span>
          <span>NEON<span className="brand-accent">CHROME</span></span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button type="button" className={route.page === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('/')}>Home</button>
          <button type="button" className="nav-link" onClick={() => navigate('/#cyberware')}>Cyberware</button>
          <button type="button" className="nav-link" onClick={() => navigate('/#gallery')}>Gallery</button>
        </nav>
        <button className="button button-small" type="button" onClick={() => navigate('/new')}>＋ Make a build</button>
      </header>

      <section className="page-content">
        {notice && <div className="notice" role="status">{notice}</div>}
        {loadError && <div className="error-banner" role="alert">{loadError}</div>}
        {route.page === 'home' && (
          <HomePage builds={builds} buildsLoading={buildsLoading} localMode={localMode} onNavigate={navigate} />
        )}
        {route.page === 'create' && (
          <BuildForm onSubmit={(event) => saveBuild(event, null)} onCancel={() => navigate('/')} />
        )}
        {route.page === 'edit' && (
          selectedBuild
            ? <BuildForm build={selectedBuild} onSubmit={(event) => saveBuild(event, selectedBuild.id)} onCancel={() => navigate(`/builds/${selectedBuild.id}`)} onDelete={() => deleteBuild(selectedBuild.id)} />
            : buildsLoading
              ? <p className="loading">Loading your build…</p>
              : <MissingBuild onHome={() => navigate('/')} />
        )}
        {route.page === 'detail' && (
          selectedBuild
            ? <BuildDetail build={selectedBuild} onEdit={() => navigate(`/builds/${selectedBuild.id}/edit`)} onHome={() => navigate('/')} />
            : buildsLoading
              ? <p className="loading">Loading your build…</p>
              : <MissingBuild onHome={() => navigate('/')} />
        )}
        {route.page === 'not-found' && <MissingBuild onHome={() => navigate('/')} />}
      </section>
      <footer className="footer">
        <span>Night City build archive</span>
        <span>CREATE YOUR LEGEND <span className="footer-cross">✳</span></span>
      </footer>
    </main>
  )
}

function HomePage({ builds, buildsLoading, localMode, onNavigate }) {
  const buildList = builds ?? []

  return (
    <>
      <section className="welcome-hero" id="home">
        <div className="welcome-copy">
          <span className="eyebrow">NIGHT CITY / BUILD ARCHIVE</span>
          <h1>Your legend.<br />Your <span>build.</span></h1>
          <p>Chrome up, choose your path, and sketch out the merc you want to become. Explore iconic cyberware, then build a loadout that is yours.</p>
          <div className="welcome-actions">
            <button className="button" type="button" onClick={() => onNavigate('/new')}>＋ Make a build <span aria-hidden="true">→</span></button>
            <button className="secondary-button" type="button" onClick={() => onNavigate('/#gallery')}>Browse your gallery <span aria-hidden="true">↓</span></button>
          </div>
          <div className="welcome-stats">
            <div><strong>07</strong><span>BUILD ARCHETYPES</span></div>
            <div><strong>{String(CYBERWARE_HIGHLIGHTS.length).padStart(2, '0')}</strong><span>CYBERWARE PICKS</span></div>
            <div><strong>{String(buildList.length).padStart(2, '0')}</strong><span>YOUR BUILDS</span></div>
          </div>
        </div>
        <div className="welcome-visual" aria-hidden="true">
          <div className="visual-ring ring-outer" />
          <div className="visual-ring ring-inner" />
          <div className="visual-crosshair">✳</div>
          <div className="visual-label label-top">NIGHT CITY // 2077</div>
          <div className="visual-label label-bottom">CHOOSE YOUR EDGE</div>
          <div className="visual-coordinate">NC<br />2077</div>
        </div>
      </section>

      <section className="cyberware-section" id="cyberware">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HARDWARE FOR THE AFTERLIFE</span>
            <h2>Chrome your <span>way.</span></h2>
            <p className="muted">A few iconic implants to spark your next build.</p>
          </div>
          <span className="section-count">FIELD GUIDE / 06</span>
        </div>
        <div className="cyberware-grid">
          {CYBERWARE_HIGHLIGHTS.map((item) => (
            <article className="cyberware-card" key={item.name}>
              <div className="cyberware-topline"><span>{item.code}</span><span className="cyberware-spark">✳</span></div>
              <span className="cyberware-slot">{item.slot}</span>
              <h3>{item.name}</h3>
              <p>{item.feature}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gallery-section" id="gallery">
        <div className="section-heading gallery-heading">
          <div>
            <span className="eyebrow">YOUR PERSONAL ARCHIVE</span>
            <h2>Your build <span>gallery.</span></h2>
            <p className="muted">Your loadouts, ready when you need them.</p>
          </div>
          <button className="button" type="button" onClick={() => onNavigate('/new')}>＋ Make a build</button>
        </div>
        {buildsLoading ? (
          <p className="loading gallery-loading">Loading your builds…</p>
        ) : buildList.length === 0 ? (
          <div className="empty-state gallery-empty">
            <div className="empty-icon">✳</div>
            <h2>Your gallery is waiting</h2>
            <p>Make your first build and start putting your Night City legend together.</p>
            <button className="button" type="button" onClick={() => onNavigate('/new')}>Create your first build <span aria-hidden="true">→</span></button>
          </div>
        ) : (
          <div className="build-grid">
            {buildList.map((build, index) => (
              <article className="build-card" key={build.id}>
                <div className="card-topline"><span>BUILD / {String(index + 1).padStart(2, '0')}</span><span className="card-dot" /></div>
                <a className="card-title" href={`/builds/${build.id}`} onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  onNavigate(`/builds/${build.id}`)
                }}>
                  {build.name}
                </a>
                <span className="archetype-tag">{build.archetype}</span>
                <p className="card-description">Open the operative file for field notes and full build details.</p>
                <div className="card-footer">
                  <span>ADDED {formatDate(build.created_at)}</span>
                  <button type="button" className="text-button" onClick={() => onNavigate(`/builds/${build.id}/edit`)}>Edit <span aria-hidden="true">↗</span></button>
                </div>
              </article>
            ))}
          </div>
        )}
        {localMode && (
          <details className="storage-note">
            <summary>Build storage: this browser only</summary>
            <p>Your builds stay in this browser. To sync through Supabase, add these values to <code>cyberpunk-builds/.env.local</code> and enable Anonymous sign-ins in Supabase Auth.</p>
            <p>For an existing builds table, run this migration. It adds attribute and equipment storage and assigns existing builds a valid 71-point distribution:</p>
            <pre>{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

${UPDATE_SCHEMA_SQL}`}</pre>
            <p>For a new project, create the table with the full schema and row-level security:</p>
            <pre>{SETUP_SQL}</pre>
            <p>Never use a secret or service-role key in the browser app.</p>
          </details>
        )}
      </section>
    </>
  )
}

function BuildForm({ build, onSubmit, onCancel, onDelete }) {
  const [selectedArchetype, setSelectedArchetype] = useState(build?.archetype ?? '')
  const [attributes, setAttributes] = useState(() => Object.fromEntries(
    ATTRIBUTE_NAMES.map((attribute) => [
      attribute,
      Number(build?.attributes?.[attribute] ?? DEFAULT_ATTRIBUTES[attribute]),
    ]),
  ))
  const [equipment, setEquipment] = useState(() =>
    Array.isArray(build?.equipment)
      ? build.equipment.map((item, index) => ({
        ...item,
        type: item.type ?? 'Weapon',
        id: item.id ?? `equipment-${index}`,
      }))
      : [],
  )
  const [equipmentQuery, setEquipmentQuery] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('All')
  const [submitting, setSubmitting] = useState(false)
  const pointsSpent = Object.values(attributes).reduce((total, points) => total + Number(points), 0)
  const pointsRemaining = ATTRIBUTE_TOTAL_POINTS - pointsSpent

  function changeAttribute(attribute, amount) {
    setAttributes((current) => {
      const nextValue = current[attribute] + amount
      const currentSpent = Object.values(current).reduce((total, points) => total + Number(points), 0)
      const nextSpent = currentSpent + amount
      if (
        nextValue < ATTRIBUTE_STARTING_POINTS
        || nextValue > ATTRIBUTE_MAX_POINTS
        || nextSpent > ATTRIBUTE_TOTAL_POINTS
      ) return current
      return { ...current, [attribute]: nextValue }
    })
  }

  function addCatalogItem(catalogItem) {
    const alreadySelected = equipment.some((item) =>
      item.catalogId === catalogItem.id
      || (
        item.type === catalogItem.type
        && String(item.name ?? '').toLowerCase() === catalogItem.name.toLowerCase()
      ),
    )
    if (alreadySelected) return
    setEquipment((current) => [
      ...current,
      {
        id: `equipment-${catalogItem.id}`,
        catalogId: catalogItem.id,
        type: catalogItem.type,
        category: catalogItem.category,
        name: catalogItem.name,
        description: catalogItem.description,
        notes: '',
        referenceUrl: catalogItem.referenceUrl,
      },
    ])
  }

  const selectedCatalogIds = new Set(equipment.map((item) => item.catalogId).filter(Boolean))
  CYBERPUNK_CATALOG.forEach((catalogItem) => {
    if (equipment.some((item) =>
      item.type === catalogItem.type
      && String(item.name ?? '').toLowerCase() === catalogItem.name.toLowerCase(),
    )) selectedCatalogIds.add(catalogItem.id)
  })
  const filteredCatalog = CYBERPUNK_CATALOG.filter((item) => {
    const matchesType = equipmentFilter === 'All' || item.type === equipmentFilter
    const searchText = `${item.name} ${item.type} ${item.category} ${item.description}`.toLowerCase()
    return matchesType && searchText.includes(equipmentQuery.trim().toLowerCase())
  })

  async function handleSubmit(event) {
    setSubmitting(true)
    try {
      await onSubmit(event)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="form-page">
      <button type="button" className="back-link" onClick={onCancel}>← Back</button>
      <div className="form-heading">
        <span className="eyebrow">{build ? 'EDIT YOUR LOADOUT' : 'NEW OPERATIVE FILE'}</span>
        <h1>{build ? 'Edit your ' : 'Create a '}<span>build</span></h1>
        <p className="muted">{build ? 'Tune the details and keep your archive current.' : 'Give your character a name and a way to play.'}</p>
      </div>
      <form className="build-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="build-name">Build name</label>
        <input id="build-name" name="name" type="text" maxLength="80" placeholder="e.g. The Afterlife Ghost" defaultValue={build?.name ?? ''} required />
        <fieldset className="attributes-fieldset">
          <legend className="field-label">Attributes</legend>
          <p className="field-help">Every attribute starts at 3. Distribute all 71 points; each attribute can reach 20.</p>
          <div className={`points-meter${pointsRemaining === 0 ? ' points-complete' : ''}`}>
            <span>POINTS SPENT <strong>{pointsSpent} / {ATTRIBUTE_TOTAL_POINTS}</strong></span>
            <span>POINTS LEFT <strong>{pointsRemaining}</strong></span>
          </div>
          <div className="attribute-list">
            {ATTRIBUTE_NAMES.map((attribute) => (
              <div className="attribute-row" key={attribute}>
                <span className="attribute-name">{attribute}</span>
                <div className="attribute-control">
                  <button
                    type="button"
                    aria-label={`Decrease ${attribute}`}
                    disabled={attributes[attribute] <= ATTRIBUTE_STARTING_POINTS}
                    onClick={() => changeAttribute(attribute, -1)}
                  >−</button>
                  <output aria-label={`${attribute} points`}>{attributes[attribute]}</output>
                  <button
                    type="button"
                    aria-label={`Increase ${attribute}`}
                    disabled={attributes[attribute] >= ATTRIBUTE_MAX_POINTS || pointsRemaining <= 0}
                    onClick={() => changeAttribute(attribute, 1)}
                  >＋</button>
                </div>
                <span className="attribute-cap">MAX {ATTRIBUTE_MAX_POINTS}</span>
              </div>
            ))}
          </div>
          <input type="hidden" name="attributes" value={JSON.stringify(attributes)} />
        </fieldset>
        <fieldset className="archetype-fieldset">
          <legend className="field-label">Choose an archetype</legend>
          <p className="field-help">Select the role that defines your approach.</p>
          <div className="archetype-grid">
            {ARCHETYPES.map((archetype, index) => (
              <button
                type="button"
                key={archetype}
                className={`archetype-option${selectedArchetype === archetype ? ' selected' : ''}`}
                aria-pressed={selectedArchetype === archetype}
                onClick={() => setSelectedArchetype(archetype)}
              >
                <span className="option-number">0{index + 1}</span>
                <span>{archetype}</span>
                <span className="option-check" aria-hidden="true">{selectedArchetype === archetype ? '✓' : '+'}</span>
              </button>
            ))}
          </div>
          <input type="hidden" name="archetype" value={selectedArchetype} />
        </fieldset>
        <fieldset className="equipment-fieldset">
          <legend className="field-label">Weapons &amp; gear</legend>
          <p className="field-help">Search this curated starter catalog, filter by weapons or gear, and add items to this build.</p>
          <label className="equipment-search-label" htmlFor="equipment-search">Search catalog</label>
          <input
            id="equipment-search"
            className="equipment-search"
            type="search"
            value={equipmentQuery}
            onChange={(event) => setEquipmentQuery(event.target.value)}
            placeholder="Search weapons, cyberware, and more…"
          />
          <div className="equipment-filters" role="group" aria-label="Filter catalog by type">
            {['All', 'Weapon', 'Gear'].map((filter) => (
              <button
                type="button"
                key={filter}
                className={`equipment-filter${equipmentFilter === filter ? ' active' : ''}`}
                aria-pressed={equipmentFilter === filter}
                onClick={() => setEquipmentFilter(filter)}
              >
                {filter === 'All' ? 'All items' : filter === 'Gear' ? 'Gear' : 'Weapons'}
                <span>{filter === 'All' ? CYBERPUNK_CATALOG.length : CYBERPUNK_CATALOG.filter((item) => item.type === filter).length}</span>
              </button>
            ))}
          </div>
          <div className="catalog-results" aria-live="polite">
            <div className="catalog-results-heading">
              <span>{filteredCatalog.length} {filteredCatalog.length === 1 ? 'ITEM' : 'ITEMS'}</span>
              <span>{equipment.length} SELECTED</span>
            </div>
            {filteredCatalog.length === 0 ? (
              <p className="equipment-empty">No catalog items match that search.</p>
            ) : (
              <div className="catalog-grid">
                {filteredCatalog.map((item) => {
                  const isSelected = selectedCatalogIds.has(item.id)
                  return (
                    <article className={`catalog-card${isSelected ? ' selected' : ''}`} key={item.id}>
                      <div className="catalog-card-top">
                        <span className={`catalog-type ${item.type.toLowerCase()}`}>{item.type}</span>
                        <span className="catalog-category">{item.category}</span>
                      </div>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className="catalog-card-actions">
                        <a href={item.referenceUrl} target="_blank" rel="noreferrer">Wiki ↗</a>
                        <button type="button" disabled={isSelected} onClick={() => addCatalogItem(item)}>
                          {isSelected ? 'Added ✓' : '＋ Add'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
          <div className="selected-equipment">
            <h3>Selected for this build <span>{equipment.length}</span></h3>
            {equipment.length === 0 ? (
              <p className="equipment-empty">No weapons or gear selected yet.</p>
            ) : (
              <div className="selected-equipment-list">
                {equipment.map((item) => (
                  <div className="selected-equipment-item" key={item.id}>
                    <span className={`catalog-type ${(item.type ?? 'Gear').toLowerCase()}`}>{item.type ?? 'Gear'}</span>
                    <span className="selected-item-name">{item.name}</span>
                    <button
                      type="button"
                      className="remove-equipment-button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => setEquipment((current) => current.filter((entry) => entry.id !== item.id))}
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <input type="hidden" name="equipment" value={JSON.stringify(equipment)} />
        </fieldset>
        <label className="field-label" htmlFor="build-description">Build notes <span className="optional-label">OPTIONAL</span></label>
        <textarea id="build-description" name="description" rows="5" maxLength="1200" placeholder="Describe your playstyle, signature gear, or the story behind this build…" defaultValue={build?.description ?? ''} />
        <div className="form-actions">
          <button className="button" type="submit" disabled={!selectedArchetype || pointsRemaining !== 0 || submitting}>
            {submitting ? 'Saving…' : build ? 'Save changes' : 'Create build'} <span aria-hidden="true">→</span>
          </button>
          {pointsRemaining !== 0 && <span className="points-reminder">Spend all {Math.max(pointsRemaining, 0)} remaining attribute points to continue.</span>}
          {build && <button className="delete-button" type="button" onClick={onDelete}>Delete build</button>}
        </div>
      </form>
    </div>
  )
}

function BuildDetail({ build, onEdit, onHome }) {
  const attributes = Object.fromEntries(
    ATTRIBUTE_NAMES.map((attribute) => [
      attribute,
      Number(build.attributes?.[attribute] ?? DEFAULT_ATTRIBUTES[attribute]),
    ]),
  )
  const equipment = Array.isArray(build.equipment) ? build.equipment : []
  const attributeTotal = ATTRIBUTE_NAMES.reduce(
    (total, attribute) => total + Number(attributes[attribute] ?? 0),
    0,
  )

  return (
    <article className="detail-page">
      <button type="button" className="back-link" onClick={onHome}>← All builds</button>
      <div className="detail-hero">
        <span className="eyebrow">OPERATIVE FILE / {build.id.slice(0, 8).toUpperCase()}</span>
        <h1>{build.name}</h1>
        <span className="archetype-tag large-tag">{build.archetype}</span>
      </div>
      <div className="detail-content">
        <section className="detail-section">
          <span className="eyebrow">FIELD NOTES</span>
          <h2>Build overview</h2>
          <p className="detail-description">{build.description || 'No field notes have been added to this build yet.'}</p>
        </section>
        <aside className="detail-meta">
          <div><span>CREATED</span><strong>{formatDate(build.created_at)}</strong></div>
          <div><span>LAST UPDATED</span><strong>{formatDate(build.updated_at ?? build.created_at)}</strong></div>
          <div><span>ARCHETYPE</span><strong>{build.archetype}</strong></div>
        </aside>
      </div>
      <section className="build-detail-section">
        <div className="section-heading detail-section-heading">
          <div>
            <span className="eyebrow">ATTRIBUTE DISTRIBUTION</span>
            <h2>Core <span>stats.</span></h2>
          </div>
          <span className="section-count">{attributeTotal} / {ATTRIBUTE_TOTAL_POINTS} POINTS</span>
        </div>
        <div className="detail-attribute-grid">
          {ATTRIBUTE_NAMES.map((attribute) => (
            <div className="detail-attribute" key={attribute}>
              <span>{attribute}</span>
              <strong>{attributes[attribute]}</strong>
              <div className="attribute-progress"><span style={{ width: `${(attributes[attribute] / ATTRIBUTE_MAX_POINTS) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </section>
      <section className="build-detail-section">
        <div className="section-heading detail-section-heading">
          <div>
            <span className="eyebrow">LOADOUT / FIELD KIT</span>
            <h2>Weapons <span>&amp; gear.</span></h2>
          </div>
          <span className="section-count">{String(equipment.length).padStart(2, '0')} ITEMS</span>
        </div>
        {equipment.length === 0 ? (
          <p className="equipment-empty detail-equipment-empty">No weapons or gear listed for this build.</p>
        ) : (
          <div className="detail-equipment-list">
            {equipment.map((item, index) => {
              const referenceUrl = getSafeReferenceUrl(item.referenceUrl)
              return (
                <article className="detail-equipment-item" key={item.id ?? `${item.name}-${index}`}>
                  <span className="archetype-tag">{item.type}</span>
                  <div className="detail-equipment-copy">
                    <h3>{item.name}</h3>
                    {item.category && <span className="detail-equipment-category">{item.category}</span>}
                    {item.description && <p>{item.description}</p>}
                    {item.notes && <p>{item.notes}</p>}
                  </div>
                  {referenceUrl && <a className="wiki-link" href={referenceUrl} target="_blank" rel="noreferrer">Wiki ↗</a>}
                </article>
              )
            })}
          </div>
        )}
      </section>
      <button type="button" className="button" onClick={onEdit}>Edit this build <span aria-hidden="true">→</span></button>
    </article>
  )
}

function MissingBuild({ onHome }) {
  return (
    <div className="empty-state missing-state">
      <div className="empty-icon">?</div>
      <h2>Build not found</h2>
      <p>This build may have been deleted or is not available in your archive.</p>
      <button type="button" className="button" onClick={onHome}>Return to my builds <span aria-hidden="true">→</span></button>
    </div>
  )
}

export default App
