// Test helper: make "you" an Admin of every organization in storage.
module.exports = async function (b) {
  const nc = b.newContext.bind(b);
  b.newContext = async (o) => {
    const ctx = await nc(o);
    await ctx.addInitScript(() => {
      try {
        const l = JSON.parse(localStorage.getItem('sevak.organizations.v1') || '[]');
        const leg = JSON.parse(localStorage.getItem('sevak.organization.v1') || 'null');
        const names = l.map(o => o.name).concat(leg ? [leg.name] : []);
        localStorage.setItem('sevak.profile.v1', JSON.stringify({ email: 't@example.com', organizations: names.map(n => ({ name: n, role: 'admin' })) }));
      } catch (e) {}
    });
    return ctx;
  };
};
