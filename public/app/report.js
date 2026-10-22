// Printable A4 referral report. Carries the reviewing dentist's name and registration number,
// and a QR code that links to the public verification page (which shows no patient details).
import { html, useEffect, useRef, useState, useAppState, t, useLoad, Loading, fmtDate, TranslatedText } from './ui.js';
import { api } from './api.js';
import { OHAT_ITEMS, COMPLAINTS, REFERRAL_TYPES, RED_FLAGS } from '/shared/clinical.js';

function Qr({ text }) {
  const ref = useRef();
  useEffect(() => {
    const draw = () => {
      if (!window.qrcode) return setTimeout(draw, 200);
      const q = window.qrcode(0, 'M');
      q.addData(text);
      q.make();
      ref.current.innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
    };
    draw();
  }, [text]);
  return html`<div class="qr" ref=${ref} aria-label=${t('QR code to verify this report')}></div>`;
}

export function ReportView({ caseId }) {
  const s = useAppState();
  const d = useLoad(() => api(`/api/cases/${caseId}/report`), [caseId]);
  const [lang, setLang] = useState('both');
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const { case: c, person: p, screening: sc, opinion: o, dentist, kb, generated_at } = d.data;
  const verifyUrl = `${location.origin}/v/${o.verify_code}`;
  const target = s.user.content_lang || 'ml';
  const age = p.birth_year ? new Date().getFullYear() - p.birth_year : null;
  const block = (title, text) => text && html`<h2>${title}</h2>
    ${lang === 'orig' || o.text_lang === target ? html`<div class="box">${text}</div>` : html`<${TranslatedText} text=${text} lang=${o.text_lang} target=${target} show=${true} />`}`;
  return html`
    <div class="no-print row between" style="max-width:210mm;margin:0 auto 12px">
      <a href=${'#/case/' + caseId}>‹ ${t('Back')}</a>
      <div class="row">${o.text_lang !== target && html`<select style="width:auto" value=${lang} onChange=${e => setLang(e.target.value)}>
        <option value="both">${t('Original and translation')}</option><option value="orig">${t('Original only')}</option></select>`}
        <button class="btn primary" onClick=${() => print()}>${t('Print or save as PDF')}</button></div>
    </div>
    <article class="report-page">
      <header class="report-head">
        <div><div class="org">Vayosmitham — Community Geriatric Oral Health</div>
          <div class="small">Community Innovation Foundation (CIF) with the Association of Geriatric Dentistry (AGeD)</div>
          <div class="small"><strong>Advisory screening opinion and referral</strong> — not a diagnosis or prescription</div></div>
        <div style="text-align:center"><${Qr} text=${verifyUrl} /><div class="tiny">Verify: ${o.verify_code}</div></div>
      </header>
      <dl class="kv">
        <dt>Name</dt><dd>${p.name}</dd>
        <dt>Age / sex</dt><dd>${age ? age + ' years' : '—'} / ${{ F: 'Female', M: 'Male', O: 'Other' }[p.sex]}</dd>
        <dt>Address</dt><dd>${[p.address, p.lsgd_name, p.ward && 'Ward ' + p.ward, p.district, p.state].filter(Boolean).join(', ')}</dd>
        <dt>Person ID / case</dt><dd>${p.id} / ${c.id}</dd>
        <dt>Screened at home</dt><dd>${fmtDate(c.submitted_at)}</dd>
        <dt>Opinion signed</dt><dd>${fmtDate(o.signed_at)}${o.version > 1 ? ` (corrected version ${o.version})` : ''}</dd>
      </dl>
      ${c.red_flags.length > 0 && html`<h2>Warning signs reported</h2><div class="box">${c.red_flags.map(k => RED_FLAGS.find(r => r.key === k)?.en).join('\n')}</div>`}
      ${o.referral_needed ? html`<h2>Referral</h2><div class="box"><strong>${REFERRAL_TYPES.find(r => r.key === o.referral_type)?.en}</strong> — ${{ within_24h: 'within 24 hours', within_7d: 'within 7 days', within_30d: 'within one month', routine: 'routine' }[o.referral_urgency] || ''}${o.referral_message ? '\n\n' + o.referral_message : ''}</div>` : ''}
      ${block('Impression', o.impression)}
      ${block('Findings', o.findings)}
      ${block('Advice', o.advice)}
      ${block('Care plan', o.care_plan)}
      ${o.cannot_assess ? html`<p><strong>The dentist could not assess this remotely; an in-person dental examination is needed.</strong></p>` : ''}
      <h2>Screening summary</h2>
      <dl class="kv">
        <dt>Complaints</dt><dd>${sc.complaints.map(k => COMPLAINTS.find(x => x.key === k)?.en).join(', ') || '—'}</dd>
        <dt>OHAT (0 healthy – 16)</dt><dd>${sc.ohat_total} — ${OHAT_ITEMS.filter(it => sc.ohat[it.key] > 0).map(it => `${it.en}: ${sc.ohat[it.key]}`).join(', ') || 'no changes'}</dd>
        <dt>Natural teeth</dt><dd>${sc.natural_teeth ?? '—'}</dd>
        <dt>Dentures</dt><dd>upper ${sc.denture_upper || '—'}, lower ${sc.denture_lower || '—'}${sc.denture_fit ? ', ' + sc.denture_fit : ''}</dd>
        ${sc.gohai_total != null && html`<dt>GOHAI (12 – 60 best)</dt><dd>${sc.gohai_total}</dd>`}
        <dt>Medicines</dt><dd>${sc.medicines.join(', ') || '—'}</dd>
      </dl>
      ${kb.length > 0 && html`<h2>Education material</h2><ul class="small">${kb.map(k => html`<li>${k.title} — ${k.url}</li>`)}</ul>`}
      <h2>Reviewing dentist</h2>
      <p>${dentist?.name || '—'}, ${dentist?.reg_council || ''} registration no. ${dentist?.reg_number || '—'} — volunteer dentist, Association of Geriatric Dentistry</p>
      <h2>For the treating clinic</h2>
      <div class="box" style="min-height:70px">Treatment given / remarks:</div>
      <footer class="report-foot">
        This opinion is based on a home screening by a trained health worker and intraoral photographs; it is not a full clinical examination. Responsibility for the programme rests with
        Community Innovation Foundation and AGeD. Machine translations are shown for convenience; the original text is authoritative. Check this report is genuine at ${verifyUrl}.
        Generated ${generated_at} UTC.
      </footer>
    </article>`;
}
