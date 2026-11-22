/** GET sólo presenta la confirmación: los escáneres de enlaces no activan cuentas. */
export function renderVerificationPage(nonce: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirma tu cuenta de Nexo U</title></head>
<body><main><h1>Confirma tu correo institucional</h1>
<p>Activa la cuenta que registraste en Nexo U.</p>
<form><button type="submit">Confirmar mi correo</button></form><p role="status" id="result"></p></main>
<script nonce="${nonce}">
const token = new URLSearchParams(location.hash.slice(1)).get('token');
history.replaceState(null, '', location.pathname);
document.querySelector('form').onsubmit = async (event) => {
  event.preventDefault();
  const button = document.querySelector('button');
  button.disabled = true;
  try {
    const response = await fetch('/auth/verify-email', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token})
    });
    document.getElementById('result').textContent = response.ok
      ? 'Correo confirmado. Ya puedes iniciar sesión en Nexo U.'
      : 'El enlace no es válido o venció. Solicita un nuevo correo.';
  } catch {
    document.getElementById('result').textContent = 'No se pudo conectar. Intenta nuevamente.';
  } finally { button.disabled = false; }
};
</script></body></html>`;
}
