(() => {
  'use strict';

  const tabs = document.querySelector('#adminOverlay .tabs');
  if (!tabs || document.getElementById('rockMailAdminTab')) return;
  function element(tag, value = '') {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
  }
  function label(text, control) {
    const node = element('label', text);
    node.append(control);
    return node;
  }

  const tab = element('button', 'MAIL');
  tab.type = 'button';
  tab.id = 'rockMailAdminTab';
  tab.className = 'tab';
  const panel = element('div');
  panel.id = 'rockMailAdminPanel';
  panel.className = 'edit-section rock-winners';
  const form = element('form');
  const subject = element('input');
  subject.type = 'text';
  subject.required = true;
  subject.maxLength = 150;
  const message = element('textarea');
  message.required = true;
  message.maxLength = 5000;
  message.rows = 7;
  const send = element('button', 'Send');
  send.disabled = true;
  const resume = element('button', 'Resume sending');
  resume.type = 'button';
  resume.hidden = true;
  const counts = element('p');
  const status = element('p');
  status.setAttribute('role', 'status');
  const help = element('p', 'Recipients are taken from current registrations when you click Send. Each address receives its own copy.');
  form.append(label('Subject', subject), label('Message', message), send, resume);
  panel.append(element('h3', 'MAIL'), counts, help, form, status);
  tabs.append(tab);
  tabs.after(panel);

  let config;
  let pending;
  let busy = false;
  const storageKey = 'rock-registration-mail-pending';
  function store(value) {
    try {
      if (value) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    } catch {}
  }
  function savedId() {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }

  async function request(body) {
    const session = await getAdminSession();
    if (!session) throw new Error('Owner sign-in required.');
    const response = await fetch(SUPABASE_URL + '/functions/v1/rock-registration-mail', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + session.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(18000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not contact the mail service.');
    return data;
  }

  function controls() {
    const blocked = !config?.configured || busy;
    send.disabled = blocked || Boolean(pending) || !config?.total;
    subject.disabled = Boolean(pending) || busy;
    message.disabled = Boolean(pending) || busy;
    resume.hidden = !pending;
    resume.disabled = blocked;
  }

  async function load() {
    if (busy) return;
    try {
      config = await request({ action: 'status' });
      pending = config.pending;
      if (!pending && savedId()) pending = { id: savedId() };
      counts.textContent = config.total + ' registered email addresses';
      if (!config.configured) status.textContent = 'Connect rockesprorts.official@gmail.com before sending.';
      else if (pending) status.textContent = pending.total
        ? pending.sent + ' of ' + pending.total + ' accepted for ' + pending.subject + '.'
        : 'Check the status of the last send.';
      else status.textContent = '';
    } catch (error) {
      config = null;
      status.textContent = error.message;
    } finally { controls(); }
  }

  async function deliver(id, subjectText, messageText) {
    if (busy || !config?.configured) return;
    busy = true;
    store(id);
    controls();
    let completed = false;
    try {
      do {
        const progress = await request({ action: 'send', id, subject: subjectText, message: messageText });
        pending = { id, subject: subjectText || pending?.subject, ...progress };
        status.textContent = progress.sent + ' of ' + progress.total + ' emails accepted by Gmail.';
        if (progress.processed >= progress.total) {
          if (progress.sent < progress.total) {
            status.textContent = progress.sent + ' of ' + progress.total +
              ' emails accepted by Gmail. ' + (progress.total - progress.sent) + ' could not be confirmed.';
          }
          store(null);
          pending = null;
          form.reset();
          completed = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      } while (true);
    } catch (error) {
      const reason = error.message;
      try {
        const snapshot = await request({ action: 'status' });
        pending = snapshot.pending;
        if (!pending && !subjectText) {
          store(null);
          status.textContent = 'No unfinished send was found.';
          return;
        }
        if (!pending) store(null);
      } catch {
        pending = { id };
      }
      status.textContent = reason;
    } finally {
      busy = false;
      controls();
    }
    if (completed) counts.textContent = config.total + ' registered email addresses';
  }

  tab.onclick = () => {
    showTab(panel.id, tab);
    void load();
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (send.disabled || !subject.value.trim() || !message.value.trim()) return;
    if (!confirm('Send this email to the registered players?')) return;
    void deliver(crypto.randomUUID(), subject.value.trim(), message.value.trim());
  });
  resume.onclick = () => {
    if (pending) void deliver(pending.id);
  };
})();
