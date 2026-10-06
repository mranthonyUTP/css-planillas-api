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

  let token;
  await paso('POST /auth/login', async () => {
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruc: 'SMOKE-TEST', usuario: 'smoke', clave: 'smoke' }),
    });
    esperar(r.status === 200, `estado ${r.status}`);
    token = (await r.json()).token;
  });

  await paso('GET /cargas sin token responde 401', async () => {
    esperar((await fetch(`${base}/cargas`)).status === 401, 'no exige autenticación');
  });

  await paso('POST /planillas/validar detecta errores', async () => {
    const form = new FormData();
    form.append('archivo', new Blob(['cedula,nombre,salario,dias_laborados,codigo_ocupacion\n8-1234-,Prueba,,32,X99\n']), 'smoke.csv');
    form.append('periodo', '2026-10');
    form.append('tipo', 'Regular');
    const r = await fetch(`${base}/planillas/validar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    esperar(r.status === 200, `estado ${r.status}`);
    const v = await r.json();
    esperar(v.valida === false && v.errores.length > 0, 'no detectó los errores');
  });

  console.log('Pruebas de humo superadas.');
} catch {
  process.exitCode = 1;
}
