const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char,
  );

export function verificationEmail(link: string, minutes: number) {
  const subject = 'Confirma tu cuenta institucional de Nexo U';
  const text = `Para activar la cuenta que registraste, abre este enlace y pulsa Confirmar:\n${link}\n\nEl enlace vence en ${minutes} minutos. Si no solicitaste esta cuenta, ignora este correo. No compartas el enlace.`;
  const href = escapeHtml(link);
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;color:#16232f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border-top:5px solid #f2b705;">
<tr><td style="background:#005289;padding:22px 32px;">
<span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">Nexo U</span>
<span style="display:block;margin-top:2px;font-size:12px;color:#cfe3f3;">Banco de Tiempo Universitario · UCB La Paz</span>
</td></tr>
<tr><td style="padding:32px 32px 8px;">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#16232f;">Confirma tu correo institucional</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52606d;">Ya casi está. Confirma tu cuenta para empezar a intercambiar lo que sabes y recibir tus créditos de bienvenida.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:10px;background:#005289;">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Confirmar mi correo</a>
</td></tr></table>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#52606d;">El enlace vence en <strong>${minutes} minutos</strong>. Si el botón no funciona, copia este enlace en tu navegador:</p>
<p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${href}" style="color:#005289;">${href}</a></p>
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #e3e9ef;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#7b8794;">Si no creaste una cuenta en Nexo U, ignora este correo. No compartas este enlace con nadie.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}
