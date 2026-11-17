// HU-10: pruebas de humo contra un ambiente desplegado.
// Uso: BASE_URL=https://css-planillas-api.onrender.com npm run smoke
const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

async function paso(nombre, fn) {
  try {
    await fn();
    console.log(`ok   ${nombre}`);
  } catch (e) {
    console.error(`FALLA ${nombre}: ${e.message}`);
    process.exitCode = 1;
    throw e;
  }
}

const esperar = (cond, msg) => { if (!cond) throw new Error(msg); };

try {
  // Render duerme los servicios gratuitos: se reintenta /salud hasta 2 minutos.
  await paso('GET /salud', async () => {
    for (let i = 0; i < 24; i++) {
      const r = await fetch(`${base}/salud`).catch(() => null);
      if (r?.ok) return;
      await new Promise((ok) => setTimeout(ok, 5000));
    }
    throw new Error('el servicio no respondió');
  });

  let token = process.env.SMOKE_TOKEN;
  const local = ['localhost', '127.0.0.1'].includes(new URL(base).hostname);
  if (!token && local) await paso('POST /auth/login de demostración local', async () => {
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruc: '155123456-2-2020', usuario: 'ana.contabilidad', clave: process.env.DEMO_PASSWORD ?? 'demo1234' }),
    });
    esperar(r.status === 200, `estado ${r.status}`);
    token = (await r.json()).token;
  });

  await paso('GET /cargas sin token responde 401', async () => {
    esperar((await fetch(`${base}/cargas`)).status === 401, 'no exige autenticación');
  });

  if (token) await paso('GET /planillas autenticado', async () => {
    const r = await fetch(`${base}/planillas`, { headers: { Authorization: `Bearer ${token}` } });
    esperar(r.status === 200, `estado ${r.status}`);
    esperar(Array.isArray(await r.json()), 'no devolvió el historial de planillas');
  });

  console.log(token ? 'Comprobaciones de salud y acceso superadas.' : 'Comprobaciones públicas superadas. Define SMOKE_TOKEN para verificar el acceso autenticado.');
} catch {
  process.exitCode = 1;
}
