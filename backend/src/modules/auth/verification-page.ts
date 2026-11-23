const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char,
  );

export function renderVerificationPage(
  nonce: string,
  frontendUrl = '',
): string {
  const home = escapeHtml(frontendUrl.replace(/\/+$/, '') || '/');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirma tu cuenta de Nexo U</title>
<style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f1f5f9;color:#16232f;font-family:"Segoe UI",system-ui,sans-serif}
main{width:min(440px,100%);padding:32px 28px;border-radius:16px;background:#fff;border-top:4px solid #f2b705;box-shadow:0 12px 32px rgba(0,82,137,.12);text-align:center}
.brand{margin:0 0 18px;color:#005289;font-weight:800;font-size:1.25rem;letter-spacing:-.02em}
h1{margin:0 0 10px;font-size:1.35rem}p{margin:0 0 20px;color:#52606d;line-height:1.55}
button,a.home{display:inline-flex;justify-content:center;width:100%;min-height:46px;align-items:center;border:0;border-radius:10px;background:#005289;color:#fff;font-family:inherit;font-size:1rem;font-weight:600;text-decoration:none;cursor:pointer}
button:disabled{opacity:.6;cursor:default}#result{min-height:1.5em;margin:16px 0 0;font-weight:600}#result.ok{color:#11603f}#result.error{color:#8a2b20}
a.home{margin-top:12px;background:#fff;color:#005289;border:1px solid #005289}a.home[hidden],button[hidden]{display:none}
</style></head>
<body><main><p class="brand">Nexo U</p><h1>Confirma tu correo</h1>
<p>Presiona el botón para activar tu cuenta y recibir tus créditos de bienvenida.</p>
<form><button type="submit">Confirmar mi correo</button></form><p role="status" id="result"></p>
<a class="home" href="${home}" hidden>Ir a Nexo U</a></main>
<script nonce="${nonce}">
const token = new URLSearchParams(location.hash.slice(1)).get('token');
history.replaceState(null, '', location.pathname);
const result = document.getElementById('result');
const home = document.querySelector('a.home');
document.querySelector('form').onsubmit = async (event) => {
  event.preventDefault();
  const button = document.querySelector('button');
  button.disabled = true;
  try {
    const response = await fetch('/auth/verify-email', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token})
    });
    result.className = response.ok ? 'ok' : 'error';
    result.textContent = response.ok
      ? 'Correo confirmado. Ya puedes iniciar sesión en Nexo U.'
      : 'El enlace no es válido o venció. Solicita un nuevo correo desde Nexo U.';
    if (response.ok) { button.hidden = true; home.hidden = false; }
  } catch {
    result.className = 'error';
    result.textContent = 'No se pudo conectar. Intenta nuevamente.';
  } finally { button.disabled = false; }
};
</script></body></html>`;
}
