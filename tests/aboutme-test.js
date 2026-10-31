const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = []; let n = 0;
  const check = (c, m) => c ? n++ : errs.push(m);
  for (const [w, scheme] of [[1000, 'light'], [360, 'dark']]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme });
    p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8765/app/profile.html');
    await p.evaluate(() => localStorage.clear()); await p.reload();
    check(await p.isVisible('#service-empty'), 'empty note');
    await p.fill('#firstName', 'Bala'); await p.fill('#lastName', 'A'); await p.fill('#email', 'bala@example.com');
    await p.fill('#phone', '5125550100');
    await p.check('input[name=availability][value=anytime]', { force: true });
    await p.click('#tab-about');
    await p.fill('#aboutMe', 'I run a small business and love music.');
    await p.fill('#passion', 'Arts education');
    await p.fill('#certifications', 'CPR and First Aid');
    await p.fill('#howICanHelp', 'Sound systems and accounts');
    check((await p.textContent('[data-counter-for=passion]')) === '14 / 500', 'counter');
    await p.click('#tab-details');
    await p.selectOption('#serviceSelect', 'av');
    await p.selectOption('#serviceSelect', 'accounting');
    await p.selectOption('#serviceSelect', 'general');
    check(await p.$eval('#serviceSelect', s => s.value) === '', 'select resets');
    check(await p.$eval('#serviceSelect option[value=av]', o => o.disabled), 'chosen option disabled');
    check(!(await p.isVisible('#service-empty')), 'empty note hidden');
    await p.click('button[aria-label="Remove Accounting"]');
    check(!(await p.$eval('#serviceSelect option[value=accounting]', o => o.disabled)), 'removed option re-enabled');
    check(await p.evaluate(() => document.activeElement.id) === 'serviceSelect', 'focus back to select');
    await p.click('#save');
    check((await p.textContent('#status')).includes('saved'), 'saved: ' + await p.textContent('#status'));
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('sevak.profile.v1')));
    check(saved.aboutMe.startsWith('I run') && saved.passion === 'Arts education' && saved.certifications === 'CPR and First Aid' && saved.howICanHelp.startsWith('Sound'), 'about saved');
    check(JSON.stringify(saved.services) === '["av","general"]', 'services saved ' + JSON.stringify(saved.services));
    await p.reload();
    check(await p.inputValue('#certifications') === 'CPR and First Aid', 'reload fills'); await p.click('#tab-details');
    check(JSON.stringify(await p.$$eval('.service-chip span', x => x.map(y => y.textContent))) === '["AV system help","General help"]', 'reload chips');
    check(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no overflow ' + w);

    await p.screenshot({ path: `${SP}/aboutme-${w}.png`, fullPage: true });
    await p.click('#delete-profile');
    check(await p.inputValue('#aboutMe') === '' && (await p.$$('.service-chip')).length === 0 && await p.isVisible('#service-empty'), 'delete clears');
    check((await p.textContent('[data-counter-for=aboutMe]')) === '0 / 1000', 'counter reset');
    await p.close();
  }
  console.log(n + ' ok'); console.log(errs.length ? 'FAIL\n' + errs.join('\n') : 'ALL PASS'); await b.close();
})();
