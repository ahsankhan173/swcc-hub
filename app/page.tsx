'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Player = {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  usual_team: string | null;
  squad_category: string | null;
  membership_status: 'Paid' | 'Partial' | 'Unpaid';
  active_status: 'Active' | 'Inactive';
};

type AdminUser = {
  id: string;
  email: string;
  role: string;
  team: string | null;
  active_status: 'Active' | 'Inactive';
};

type Weekend = {
  id: string;
  weekend_date: string;
  label: string;
  status: 'Live' | 'Archived';
  selections_published: boolean;
};

type Fixture = {
  id: string;
  weekend_id: string;
  team: string;
  opposition: string;
  venue: string;
  competition: string;
  game_format: 'Timed' | 'Win/Loss';
  start_time: string | null;
};

type Availability = {
  id?: string;
  weekend_id: string;
  player_id: string;
  availability_status: string;
  available_after: string | null;
  notes: string | null;
};

type Selection = {
  id?: string;
  weekend_id: string;
  player_id: string;
  assigned_team: string;
  batting_order: number | null;
  captain_notes: string | null;
};

type CaptainRow = Player & {
  availability_status: string;
  available_after: string;
  notes: string;
  assigned_team: string;
  batting_order: string;
  captain_notes: string;
};

const AVAILABILITY_OPTIONS = [
  'Available',
  'Not Available',
  'Available after X time',
  'Available but prefer lower XI'
];

const ASSIGNMENT_OPTIONS = ['', '1st XI', '2nd XI', '3rd XI', '4th XI', 'Reserve'];

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [userEmail, setUserEmail] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [weekends, setWeekends] = useState<Weekend[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);

  const [selectedWeekendId, setSelectedWeekendId] = useState('');
  const [tab, setTab] = useState<'availability' | 'my-team' | 'captains'>('availability');

  const [availabilityStatus, setAvailabilityStatus] = useState('Available');
  const [availableAfter, setAvailableAfter] = useState('');
  const [availabilityNotes, setAvailabilityNotes] = useState('');

  const [captainRows, setCaptainRows] = useState<CaptainRow[]>([]);
  const [whatsappTeam, setWhatsappTeam] = useState('1st XI');
  const [whatsappMessage, setWhatsappMessage] = useState('');

  const isAdmin = !!admin;

  const selectedWeekend = useMemo(
    () => weekends.find(w => w.id === selectedWeekendId) || null,
    [weekends, selectedWeekendId]
  );

  useEffect(() => {
    initialise();
  }, []);

  useEffect(() => {
    const current = availability.find(a => a.weekend_id === selectedWeekendId);
    if (current) {
      setAvailabilityStatus(current.availability_status);
      setAvailableAfter(current.available_after || '');
      setAvailabilityNotes(current.notes || '');
    } else {
      setAvailabilityStatus('Available');
      setAvailableAfter('');
      setAvailabilityNotes('');
    }
  }, [selectedWeekendId, availability]);

  async function initialise() {
    setLoading(true);
    setError('');

    const { data } = await supabase.auth.getUser();

    if (!data.user?.email) {
      setLoading(false);
      return;
    }

    await loadApp(data.user.email);
    setLoading(false);
  }

  async function loadApp(authEmail: string) {
    setUserEmail(authEmail.toLowerCase());

    const { data: playerRow, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('email', authEmail.toLowerCase())
      .eq('active_status', 'Active')
      .maybeSingle();

    if (playerError) throw new Error(playerError.message);
    setPlayer(playerRow);

    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', authEmail.toLowerCase())
      .eq('active_status', 'Active')
      .maybeSingle();

    setAdmin(adminRow || null);

    const { data: weekendRows, error: weekendError } = await supabase
      .from('weekends')
      .select('*')
      .eq('status', 'Live')
      .order('weekend_date', { ascending: true });

    if (weekendError) throw new Error(weekendError.message);

    setWeekends(weekendRows || []);
    const firstWeekend = weekendRows?.[0]?.id || '';
    setSelectedWeekendId(prev => prev || firstWeekend);

    const { data: fixtureRows } = await supabase
      .from('fixtures')
      .select('*')
      .order('team', { ascending: true });

    setFixtures(fixtureRows || []);

    if (playerRow) {
      const { data: availabilityRows } = await supabase
        .from('availability')
        .select('*')
        .eq('player_id', playerRow.id);

      setAvailability(availabilityRows || []);

      const { data: selectionRows } = await supabase
        .from('selections')
        .select('*')
        .eq('player_id', playerRow.id);

      setSelections(selectionRows || []);
    }
  }

  async function signIn() {
    setError('');
    setNotice('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (error) {
      setError(error.message);
      return;
    }

    await initialise();
  }

  async function signUp() {
    setError('');
    setNotice('');

    const { error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password
    });

    if (error) {
      setError(error.message);
      return;
    }

    setNotice('Account created. If your email is registered with SWCC, you can now sign in.');
    setMode('signin');
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPlayer(null);
    setAdmin(null);
    setUserEmail('');
    setTab('availability');
  }

  async function saveAvailability() {
    if (!player || !selectedWeekendId) return;

    setError('');
    setNotice('');

    const payload = {
      weekend_id: selectedWeekendId,
      player_id: player.id,
      availability_status: availabilityStatus,
      available_after: availabilityStatus === 'Available after X time' ? availableAfter : '',
      notes: availabilityNotes,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('availability')
      .upsert(payload, { onConflict: 'weekend_id,player_id' });

    if (error) {
      setError(error.message);
      return;
    }

    setNotice('Availability saved.');
    await loadApp(userEmail);
  }

  async function loadCaptainDashboard() {
    if (!selectedWeekendId || !isAdmin) return;

    const { data: players } = await supabase
      .from('players')
      .select('*')
      .eq('active_status', 'Active')
      .order('full_name', { ascending: true });

    const { data: avRows } = await supabase
      .from('availability')
      .select('*')
      .eq('weekend_id', selectedWeekendId);

    const { data: selRows } = await supabase
      .from('selections')
      .select('*')
      .eq('weekend_id', selectedWeekendId);

    const rows: CaptainRow[] = (players || []).map((p: Player) => {
      const av = (avRows || []).find((a: Availability) => a.player_id === p.id);
      const sel = (selRows || []).find((s: Selection) => s.player_id === p.id);

      return {
        ...p,
        availability_status: av?.availability_status || 'Missing',
        available_after: av?.available_after || '',
        notes: av?.notes || '',
        assigned_team: sel?.assigned_team || '',
        batting_order: sel?.batting_order ? String(sel.batting_order) : '',
        captain_notes: sel?.captain_notes || ''
      };
    });

    setCaptainRows(rows);
  }

  async function saveSelections() {
    if (!selectedWeekendId) return;

    setError('');
    setNotice('');

    const payload = captainRows
      .filter(r => r.assigned_team)
      .map(r => ({
        weekend_id: selectedWeekendId,
        player_id: r.id,
        assigned_team: r.assigned_team,
        batting_order: r.batting_order ? Number(r.batting_order) : null,
        captain_notes: r.captain_notes || '',
        selected_by_email: userEmail,
        updated_at: new Date().toISOString()
      }));

    const { error } = await supabase
      .from('selections')
      .upsert(payload, { onConflict: 'weekend_id,player_id' });

    if (error) {
      setError(error.message);
      return;
    }

    await supabase
      .from('weekends')
      .update({ selections_published: false, published_at: null })
      .eq('id', selectedWeekendId);

    setNotice('Selections saved. They are hidden from players until published.');
    await loadCaptainDashboard();
  }

  async function publishSelections() {
    if (!selectedWeekendId) return;

    const { error } = await supabase
      .from('weekends')
      .update({
        selections_published: true,
        published_at: new Date().toISOString()
      })
      .eq('id', selectedWeekendId);

    if (error) {
      setError(error.message);
      return;
    }

    setNotice('Selections published to players.');
    await loadApp(userEmail);
  }

  function generateWhatsapp() {
    const fixture = fixtures.find(f => f.weekend_id === selectedWeekendId && f.team === whatsappTeam);
    const selected = captainRows
      .filter(r => r.assigned_team === whatsappTeam)
      .sort((a, b) => Number(a.batting_order || 99) - Number(b.batting_order || 99));

    const names = selected.map((p, i) => `${i + 1}. ${p.full_name}`).join('\n');

    const msg = [
      `🏏 SWCC ${whatsappTeam}`,
      selectedWeekend?.label || '',
      '',
      `Opposition: ${fixture?.opposition || 'TBC'}`,
      `Venue: ${fixture?.venue || 'TBC'}`,
      `Competition: ${fixture?.competition || 'TBC'}`,
      `Format: ${fixture?.game_format || 'TBC'}`,
      fixture?.start_time ? `Start: ${fixture.start_time}` : '',
      '',
      'Selected XI:',
      names || 'No players selected yet.',
      '',
      'Please confirm receipt. Any issues, message your captain ASAP.'
    ].filter(Boolean).join('\n');

    setWhatsappMessage(msg);
  }

  function updateCaptainRow(id: string, key: keyof CaptainRow, value: string) {
    setCaptainRows(rows => rows.map(r => r.id === id ? { ...r, [key]: value } : r));
  }

  if (loading) {
    return <Shell><Card><h2>Loading SWCC Hub...</h2></Card></Shell>;
  }

  if (!userEmail) {
    return (
      <Shell>
        <Card>
          <h2>Member login</h2>
          <p>Use your registered SWCC email address.</p>

          {notice && <div className="notice">{notice}</div>}
          {error && <div className="notice error">{error}</div>}

          <div className="tabs">
            <button className={`tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => setMode('signin')}>Sign in</button>
            <button className={`tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>Create account</button>
          </div>

          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />

          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />

          <div className="btn-row">
            {mode === 'signin'
              ? <button className="btn-primary" onClick={signIn}>Sign in</button>
              : <button className="btn-primary" onClick={signUp}>Create account</button>}
          </div>
        </Card>
      </Shell>
    );
  }

  if (!player) {
    return (
      <Shell>
        <Card>
          <h2>Email not registered</h2>
          <p>Your login worked, but this email is not yet in the SWCC player database.</p>
          <p><strong>{userEmail}</strong></p>
          <button className="btn-secondary" onClick={signOut}>Log out</button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <div className="grid grid-2">
          <div>
            <h2>Welcome, {player.full_name}</h2>
            <p>{player.usual_team} · {player.squad_category}</p>
          </div>
          <div>
            <span className={`pill ${player.membership_status}`}>{player.membership_status}</span>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === 'availability' ? 'active' : ''}`} onClick={() => setTab('availability')}>Availability</button>
          <button className={`tab ${tab === 'my-team' ? 'active' : ''}`} onClick={() => setTab('my-team')}>My Team</button>
          {isAdmin && <button className={`tab ${tab === 'captains' ? 'active' : ''}`} onClick={() => { setTab('captains'); loadCaptainDashboard(); }}>Captains</button>}
          <button className="tab" onClick={signOut}>Log out</button>
        </div>
      </Card>

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="notice error">{error}</div>}

      {tab === 'availability' && (
        <Card>
          <h2>Weekly Availability</h2>

          <label>Weekend</label>
          <select value={selectedWeekendId} onChange={e => setSelectedWeekendId(e.target.value)}>
            {weekends.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>

          <label>Availability</label>
          <select value={availabilityStatus} onChange={e => setAvailabilityStatus(e.target.value)}>
            {AVAILABILITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>

          <label>Available after time</label>
          <input value={availableAfter} onChange={e => setAvailableAfter(e.target.value)} placeholder="e.g. 2:30pm" />

          <label>Notes</label>
          <textarea value={availabilityNotes} onChange={e => setAvailabilityNotes(e.target.value)} />

          <div className="btn-row">
            <button className="btn-primary" onClick={saveAvailability}>Save availability</button>
          </div>
        </Card>
      )}

      {tab === 'my-team' && (
        <Card>
          <h2>My Team</h2>
          {!selectedWeekend?.selections_published ? (
            <p>Selections are not published yet.</p>
          ) : (
            selections
              .filter(s => s.weekend_id === selectedWeekendId)
              .map(s => <div key={s.id} className="card"><h3>{s.assigned_team}</h3><p>{s.captain_notes}</p></div>)
          )}
        </Card>
      )}

      {tab === 'captains' && isAdmin && (
        <>
          <Card>
            <h2>Captains Dashboard</h2>

            <label>Weekend</label>
            <select value={selectedWeekendId} onChange={e => setSelectedWeekendId(e.target.value)}>
              {weekends.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>

            <div className="btn-row">
              <button className="btn-secondary" onClick={loadCaptainDashboard}>Refresh dashboard</button>
              <button className="btn-primary" onClick={saveSelections}>Save selections</button>
              <button className="btn-green" onClick={publishSelections}>Publish selections</button>
            </div>
          </Card>

          <Card>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Usual</th>
                    <th>Paid</th>
                    <th>Availability</th>
                    <th>Notes</th>
                    <th>Assign</th>
                    <th>Order</th>
                    <th>Captain Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {captainRows.map(r => (
                    <tr key={r.id}>
                      <td>{r.full_name}<br /><small>{r.email}</small></td>
                      <td>{r.usual_team}</td>
                      <td><span className={`pill ${r.membership_status}`}>{r.membership_status}</span></td>
                      <td>{r.availability_status}{r.available_after ? ` after ${r.available_after}` : ''}</td>
                      <td>{r.notes}</td>
                      <td>
                        <select value={r.assigned_team} onChange={e => updateCaptainRow(r.id, 'assigned_team', e.target.value)}>
                          {ASSIGNMENT_OPTIONS.map(o => <option key={o} value={o}>{o || 'Unassigned'}</option>)}
                        </select>
                      </td>
                      <td>
                        <input value={r.batting_order} onChange={e => updateCaptainRow(r.id, 'batting_order', e.target.value)} />
                      </td>
                      <td>
                        <input value={r.captain_notes} onChange={e => updateCaptainRow(r.id, 'captain_notes', e.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2>WhatsApp Team Message</h2>
            <label>Team</label>
            <select value={whatsappTeam} onChange={e => setWhatsappTeam(e.target.value)}>
              {['1st XI', '2nd XI', '3rd XI', '4th XI'].map(t => <option key={t}>{t}</option>)}
            </select>
            <div className="btn-row">
              <button className="btn-green" onClick={generateWhatsapp}>Generate message</button>
              <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(whatsappMessage)}>Copy</button>
            </div>
            {whatsappMessage && <div className="whatsapp">{whatsappMessage}</div>}
          </Card>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">South Woodford Cricket Club</div>
        <h1>SWCC Hub</h1>
        <p>Availability, selections and club cricket operations.</p>
      </section>
      {children}
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="card">{children}</section>;
}
