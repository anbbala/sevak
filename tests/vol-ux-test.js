const { chromium } = require('playwright');
const B = 'http://localhost:8765/app/'; const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = []; let n = 0; const check = (c, m) => c ? n++ : errs.push(m);
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('dialog', d => d.accept());
  const navText = () => p.$$eval('#app-nav .nav-main a', a => a.map(x => x.textContent).join('|'));
  const visibleShifts = () => p.$$eval('#shift-groups .day-group:not([hidden]) > .shift-lines input[name=shift]', i => i.length);

  await p.goto(B + 'signup.html'); await p.evaluate(() => localStorage.clear());
  await p.goto(B + 'dashboard.html?demo=1');

  // ----- Signed out -----
  await p.goto(B + 'signup.html');
  check((await navText()) === 'Opportunities|Join|Sign in', 'signed out menu');
  check((await p.textContent('#discover-view h1')) === 'Volunteer opportunities', 'heading');
  const groups = await p.$$eval('#discover-list .opp-group', g => g.map(x => x.textContent));
  check(groups.length >= 2 && groups.every(g => ['This week', 'Next week', 'Later'].includes(g)), 'week groups ' + groups);
  // The demo has two organizations: each row names its organization.
  check((await p.$$('.opp-org')).length >= 10, 'several organizations: rows name them');
  const meta = await p.$$eval('.opp-meta', m => m.map(x => x.textContent));
  check(meta.every(t => !t.includes('United States') && !t.includes('200 Elm')), 'short places ' + meta[0]);
  check(meta.some(t => t.endsWith('· Online')), 'online shown');
  check(await p.isVisible('#browse-hint') && await p.isHidden('#org-tabs'), 'signed out: a hint, no tabs');
  check((await p.$$('.opp-join')).length === 0, 'signed out: no join tags on rows');

  // Banner: dismiss, stays dismissed
  await p.click('.banner-close');
  check(!(await p.isVisible('.banner')), 'banner dismissed');
  await p.goto(B + 'signup.html?event=demo-ev-park');
  check(!(await p.isVisible('.banner')), 'banner stays dismissed');
  await p.goto(B + 'events.html');
  check(await p.isVisible('.banner') && (await p.textContent('.banner')).includes('previewing'), 'preview note re-shows the banner');

  // ----- Signed out: two steps, then a way to join (no guest sign-ups) -----
  await p.goto(B + 'signup.html?event=demo-ev-park');
  check(await p.isVisible('.back-link:has-text("Opportunities")'), 'back link');
  check(!(await p.isVisible('#day-picker')), 'one day: no day picker');
  check(await p.isVisible('#about-event'), 'about this event folded');
  check(!(await p.isVisible('#about-body')), 'about closed by default');
  check((await p.textContent('#member-hint')).includes('join Sevak with Riverside Community Arts (demo)'), 'signed out: member hint');
  await p.click('#continue');
  check((await p.textContent('#shifts-error')).includes('Pick at least one'), 'continue needs a shift');
  await p.check('input[value="demo-ev-park-shift-0-0"]');
  check((await p.textContent('#pick-count')) === '1 shift picked', 'count');
  await p.click('#continue');
  check(await p.isVisible('#step-confirm') && !(await p.isVisible('#step-pick')) && p.url().endsWith('#confirm'), 'step 2');
  check((await p.textContent('#picked-list')).includes('Litter pickers'), 'picked list');
  check(await p.isVisible('#join-gate') && (await p.textContent('#join-gate h2')) === 'Join Sevak to sign up', 'signed out: join gate');
  check(await p.isHidden('#details-section') && await p.isHidden('#submit'), 'signed out: no guest form, no confirm');
  check((await p.getAttribute('#join-gate a:has-text("Join Riverside")', 'href')) === 'join.html?org=demo-org&return=signup.html%3Fevent%3Ddemo-ev-park', 'join link names the org and comes back');

  // ----- Sign in -----
  await p.evaluate(() => { localStorage.setItem('sevak.profile.v1', JSON.stringify({ firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com', phone: { country: 'US', number: '+15125550100' }, roles: { volunteer: true } }));
    localStorage.setItem('sevak.memberships.v1', JSON.stringify([{ id: 'mem-asha', orgId: 'demo-org', email: 'asha@example.com', name: 'Asha Rao', status: 'active', how: 'request' }])); });
  await p.goto(B + 'signup.html');
  check((await navText()) === 'Opportunities|My sign-ups|Profile', 'signed in menu: ' + await navText());
  check(!(await p.$('#signed-in')), 'no "Signed in as" line on the list');
  check(!(await p.$('.nav-count')), 'no count yet');

  // Multi-day event
  await p.click('.opp-row:has-text("Arudra Festival Weekend")');
  await p.waitForURL(/event=demo-ev-fest/);
  check(await p.isVisible('#day-picker') && (await p.$$('#day-picker .day-chip')).length === 2, 'day picker');
  check((await p.$$('#shift-groups .day-group:not([hidden])')).length === 1, 'one day at a time');
  const day1 = await visibleShifts();
  check(day1 === 3 && await p.isVisible('#shift-groups .day-group:not([hidden]) .full-shifts summary:has-text("1 full shift")'), 'full shifts tucked away: ' + day1);
  await p.click('#shift-groups .day-group:not([hidden]) .full-shifts summary');
  check(await p.isDisabled('#shift-groups .day-group:not([hidden]) .full-shifts input'), 'full shift disabled');
  // Details toggle
  const det = p.locator('#shift-groups .day-group:not([hidden]) .shift-more').first();
  await det.click();
  check((await det.getAttribute('aria-expanded')) === 'true' && (await det.textContent()) === 'Hide', 'details open');
  // Pick on both days
  await p.check('#shift-groups .day-group:not([hidden]) > .shift-lines input >> nth=0');
  await p.click('#day-picker .day-chip >> nth=1');
  check((await p.$eval('#day-picker .day-chip >> nth=0', c => c.querySelector('.day-chip-count').textContent)) === '1' || (await p.$$eval('#day-picker .day-chip .day-chip-count', c => c.map(x => x.textContent)))[0] === '1', 'day chip shows picks');
  await p.check('#shift-groups .day-group:not([hidden]) > .shift-lines input >> nth=1');
  check((await p.textContent('#pick-count')) === '2 shifts picked', '2 picked across days');
  await p.click('#continue');
  check(await p.isVisible('#who-summary') && !(await p.isVisible('#details-section')), 'signed in: who summary, no form');
  check((await p.textContent('#who-summary')).includes('Asha Rao') && (await p.textContent('#who-summary')).includes('asha@example.com'), 'who');
  check((await p.textContent('#submit')) === 'Confirm 2 shifts', 'confirm label');
  await p.screenshot({ path: SP + '/ux-confirm-desk.png', fullPage: true });
  // Browser back → step 1 with picks kept; forward → step 2
  await p.goBack();
  check(await p.isVisible('#step-pick') && (await p.textContent('#pick-count')) === '2 shifts picked', 'back keeps picks');
  await p.goForward();
  check(await p.isVisible('#step-confirm'), 'forward to confirm');
  await p.click('#back-to-shifts');
  check(await p.isVisible('#step-pick'), '‹ Shifts button');
  await p.click('#continue');
  await p.click('#who-change');
  check(await p.isVisible('#details-section') && (await p.inputValue('#name')) === 'Asha Rao', 'change shows the form, prefilled');
  await p.click('#submit');
  await p.waitForSelector('#confirm-view:not([hidden])');
  check((await p.textContent('.nav-count')) === '1', 'menu count 1');
  check(await p.isVisible('#all-signups'), 'all my sign-ups link');
  // Back from confirmation → the event, fresh
  await p.goBack();
  const fresh = await p.waitForFunction(() => { const s = document.getElementById('step-pick'); return s && !s.hidden && !document.getElementById('event-view').hidden && document.getElementById('pick-count').textContent === 'No shifts picked yet'; }, null, { timeout: 5000 }).then(() => true).catch(() => false);
  check(fresh && /event=demo-ev-fest$/.test(p.url()), 'back from confirmation: fresh step 1');

  // Capacity race: the shift fills while on step 2
  await p.goto(B + 'signup.html?event=demo-ev-reh1');
  await p.check('input[value="demo-ev-reh1-shift-0-0"]');
  await p.click('#continue');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('sevak.signups.v1')); for (let i = 0; i < 5; i++) s.push({ id: 'x' + i, registrationId: 'rx' + i, eventId: 'demo-ev-reh1', shiftId: 'demo-ev-reh1-shift-0-0', name: 'X', email: 'x' + i + '@e.com', status: 'confirmed' }); localStorage.setItem('sevak.signups.v1', JSON.stringify(s)); });
  await p.click('#submit');
  check(await p.isVisible('#step-pick') && (await p.textContent('#shifts-error')).includes('just filled up'), 'filled meanwhile → back to step 1');

  // My sign-ups is its own page; old #mine links still work
  await p.goto(B + 'signup.html#mine');
  check(p.url().endsWith('signup.html?view=mine') && await p.isVisible('#mine-view') && (await p.textContent('#mine-groups')).includes('Arudra Festival Weekend'), 'old #mine link');
  check(await p.$eval('#app-nav a[aria-current=page]', a => a.textContent.startsWith('My sign-ups')), 'menu marks My sign-ups');

  // Profile has Sign out
  await p.goto(B + 'profile.html');
  check(await p.isVisible('#account-line') && (await p.textContent('#account-email')) === 'asha@example.com', 'account line');
  await p.click('#sign-out');
  await p.waitForLoadState('load');
  check((await p.textContent('h1')) === 'Welcome Volunteer', 'signed out to welcome');
  await p.goto(B + 'signup.html?view=mine');
  check(await p.isVisible('#mine-signed-out'), 'my sign-ups asks to sign in');

  // ----- Phone: bottom bar -----
  await p.goto(B + 'signin.html'); await p.fill('#email', 'asha@example.com'); await p.click('button:has-text("Sign in")'); await p.waitForURL(/signup\.html/);
  await p.setViewportSize({ width: 375, height: 800 });
  await p.goto(B + 'signup.html');
  check(await p.isVisible('#tab-bar') && !(await p.isVisible('#app-nav .nav-main')), 'phone: bottom bar instead of top links');
  const tabs = await p.$$eval('#tab-bar .tab-bar-label', l => l.map(x => x.textContent).join('|'));
  check(tabs === 'Opportunities|My sign-ups|Profile', 'bar items ' + tabs);
  // On a team: Manage joins the bar
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('sevak.organizations.v1')); l.find(o => o.id === 'demo-org').team = [{ name: 'Asha Rao', email: 'asha@example.com', role: 'coordinator' }]; localStorage.setItem('sevak.organizations.v1', JSON.stringify(l)); });
  await p.reload();
  check((await p.$$eval('#tab-bar .tab-bar-label', l => l.map(x => x.textContent).join('|'))) === 'Opportunities|My sign-ups|Profile|More', 'team member: More in the bar');
  check(!(await p.isVisible('#app-nav .nav-manage')), 'phone, volunteer page: no Manage links at top');
  await p.screenshot({ path: SP + '/ux-list-phone.png' });
  check(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone fits');
  await p.goto(B + 'signup.html?event=demo-ev-fest');
  const barBox = await p.$eval('#pick-bar', e => e.getBoundingClientRect().bottom);
  const tabTop = await p.$eval('#tab-bar', e => e.getBoundingClientRect().top);
  check(barBox <= tabTop + 1, 'Continue bar sits above the bottom bar');
  await p.goto(B + 'events.html');
  check(await p.isVisible('#app-nav .nav-manage') && await p.isVisible('#tab-more-btn.is-current'), 'phone manage page: manage links at top, More marked in bar');
  await p.click('#tab-more-btn');
  const menuBox = await p.$eval('#tab-more-menu', e => e.getBoundingClientRect());
  const tabTop2 = await p.$eval('#tab-bar', e => e.getBoundingClientRect().top);
  check(menuBox.bottom <= tabTop2 + 1 && menuBox.right <= 375, 'More menu opens above the bar');

  console.log(n + ' ok'); console.log(errs.length ? 'FAIL\n' + errs.join('\n') : 'ALL PASS'); await b.close();
})();
