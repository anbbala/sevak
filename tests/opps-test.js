const { chromium } = require('playwright');
const B = 'http://localhost:8765/'; const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = []; let n = 0; const check = (c, m) => c ? n++ : errs.push(m);
  const p = await b.newPage({ viewport: { width: 1000, height: 900 } });
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('dialog', d => d.accept());
  const titles = () => p.$$eval('#discover-list h3', h => h.map(x => x.textContent));
  const count = w => p.textContent(`[data-count="${w}"]`);
  const pick = async w => { await p.check(`input[name=where][value="${w}"]`, { force: true }); };

  await p.goto(B + 'app/dashboard.html'); await p.evaluate(() => localStorage.clear());
  await p.goto(B + 'app/dashboard.html?demo=1');

  // ----- Not signed in: no tabs, filter works -----
  await p.goto(B + 'app/signup.html');
  check((await p.textContent('#discover-view h1')) === 'Volunteer opportunities', 'heading');
  check((await count('all')) === '(12)' && (await count('in-person')) === '(11)' && (await count('remote')) === '(1)' && (await count('near')) === '', 'chip counts ' + [await count('all'), await count('in-person'), await count('remote')]);
  await pick('remote');
  check(JSON.stringify(await titles()) === '["Donor Thank-You Calls"]', 'remote list');
  check((await p.textContent('#discover-list .opp-meta')).includes('Online'), 'remote shows Online');
  await pick('in-person');
  const ip = await titles();
  check(ip.length === 11 && !ip.includes('Donor Thank-You Calls'), 'all in person');
  await pick('near');
  check(await p.isVisible('#near-row') && (await titles()).length === 0 && (await p.textContent('#discover-empty')).includes('Enter your city'), 'near: asks for a place');
  check(await p.evaluate(() => document.activeElement.id) === 'near', 'focus moves to near box');
  const near = async (q, expect, label) => { await p.fill('#near', q); const t = await titles(); check(t.length === expect, `near "${q}": ${t.length} (expected ${expect}) ${label || ''}`); return t; };
  check(JSON.stringify(await near('San Antonio', 1)) === '["San Antonio Book Drive"]', 'san antonio is the book drive');
  await near('austin', 10); await near('Austin, TX', 10); await near('TX', 11); await near('78205', 1); await near('782', 1); await near('78701', 10);
  await near('Dallas', 0);
  check((await p.textContent('#discover-empty')).includes('near Dallas'), 'near none message');
  check((await count('near')) === '(0)', 'near count');
  // Remembered when coming back
  await p.fill('#near', 'San Antonio');
  await p.goto(B + 'app/signup.html?event=demo-ev-books'); await p.goto(B + 'app/signup.html');
  check(await p.isChecked('input[name=where][value=near]') && (await p.inputValue('#near')) === 'San Antonio' && (await titles()).length === 1, 'filter remembered');
  await pick('all');

  // ----- Signed in -----
  await p.evaluate(() => { localStorage.removeItem('sevak.opportunityFilter.v1'); localStorage.setItem('sevak.profile.v1', JSON.stringify({ firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com', phone: { country: 'US', number: '+15125550100' }, roles: { volunteer: true }, address: { country: 'US', city: 'Austin', state: 'TX' } }));
    // Asha volunteers with the Riverside demo (approved earlier).
    localStorage.setItem('sevak.memberships.v1', JSON.stringify([{ id: 'mem-asha', orgId: 'demo-org', email: 'asha@example.com', name: 'Asha Rao', status: 'active', how: 'request' }])); });
  await p.goto(B);
  await p.waitForURL(/app\/signup\.html/);
  check(!p.url().includes('view=mine'), 'home lands on opportunities');
  check((await p.getAttribute('#tab-my-orgs', 'aria-selected')) === 'true' && (await p.textContent('#tab-my-orgs')).includes('My organizations'), 'member: My organizations tab first');
  check((await titles()).every(t => !/Pantry|Meal Packing/.test(t)) && (await count('all')) === '(10)', 'my orgs: only Riverside events');
  await p.click('#tab-all-orgs');
  check((await count('all')) === '(12)' && (await titles()).includes('Pantry Restock Night'), 'all orgs tab: every event');
  await p.click('#tab-my-orgs');
  await pick('near');
  check((await p.inputValue('#near')) === 'Austin' && (await p.textContent('#near-source')).includes('profile') && (await titles()).length === 8, 'near prefilled from profile');
  await pick('all');
  await p.click('#app-nav a:has-text("My sign-ups")');
  check(await p.isVisible('#mine-empty') && !(await p.$('.nav-count')), 'no sign-ups yet');
  await p.click('#mine-empty a:has-text("Browse opportunities")');
  check(await p.isVisible('#discover-view'), 'browse button');

  // Sign up for the park clean-up
  await p.click('text=Riverside Park Clean-up');
  await p.waitForURL(/event=demo-ev-park/);
  check(await p.isHidden('#member-hint'), 'member: no join hint');
  await p.check('input[value="demo-ev-park-shift-0-0"]');
  await p.click('#continue');
  check(await p.inputValue('#email') === 'asha@example.com' && await p.isVisible('#who-summary') && await p.isHidden('#join-gate'), 'member: signs up as herself, no gate');
  await p.click('#submit');
  await p.waitForSelector('#confirm-view:not([hidden])');
  check(await p.isVisible('#all-signups'), 'All my sign-ups link');
  await p.click('#all-signups');
  await p.waitForURL(/view=mine$/);
  check(await p.isVisible('#mine-view'), 'lands on My sign-ups');
  check((await p.textContent('#app-nav .nav-count')) === '1', 'count 1');
  const card = await p.textContent('#mine-groups');
  check(card.includes('Upcoming') && card.includes('Riverside Park Clean-up') && card.includes('Litter pickers') && card.includes('Manage or cancel'), 'upcoming card');

  await p.screenshot({ path: SP + '/mine-desktop.png', fullPage: true });

  // Past, inactive, removed and cancelled
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('sevak.signups.v1'));
    const add = (id, ev, shift, status) => s.push({ id, registrationId: 'reg-' + id, eventId: ev, shiftId: shift, name: 'Asha Rao', email: 'Asha@Example.com', status: status || 'confirmed', createdAt: new Date().toISOString() });
    add('t1', 'demo-ev-fair', 'demo-ev-fair-shift-0-0');
    add('t2', 'demo-ev-sort', 'demo-ev-sort-shift-0-0');
    add('t3', 'gone-event', 'x');
    add('t4', 'demo-ev-dist', 'demo-ev-dist-shift-0-0', 'cancelled');
    localStorage.setItem('sevak.signups.v1', JSON.stringify(s));
    const ev = JSON.parse(localStorage.getItem('sevak.events.v1'));
    ev.find(e => e.id === 'demo-ev-sort').active = false;
    localStorage.setItem('sevak.events.v1', JSON.stringify(ev));
  });
  await p.reload();
  const groups = await p.$$eval('#mine-groups .mine-heading', h => h.map(x => x.textContent));
  check(JSON.stringify(groups) === '["Upcoming","Past","Cancelled"]', 'groups ' + groups);
  const txt = await p.textContent('#mine-groups');
  check(txt.includes('Summer Fair') && txt.includes('Hours to log'), 'past card asks for hours');
  check(txt.includes('Food Drive: Sorting') && txt.includes('No longer active'), 'inactive card');
  check(txt.includes('An event that was removed') && txt.includes('Removed'), 'removed card');
  check(txt.includes('Food Drive: Distribution') && await p.isVisible('.my-signup.is-cancelled'), 'cancelled card');
  check((await p.textContent('#app-nav .nav-count')) === '1' && (await p.textContent('.my-signup:has-text("was removed") .signup-manage')) === 'View sign-up', 'live count 1, removed says View');
  await p.screenshot({ path: SP + '/mine-groups.png', fullPage: true });

  // Manage → cancel moves it to Cancelled
  await p.click('.my-signup:has-text("Riverside Park Clean-up") .signup-manage');
  await p.waitForURL(/registration=/);
  await p.click('.my-shift button');
  await p.goto(B + 'app/signup.html#mine');
  const cancelledTxt = await p.$$eval('.my-signup.is-cancelled h3', h => h.map(x => x.textContent));
  check(cancelledTxt.includes('Riverside Park Clean-up'), 'cancelled after manage');


  // Phone + dark
  const m = await (await b.newContext({ viewport: { width: 360, height: 800 }, colorScheme: 'dark' })).newPage();
  m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto(B + 'app/dashboard.html?demo=1');
  await m.evaluate(() => localStorage.setItem('sevak.profile.v1', JSON.stringify({ firstName: 'Asha', email: 'asha@example.com', address: { city: 'Austin' } })));
  await m.goto(B + 'app/signup.html');
  check(!(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone fits');
  await m.screenshot({ path: SP + '/opps-phone-dark.png', fullPage: false });

  console.log(n + ' ok'); console.log(errs.length ? 'FAIL\n' + errs.join('\n') : 'ALL PASS'); await b.close();
})();
