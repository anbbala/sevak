const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; let n = 0;
  const check = (c, m) => c ? n++ : errs.push(m);
  const p = await b.newPage({ viewport: { width: 1000, height: 900 } });
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('dialog', d => d.accept());
  const B = 'http://localhost:8765/app/';
  const prof = x => p.evaluate(v => localStorage.setItem('sevak.profile.v1', JSON.stringify(v)), x);
  await p.goto(B + 'dashboard.html?demo=1');
  await prof({ email: 'cora@example.com', roles: { host: true }, organizations: [{ name: 'Riverside Community Arts (demo)', role: 'coordinator' }] });
  await p.goto(B + 'organization.html');
  check(!(await p.isVisible('#delete-org')) && await p.isVisible('#readonly-note'), 'coordinator: view-only, no delete');
  await p.click('#tab-team');
  check(await p.isDisabled('#add-member'), 'coordinator cannot add team members (or promote themselves)');
  // An Admin makes Cora an Admin on the Team tab.
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('sevak.organizations.v1')); l.find(o => o.id === 'demo-org').team = [{ name: 'Cora', email: 'cora@example.com', role: 'admin' }]; localStorage.setItem('sevak.organizations.v1', JSON.stringify(l)); });
  await p.reload();
  check(await p.isVisible('#delete-org') && !(await p.isVisible('#delete-org-hint')) && !(await p.isVisible('#readonly-note')), 'admin: delete shown, editable');
  await p.click('#delete-org');
  await p.waitForLoadState('load');
  check(await p.evaluate(() => !JSON.parse(localStorage.getItem('sevak.organizations.v1')).some(o => o.id === 'demo-org')), 'admin deleted org');
  // Creator of a new org can delete it right away.
  await prof({ email: 'neo@example.com', roles: { volunteer: true } });
  await p.goto(B + 'organization.html?new=1');
  check(!(await p.isVisible('#delete-org')) && !(await p.isVisible('#delete-org-hint')), 'new org: neither shown');
  await p.evaluate(() => { const O = window.SevakOrgs; const o = O.save({ name: 'Neo Org' }); O.setCurrent(o.id); });
  await p.goto(B + 'organization.html');
  check(await p.isVisible('#delete-org'), 'creator sees delete');
  // Someone else doesn't.
  await prof({ email: 'other@example.com' });
  await p.reload();
  check(!(await p.isVisible('#delete-org')) && await p.isVisible('.way-in'), 'other person: not on the team');
  await p.setViewportSize({ width: 360, height: 800 });
  check(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone fits');
  console.log(n + ' ok'); console.log(errs.length ? 'FAIL\n' + errs.join('\n') : 'ALL PASS'); await b.close();
})();
