import React, { useCallback, useEffect, useState } from 'react';
import { supabase, configured, authRedirect } from './supabase.js';
import { createApi } from './api.js';

const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const localities = ['LB Nagar', 'Kukatpally', 'KPHB'];
const go = path => { window.location.hash = path; };
const link = path => `#${path}`;
const encode = encodeURIComponent;

function useRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => { const change = () => { setRoute(read()); window.scrollTo?.(0, 0); }; window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  return route;
}
export function useResource(api, path, revision = 0) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    api(path).then(result => { if (active) setState({ ...result, loading: false }); })
      .catch(error => { if (active) setState({ error: error.message, loading: false }); });
    return () => { active = false; };
  }, [api, path, revision]);
  return state;
}
function Notice({ children, error = false }) { return <p className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{children}</p>; }
function Resource({ resource, children }) {
  if (resource.loading) return <p className="loading" role="status">Loading…</p>;
  if (resource.error) return <Notice error>{resource.error}</Notice>;
  return children(resource.data, resource.pagination);
}
function Field({ label, name, options, ...props }) {
  return <label className="field"><span>{label}</span>{options ? <select name={name} {...props}>{options.map(option => <option key={option}>{option}</option>)}</select> : <input name={name} {...props} />}</label>;
}
function PageTitle({ eyebrow, title, children }) { return <div className="page-title"><div><p className="eyebrow">{eyebrow || 'YOUR CAMPUS COMPANION'}</p><h1>{title}</h1></div>{children}</div>; }
function Back({ to = '/' }) { return <a className="back" href={link(to)}>← Back</a>; }
function Empty({ children }) { return <div className="empty"><span aria-hidden="true">◇</span><p>{children}</p></div>; }
function SampleNotice() { return <div className="sample"><span aria-hidden="true">ⓘ</span><p><strong>Unverified sample transport data</strong><br />Confirm routes and timings with official providers before travel. Times are in Asia/Kolkata.</p></div>; }

export function Auth({ recovery, onRecovered }) {
  const [mode, setMode] = useState(recovery ? 'recover' : 'login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (recovery) setMode('recover'); }, [recovery]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      let result;
      if (mode === 'signup') {
        result = await supabase.auth.signUp({ email: values.email.trim(), password: values.password, options: {
          emailRedirectTo: authRedirect(), data: { full_name: values.full_name.trim(), roll_number: values.roll_number.trim().toUpperCase(), year_of_study: values.year_of_study, locality: values.locality }
        } });
        if (!result.error && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
      } else if (mode === 'reset') {
        result = await supabase.auth.resetPasswordForEmail(values.email.trim(), { redirectTo: `${authRedirect()}?recovery=1` });
        if (!result.error) setMessage('If an account exists, a recovery link has been sent. Check your email.');
      } else if (mode === 'recover') {
        result = await supabase.auth.updateUser({ password: values.password });
        if (!result.error) { onRecovered(); go('/'); }
      } else result = await supabase.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
      if (result.error) throw result.error;
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const titles = { login: 'Welcome back.', signup: 'Your commute starts here.', reset: 'Reset your password.', recover: 'Choose a new password.' };
  return <main className="auth-layout"><section className="auth-brand"><Brand /><div><p className="eyebrow">JNAFAU · DTDP</p><h1>Less searching.<br />More moving.</h1><p>One companion for your journey to campus.<br />Bus, Metro, and MMTS — all together.</p><div className="mode-pills"><span>BUS</span><span>METRO</span><span>MMTS</span></div></div><small>Made for the everyday campus journey.</small></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">ALL TRANSPORT SERVICE</p><h2>{titles[mode]}</h2><p className="muted">{mode === 'signup' ? 'Create your student account with a real email address.' : 'Your routes, saved trips, and campus connections.'}</p><form onSubmit={submit}>
    {mode === 'signup' && <><Field label="Full name" name="full_name" required maxLength={120} autoComplete="name" /><Field label="Roll number" name="roll_number" required maxLength={40} /><div className="form-row"><Field label="Year of study" name="year_of_study" options={years} /><Field label="Locality" name="locality" options={localities} /></div></>}
    {mode !== 'recover' && <Field label="Email address" name="email" type="email" autoComplete="email" required />}
    {mode !== 'reset' && <Field label={mode === 'recover' ? 'New password' : 'Password'} name="password" type="password" minLength={mode === 'login' ? 1 : 8} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />}
    {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    <button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : { login: 'Sign in →', signup: 'Create account →', reset: 'Send recovery link', recover: 'Update password' }[mode]}</button>
  </form>{mode !== 'recover' && <div className="auth-links">{['login', 'signup', 'reset'].filter(item => item !== mode).map(item => <button className="text-button" key={item} onClick={() => { setMode(item); setMessage(''); setError(''); }}>{ { login: 'Sign in', signup: 'Create an account', reset: 'Forgot password?' }[item]}</button>)}</div>}<p className="fine-print">Routes and timetables are sample information. Always confirm before travelling.</p></div></section></main>;
}
function Brand() { return <a className="brand" href={link('/')}><img src={`${import.meta.env.BASE_URL}icons/icon.svg`} width="42" height="42" alt="" /><span>All Transport<small>JNAFAU · DTDP</small></span></a>; }

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(configured);
  const [authError, setAuthError] = useState('');
  const [recovery, setRecovery] = useState(new URLSearchParams(window.location.search).has('recovery'));
  useEffect(() => {
    if (!configured || !supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, current) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(current); setLoading(false);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      setSession(data.session); setLoading(false);
    }).catch(error => { if (active) { setAuthError(error.message); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (!configured) return <main className="setup"><Brand /><h1>Ready for your Supabase project.</h1><p>Copy <code>.env.example</code> to <code>.env</code>, add your project URL and public key, and apply <code>supabase/migrations/202610310001_initial.sql</code>. Restart the application afterward.</p><p>See the README for the complete setup guide.</p></main>;
  if (loading) return <main className="setup"><Brand /><p role="status">Restoring your session…</p></main>;
  if (session && !recovery) return <Workspace key={session.user.id} />;
  return <>{authError && <Notice error>{authError}</Notice>}<Auth recovery={recovery && Boolean(session)} onRecovered={() => { setRecovery(false); window.history.replaceState(null, '', authRedirect()); }} /></>;
}

function Workspace() {
  const api = useCallback(createApi(() => supabase.auth.getSession()), []);
  const route = useRoute();
  const [revision, setRevision] = useState(0);
  const [signoutError, setSignoutError] = useState('');
  const me = useResource(api, '/me', revision);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  async function logout() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) setSignoutError(error.message); else go('/');
  }
  const hod = me.data?.role === 'hod';
  const nav = [['/', '⌂', 'Overview'], ['/buses', '▣', 'Bus routes'], ['/metro', '◉', 'Metro'], ['/mmts', '▤', 'MMTS'], ...(hod ? [['/students', '♧', 'Students'], ['/localities', '⌖', 'Localities']] : [['/saved', '♡', 'Saved routes']]), ['/profile', '◎', 'My profile']];
  return <div className="application"><aside className="sidebar"><Brand /><div className="sidebar-label">YOUR JOURNEY</div><nav aria-label="Main navigation">{nav.map(([path, icon, title]) => <a key={path} href={link(path)} className={route === path || (path !== '/' && route.startsWith(`${path}/`)) ? 'active' : ''}><span aria-hidden="true">{icon}</span>{title}</a>)}</nav><div className="sidebar-bottom"><p>One campus.<br /><strong>Many ways to get there.</strong></p><small>JNAFAU, Masab Tank<br />Hyderabad</small></div></aside><div className="main-column"><header className="app-header"><span className="header-label">ALL TRANSPORT SERVICE <span>/</span> {hod ? 'HOD workspace' : 'Student workspace'}</span><div className="header-account"><span className="avatar">{me.data?.full_name?.slice(0, 1) || '·'}</span><span>{me.data?.full_name || 'Your account'}</span><button className="text-button" onClick={logout}>Sign out</button></div></header><main className="content">{offline && <Notice>You are offline. The app shell is available; account data and routes need a connection.</Notice>}{signoutError && <Notice error>{signoutError}</Notice>}<Resource resource={me}>{profile => <>
    {route === '/' ? <Dashboard api={api} profile={profile} /> :
      route === '/buses' ? <BusList api={api} profile={profile} /> :
      route.startsWith('/buses/') ? <BusDetail api={api} route={route} profile={profile} /> :
      route === '/metro' || route === '/mmts' ? <RailList api={api} mode={route.slice(1)} key={route} /> :
      route.startsWith('/metro/') || route.startsWith('/mmts/') ? <RailDetail api={api} route={route} key={route} /> :
      route === '/saved' && !hod ? <Saved api={api} /> :
      route === '/profile' ? <Profile api={api} profile={profile} onUpdated={() => setRevision(r => r + 1)} /> :
      route === '/students' && hod ? <Students api={api} /> :
      route.startsWith('/students/') && hod ? <StudentDetail api={api} route={route} /> :
      route === '/localities' && hod ? <Localities api={api} /> : <><Back /><Empty>That page is unavailable.</Empty></>}
  </>}</Resource>{me.error && <button onClick={() => setRevision(r => r + 1)}>Retry connection</button>}</main><footer>Built for JNAFAU DTDP <span>Hyderabad, India</span></footer></div></div>;
}

function Dashboard({ api, profile }) {
  const hod = profile.role === 'hod';
  const resource = useResource(api, hod ? '/admin/summary' : `/buses?locality=${encode(profile.locality)}`);
  return <><PageTitle title={`Hello, ${profile.full_name.split(' ')[0]}.`} eyebrow={hod ? 'CAMPUS TRANSPORT · ADMINISTRATION' : 'A GOOD DAY STARTS WITH A GOOD JOURNEY'} /><section className="hero"><div><span className="hero-label">YOUR DAILY CAMPUS CONNECTION</span><h2>{hod ? 'Keep your campus connected.' : 'Next stop: campus.'}</h2><p>{hod ? 'Students, localities, and transport information in one place.' : `From ${profile.locality} to Masab Tank. Find a route that works for you.`}</p><a className="light-button" href={link(hod ? '/students' : '/buses')}>{hod ? 'View students' : 'Explore bus routes'} <span>↗</span></a></div><div className="hero-art" aria-hidden="true"><span>⌖</span><div className="journey-line" /><span>▣</span><small>JNAFAU</small></div></section>
    <Resource resource={resource}>{value => hod ? <div className="stats">{Object.entries(value).map(([name, count]) => <article className="stat" key={name}><span>{name}</span><strong>{count}</strong></article>)}</div> : <><div className="section-heading"><h2>Routes from your locality</h2><a href={link('/buses')}>View all →</a></div><BusCards buses={value} /></>}</Resource>
    <div className="section-heading"><h2>Choose your way</h2><span className="muted">Three modes. One companion.</span></div><div className="mode-grid">{[['/buses', '01', 'Bus routes', 'Find stops and departure times.', 'purple'], ['/metro', '02', 'Hyderabad Metro', 'Explore lines and interchanges.', 'blue'], ['/mmts', '03', 'MMTS trains', 'Discover suburban rail corridors.', 'green']].map(([path, number, title, text, color]) => <a className={`mode-card ${color}`} key={path} href={link(path)}><span className="mode-number">{number}</span><h3>{title} <span>↗</span></h3><p>{text}</p></a>)}</div><SampleNotice /></>;
}
function BusCards({ buses: records }) {
  if (!records.length) return <Empty>No matching bus routes. Try viewing all routes.</Empty>;
  return <div className="route-grid">{records.map(bus => <a className="route-card" key={bus.no} href={link(`/buses/${encode(bus.no)}`)}><div className="card-top"><span className="route-number">{bus.no}</span><span className="badge">Unverified</span></div><h3>{bus.from} <span className="muted">→</span> {bus.to}</h3><p>{bus.stops.slice(1, 4).join(' · ')}</p><div className="card-bottom"><span>◷ {bus.duration}</span><span>View route ↗</span></div></a>)}</div>;
}
function BusList({ api, profile }) {
  const [mine, setMine] = useState(false);
  const resource = useResource(api, `/buses${mine ? `?locality=${encode(profile.locality)}` : ''}`);
  return <><PageTitle title="Find your bus." eyebrow="ROAD TO CAMPUS" /><SampleNotice /><div className="tabs"><button aria-pressed={!mine} onClick={() => setMine(false)}>All routes</button><button aria-pressed={mine} onClick={() => setMine(true)}>From {profile.locality}</button></div><Resource resource={resource}>{records => <BusCards buses={records} />}</Resource></>;
}
function BusDetail({ api, route, profile }) {
  const resource = useResource(api, route);
  const [revision, setRevision] = useState(0);
  const saved = useResource(api, profile.role === 'student' ? '/me/saved-routes' : '/localities', revision);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function toggle(bus) {
    setBusy(true); setError('');
    const exists = saved.data?.some(row => row.route_no === bus.no);
    try { await api(`/me/saved-routes/${encode(bus.no)}`, { method: exists ? 'DELETE' : 'PUT' }); setRevision(r => r + 1); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <><Back to="/buses" /><Resource resource={resource}>{bus => <><PageTitle title={`${bus.no} · ${bus.from} → ${bus.to}`} eyebrow="BUS ROUTE DETAILS">{profile.role === 'student' && <button className="primary" disabled={busy || saved.loading || !!saved.error} onClick={() => toggle(bus)}>{busy ? 'Saving…' : saved.data?.some(row => row.route_no === bus.no) ? '♥ Remove saved route' : '♡ Save route'}</button>}</PageTitle>{(error || saved.error) && <Notice error>{error || saved.error}</Notice>}<SampleNotice /><div className="detail-grid"><section className="panel"><h2>Stops along the way</h2><ol className="stops">{bus.stops.map((stop, index) => <li key={`${index}-${stop}`}>{stop}</li>)}</ol></section><section className="panel"><h2>Departure times</h2><p className="muted">Estimated journey: {bus.duration}</p><div className="time-grid">{bus.schedule.map(time => <span key={time}>{time}</span>)}</div><p className="fine-print">{bus.notes}</p></section></div></>}</Resource></>;
}
function RailList({ api, mode }) {
  const resource = useResource(api, mode === 'metro' ? '/metro/lines' : '/mmts/routes');
  return <><PageTitle title={mode === 'metro' ? 'Across the city, by Metro.' : 'Your suburban connection.'} eyebrow={mode === 'metro' ? 'HYDERABAD METRO' : 'MMTS RAIL NETWORK'} /><SampleNotice /><Resource resource={resource}>{records => <div className="route-grid">{records.map(record => <a className="route-card" key={record.id} href={link(`/${mode}/${record.id}`)}><div className="card-top"><span className="badge">{record.tag || record.length}</span><span>↗</span></div><h2>{record.name}</h2>{record.from && <p>{record.from} → {record.to}</p>}<p>{record.frequency}</p><div className="card-bottom"><span>{record.first} — {record.last}</span></div></a>)}</div>}</Resource></>;
}
function RailDetail({ api, route }) {
  const [, mode, id] = route.split('/');
  const resource = useResource(api, `/${mode}/${mode === 'metro' ? 'lines' : 'routes'}/${encode(id)}`);
  return <><Back to={`/${mode}`} /><Resource resource={resource}>{record => <><PageTitle title={record.name} eyebrow={mode.toUpperCase()} /><SampleNotice /><div className="detail-grid"><section className="panel"><h2>Stations</h2>{record.stations ? <ol className="stops">{record.stations.map((station, index) => <li key={index}>{station}{record.ix?.includes(station) && <span className="badge">Interchange</span>}</li>)}</ol> : <Empty>Station details have not been verified for this corridor.</Empty>}</section><section className="panel"><h2>Service information</h2><dl><dt>First service</dt><dd>{record.first}</dd><dt>Last service</dt><dd>{record.last}</dd><dt>Frequency</dt><dd>{record.frequency}</dd>{record.duration && <><dt>Journey</dt><dd>{record.duration}</dd></>}{record.interchange && <><dt>Interchanges</dt><dd>{record.interchange}</dd></>}</dl>{record.note && <p>{record.note}</p>}</section></div></>}</Resource></>;
}
function Saved({ api }) {
  const [revision, setRevision] = useState(0);
  const resource = useResource(api, '/me/saved-routes', revision);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  async function remove(no) {
    setBusy(no); setError('');
    try { await api(`/me/saved-routes/${encode(no)}`, { method: 'DELETE' }); setRevision(r => r + 1); }
    catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  return <><PageTitle title="Your regular routes." eyebrow="SAVED FOR LATER" /><SampleNotice />{error && <Notice error>{error}</Notice>}<Resource resource={resource}>{records => records.length ? <div className="saved-list">{records.map(row => <article className="panel saved-row" key={row.route_no}><div><h3>{row.bus ? <a href={link(`/buses/${encode(row.route_no)}`)}>{row.route_no} · {row.bus.from} → {row.bus.to}</a> : `${row.route_no} · Route no longer available`}</h3><p className="muted">Saved {new Date(row.created_at).toLocaleDateString()}</p></div><button disabled={!!busy} onClick={() => remove(row.route_no)}>{busy === row.route_no ? 'Removing…' : 'Remove'}</button></article>)}</div> : <Empty>No saved routes yet. Open a bus route and select Save route.</Empty>}</Resource></>;
}
function Profile({ api, profile, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await api('/me', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); setMessage('Your profile has been updated.'); onUpdated(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <><PageTitle title="A little about you." eyebrow="MY PROFILE" /><section className="panel profile-panel"><div className="profile-heading"><span className="avatar large">{profile.full_name[0]}</span><div><h2>{profile.full_name}</h2><span className="badge">{profile.role === 'hod' ? 'Head of department' : 'Student'}</span></div></div><p>{profile.email}</p><p className="muted">Roll number: {profile.roll_number}</p><form onSubmit={submit}><Field label="Full name" name="full_name" defaultValue={profile.full_name} required maxLength={120} disabled={profile.role === 'hod'} /><Field label="Year of study" name="year_of_study" options={years} defaultValue={profile.year_of_study} disabled={profile.role === 'hod'} /><Field label="Locality" name="locality" options={localities} defaultValue={profile.locality} disabled={profile.role === 'hod'} />{error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}{profile.role === 'student' && <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>}</form></section></>;
}
function Students({ api }) {
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [locality, setLocality] = useState('');
  const [page, setPage] = useState(1);
  const resource = useResource(api, `/admin/students?${new URLSearchParams({ page, limit: 20, search, ...(locality ? { locality } : {}) })}`);
  return <><PageTitle title="Your campus community." eyebrow="STUDENT DIRECTORY" /><form className="filters" onSubmit={event => { event.preventDefault(); setSearch(input); setPage(1); }}><Field label="Search name or roll number" name="search" value={input} onChange={e => setInput(e.target.value)} maxLength={100} pattern="[\p{L}\p{N}\s_\-]*" /><Field label="Locality" name="locality" value={locality} onChange={e => { setLocality(e.target.value); setPage(1); }} options={['', ...localities]} /><button className="primary">Search</button></form><Resource resource={resource}>{(records, pagination) => <>{records.length ? <div className="panel table-wrap"><table><thead><tr><th>Name</th><th>Roll number</th><th>Year</th><th>Locality</th></tr></thead><tbody>{records.map(student => <tr key={student.id}><td><a href={link(`/students/${student.id}`)}>{student.full_name} ↗</a></td><td>{student.roll_number}</td><td>{student.year_of_study}</td><td>{student.locality}</td></tr>)}</tbody></table></div> : <Empty>No students match these filters.</Empty>}<div className="pagination"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button><span>Page {page} · {pagination.total} students</span><button disabled={page * 20 >= pagination.total} onClick={() => setPage(p => p + 1)}>Next →</button></div></>}</Resource></>;
}
function StudentDetail({ api, route }) {
  const resource = useResource(api, `/admin${route}`);
  return <><Back to="/students" /><Resource resource={resource}>{student => <><PageTitle title={student.full_name} eyebrow="STUDENT PROFILE" /><section className="panel"><p>{student.roll_number} · {student.year_of_study} · {student.locality}</p></section><div className="section-heading"><h2>Available buses to campus</h2></div><SampleNotice /><BusCards buses={student.buses} /></>}</Resource></>;
}
function Localities({ api }) {
  const resource = useResource(api, '/admin/localities');
  return <><PageTitle title="Where journeys begin." eyebrow="CAMPUS LOCALITIES" /><Resource resource={resource}>{records => <div className="route-grid">{records.map(record => <article className="panel" key={record.name}><span className="eyebrow">{record.city}</span><h2>{record.name}</h2><p>{record.students} students · {record.name === 'Masab Tank' ? 'Campus destination' : `${record.buses} campus bus routes`}</p></article>)}</div>}</Resource></>;
}
