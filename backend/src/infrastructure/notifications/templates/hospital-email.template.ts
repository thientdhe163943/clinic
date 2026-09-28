export interface HospitalEmailBranding {
  name: string;
  address: string;
  phone: string;
  supportPhone: string;
  email: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Wraps a plain-text subject/body pair (the only thing use cases produce —
// they stay presentation-agnostic per Clean Architecture) into the HTML
// layout real hospital transactional emails use: a branded header bar, the
// message body, and a footer with contact details + an auto-generated
// disclaimer. Table-based markup with inline styles only, since that's what
// renders consistently across Gmail/Outlook/mobile mail clients.
export function buildHospitalEmailHtml(subject: string, bodyText: string, branding: HospitalEmailBranding): string {
  const paragraphs = bodyText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#333333;">${escapeHtml(line)}</p>`)
    .join('');

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:#0f6cbd;padding:24px 32px;">
                <span style="font-size:20px;font-weight:bold;color:#ffffff;">${escapeHtml(branding.name)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${escapeHtml(subject)}</h2>
                ${paragraphs}
              </td>
            </tr>
            <tr>
              <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
                <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">${escapeHtml(branding.name)}</p>
                <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">${escapeHtml(branding.address)}</p>
                <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hotline: ${escapeHtml(branding.phone)} &middot; Hỗ trợ: ${escapeHtml(branding.supportPhone)} &middot; Email: ${escapeHtml(branding.email)}</p>
                <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">Đây là email tự động, vui lòng không trả lời email này.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
