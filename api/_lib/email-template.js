/**
 * Das KursNavi-E-Mail-Layout — einmal, statt elfmal.
 *
 * Dieselbe Vorlage lag in elf Serverdateien als Kopie: send-lead, contact,
 * cancel-event, cron, dispute-booking, mark-booking-delivered, refund-booking,
 * request-goodwill-refund, respond-goodwill-refund, webhook und
 * course-booking-email.
 *
 * Sie waren bereits auseinandergelaufen — sechs unterschiedliche Fassungen.
 * Die Unterschiede waren allerdings rein kosmetisch und ohne Wirkung auf das,
 * was beim Empfaenger ankommt:
 *   - mal ueber COLORS, mal dieselben Farbwerte direkt ausgeschrieben
 *   - ein `transition`, das in E-Mail-Programmen ohnehin nichts tut
 *   - `&copy;` statt `©`
 *   - cron.js verlinkte auf www.kursnavi.ch, was auf kursnavi.ch weiterleitet
 *
 * Ein Design-Update musste bisher an elf Stellen gemacht werden — oder wurde
 * an zehn vergessen. Genau das ist hier passiert.
 */

import { getBaseUrl } from './base-url.js';

export const COLORS = {
  primary: '#FA6E28',
  secondary: '#2563EB',
  text: '#1F2937',
  gray: '#F3F4F6',
  white: '#FFFFFF',
};

/**
 * @param {string} title     Ueberschrift im Inhaltsbereich
 * @param {string} bodyHtml  Bereits aufbereitetes HTML des Fliesstexts
 * @param {string} ctaText   Beschriftung des Knopfs
 * @param {string} [ctaLink] Ziel des Knopfs; ohne Angabe das Dashboard
 */
export function generateEmailHtml(title, bodyHtml, ctaText, ctaLink = `${getBaseUrl()}/dashboard`) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: ${COLORS.gray}; padding: 0; margin: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: ${COLORS.gray}; padding-bottom: 40px; }
    .container { max-width: 600px; margin: 0 auto; background-color: ${COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background-color: ${COLORS.white}; padding: 30px 40px; text-align: center; border-bottom: 3px solid ${COLORS.primary}; }
    .header h1 { margin: 0; color: ${COLORS.primary}; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 40px; color: ${COLORS.text}; line-height: 1.6; font-size: 16px; }
    .btn-container { text-align: center; margin-top: 30px; }
    .btn { display: inline-block; background-color: ${COLORS.primary}; color: ${COLORS.white}; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
    .footer { background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; }
    strong { color: ${COLORS.secondary}; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header"><h1>KursNavi</h1></div>
      <div class="content">
        <h2 style="margin-top: 0; color: ${COLORS.text};">${title}</h2>
        <div style="color: #4B5563;">${bodyHtml}</div>
        <div class="btn-container">
          <a href="${ctaLink}" class="btn">${ctaText}</a>
        </div>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} KursNavi Schweiz. Alle Rechte vorbehalten.</p>
        <p>Dies ist eine automatische Nachricht.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}
