(() => {
  'use strict';

  const root = document.getElementById('finance-management');
  const table = 'rock_finance_transactions';
  const title = 'FINANCE MANAGEMENT SYSTEM';
  const categories = {
    income: ['Monthly Levy', 'Tournament Registration Fee', 'Sponsorship', 'Donation', 'Other Income'],
    expense: ['Tournament Winner Prize', 'MVP Prize', 'Website Expense', 'Other Expense']
  };
  const fields = 'id,direction,category,amount,tournament,winner_id,description,status,payment_method,entry_date,payment_date,approved,revision';
  const money = amount => new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR' }).format(amount);
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date());
  let owner = false;
  let settings;
  let report = [];
  let selectedTournament = '';
  let generation = 0;

  function element(tag, text = '', classes = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (classes) node.className = classes;
    return node;
  }
  function button(text, run) {
    const control = element('button', text);
    control.type = 'button';
    control.onclick = run;
    return control;
  }
  function field(text, control) {
    const label = element('label', text);
    label.append(control);
    return label;
  }
  function select(options, value = '') {
    const control = element('select');
    options.forEach(([key, text]) => control.add(new Option(text, key)));
    control.value = value;
    return control;
  }
  function input(type, value = '', required = false) {
    const control = element('input');
    control.type = type;
    control.value = value;
    control.required = required;
    return control;
  }
  async function query(operation) {
    const { data, error } = await operation;
    if (error) throw new Error(error.message);
    return data;
  }
  async function getAll(makeQuery) {
    const rows = [];
    const page = 250;
    for (let from = 0; ; from += page) {
      const batch = await query(makeQuery().range(from, from + page - 1));
      rows.push(...batch);
      if (batch.length < page) return rows;
    }
  }

  function showDialog(heading, content) {
    const dialog = element('dialog', '', 'rock-winners rock-winner-dialog rock-finance-dialog');
    dialog.append(element('h3', heading), content, button('Close', () => dialog.close()));
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
    return dialog;
  }

  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = element('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function spreadsheet() {
    const xml = value => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const rows = [reportHeadings, ...report.map(reportValues)].map(row =>
      '<Row>' + row.map(value => '<Cell><Data ss:Type="' + (typeof value === 'number' ? 'Number' : 'String') +
        '">' + xml(value) + '</Data></Cell>').join('') + '</Row>').join('');
    download('<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Worksheet ss:Name="Transactions"><Table>' + rows + '</Table></Worksheet></Workbook>', 'rock-finance.xml', 'application/xml');
  }

  const reportHeadings = ['Date', 'Direction', 'Category', 'Amount (NPR)', 'Tournament', 'Payment', 'Paid on', 'Method', 'Approval', 'Description'];
  function reportValues(row) {
    return [row.entry_date, row.direction, row.category, Number(row.amount), row.tournament,
      row.status, row.payment_date, row.payment_method, row.approved ? 'Approved' : 'Unapproved', row.description];
  }
  function reportTable(rows, controls) {
    const grid = element('table');
    const header = grid.createTHead().insertRow();
    reportHeadings.forEach(label => header.append(element('th', label)));
    if (controls) header.append(element('th', 'Manage'));
    const body = grid.createTBody();
    for (const row of rows) {
      const line = body.insertRow();
      reportValues(row).forEach(value => line.append(element('td', String(value ?? ''))));
      if (controls) line.append(controls(row));
    }
    return grid;
  }

  function showReport() {
    const content = element('div');
    const printable = element('div', '', 'rock-finance-print');
    printable.append(element('h2', title), element('p', selectedTournament || 'All tournaments'), reportTable(report));
    content.append(button('Print / Save PDF', () => window.print()), printable);
    showDialog('Finance report', content);
  }

  function render(rows) {
    report = rows.filter(row => !selectedTournament || row.tournament === selectedTournament);
    const totals = { income: 0, expense: 0, pending: 0 };
    const months = new Map();
    for (const row of report) {
      const amount = Number(row.amount);
      const effective = !settings.require_owner_approval || row.approved;
      if (row.direction === 'expense' && (row.status === 'pending' || !effective)) totals.pending += amount;
      if (row.status !== 'paid' || !effective) continue;
      totals[row.direction] += amount;
      const key = row.payment_date.slice(0, 7);
      const month = months.get(key) || { income: 0, expense: 0 };
      month[row.direction] += amount;
      months.set(key, month);
    }
    const summary = element('div', '', 'rock-finance-totals');
    for (const [label, amount] of [['Total Income', totals.income], ['Total Expense', totals.expense],
      ['Available Balance', totals.income - totals.expense], ['Pending Payment', totals.pending]]) {
      const item = element('div');
      item.append(element('h3', label), element('strong', money(amount)));
      summary.append(item);
    }

    const graph = element('div', '', 'rock-finance-chart');
    graph.append(element('h3', 'Monthly income and expense'));
    const newest = [...months].sort(([a], [b]) => b.localeCompare(a)).slice(0, 12).reverse();
    const max = Math.max(1, ...newest.flatMap(([, month]) => [month.income, month.expense]));
    for (const [date, month] of newest) {
      const row = element('div');
      row.append(element('strong', date));
      for (const kind of ['income', 'expense']) {
        const bar = element('meter');
        bar.max = max;
        bar.value = month[kind];
        row.append(field(kind + ' · ' + money(month[kind]), bar));
      }
      graph.append(row);
    }
    if (!newest.length) graph.append(element('p', 'No settled transactions yet.'));

    const toolbar = element('div', '', 'rock-winner-actions');
    const tournaments = [...new Set(rows.map(row => row.tournament).filter(Boolean))].sort();
    const filter = select([['', 'All tournaments'], ...tournaments.map(name => [name, name])], selectedTournament);
    filter.onchange = () => { selectedTournament = filter.value; render(rows); };
    toolbar.append(button('New transaction', () => editEntry()), field('Tournament report', filter),
      button('Excel report', spreadsheet), button('PDF report', showReport));
    if (owner) {
      const approval = input('checkbox');
      approval.checked = settings.require_owner_approval;
      approval.onchange = async () => {
        approval.disabled = true;
        try {
          await query(sb.from('rock_finance_settings').update({ require_owner_approval: approval.checked }).eq('id', true));
          await load();
        } catch (error) {
          approval.checked = !approval.checked;
          status.textContent = error.message;
        } finally { approval.disabled = false; }
      };
      toolbar.append(field('Require owner approval', approval));
    }
    const tableWrap = element('div', '', 'rock-finance-table');
    if (!report.length) tableWrap.append(element('p', 'No transactions yet.'));
    tableWrap.append(reportTable(report, row => {
      const cell = element('td');
      cell.append(button('Edit', () => editEntry(row)), button('History', () => history(row)));
      return cell;
    }));
    dashboard.replaceChildren(toolbar, summary, graph, element('h3', 'Transaction history'), tableWrap);
  }

  function history(row) {
    const content = element('div', 'Loading…');
    showDialog('Transaction history', content);
    void getAll(() => sb.from('rock_finance_history').select('changed_at,changed_by,previous,current_record')
      .eq('transaction_id', row.id).order('id', { ascending: false })).then(entries => {
      content.replaceChildren();
      for (const event of entries) {
        const item = element('details');
        item.append(element('summary', new Date(event.changed_at).toLocaleString() + ' · ' + event.changed_by));
        const before = event.previous || {};
        const after = event.current_record;
        for (const [key, value] of Object.entries(after)) {
          if (['id', 'revision'].includes(key) || value === before[key]) continue;
          item.append(element('p', key.replaceAll('_', ' ') + ' · ' + (key === 'receipt'
            ? (value ? 'Updated proof' : 'Removed proof') : String(before[key] ?? '—') + ' → ' + String(value ?? '—'))));
        }
        content.append(item);
      }
    }).catch(error => { content.textContent = error.message; });
  }

  async function editEntry(record) {
    const form = element('form');
    const message = element('p');
    message.setAttribute('role', 'status');
    const direction = select([['income', 'Income'], ['expense', 'Expense']], record?.direction || 'income');
    const category = select([]);
    const tournament = input('text', record?.tournament || '');
    tournament.maxLength = 120;
    const winner = select([['', 'No linked winner post']]);
    winner.disabled = true;
    const amount = input('number', record?.amount || '', true);
    amount.step = '.01';
    amount.min = '.01';
    amount.max = '999999999999.99';
    const entryDate = input('date', record?.entry_date || today(), true);
    const payment = select([['pending', 'Pending'], ['paid', 'Paid']], record?.status || 'pending');
    const method = select(['QR', 'Bank Transfer', 'eSewa', 'Cash', 'Other'].map(value => [value, value]), record?.payment_method || 'QR');
    const paymentDate = input('date', record?.payment_date || '');
    const paymentDateLabel = field('Payment date', paymentDate);
    const description = input('text', record?.description || '');
    description.maxLength = 300;
    const receipt = input('file');
    receipt.accept = 'image/jpeg,image/png,image/webp,application/pdf';
    const approved = input('checkbox');
    approved.checked = Boolean(record?.approved);
    let saving = false;

    const winnerLabel = field('Winner post', winner);
    function adjustCategory() {
      winnerLabel.hidden = !['Tournament Winner Prize', 'MVP Prize'].includes(category.value);
    }
    function setCategories(value) {
      category.replaceChildren(...categories[direction.value].map(name => new Option(name, name)));
      category.value = value || categories[direction.value][0];
      adjustCategory();
    }
    direction.onchange = () => setCategories();
    category.onchange = adjustCategory;
    winner.onchange = () => { if (winner.value) tournament.value = winner.selectedOptions[0].dataset.title; };
    function adjustPayment() {
      paymentDateLabel.hidden = payment.value !== 'paid';
      paymentDate.required = payment.value === 'paid';
      if (paymentDate.required && !paymentDate.value) paymentDate.value = today();
    }
    payment.onchange = adjustPayment;
    adjustPayment();
    setCategories(record?.category);
    const submit = element('button', 'Save transaction');
    form.append(field('Type', direction), field('Category', category), winnerLabel, field('Tournament', tournament),
      field('Amount (NPR)', amount), field('Entry date', entryDate), field('Payment status', payment),
      paymentDateLabel, field('Method', method), field('Description', description), field('Receipt or proof', receipt));
    if (record) form.append(button('Download saved proof', async () => {
      try {
        const data = await query(sb.from(table).select('receipt').eq('id', record.id).single());
        if (!data.receipt) { message.textContent = 'No proof saved.'; return; }
        const file = await (await fetch(data.receipt)).blob();
        const url = URL.createObjectURL(file);
        const link = element('a');
        link.href = url;
        link.download = 'payment-proof.' + (file.type.split('/')[1] || 'bin');
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch (error) { message.textContent = error.message; }
    }));
    if (owner) form.append(field('Owner approved', approved));
    form.append(submit, message);
    const dialog = showDialog(record ? 'Edit transaction' : 'New transaction', form);
    form.onsubmit = async event => {
      event.preventDefault();
      if (saving) return;
      saving = true;
      submit.disabled = true;
      try {
        const values = {
          direction: direction.value, category: category.value, tournament: tournament.value.trim(),
          winner_id: winnerLabel.hidden ? null : (winner.disabled ? record?.winner_id : winner.value) || null,
          amount: amount.value, entry_date: entryDate.value, payment_method: method.value,
          payment_date: payment.value === 'paid' ? paymentDate.value : null,
          status: payment.value, description: description.value.trim()
        };
        if (owner) values.approved = approved.checked;
        if (receipt.files.length) {
          const file = receipt.files[0];
          if (file.size > 2000000 || !/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) {
            throw new Error('Use JPEG, PNG, WebP or PDF proof up to 2 MB.');
          }
          values.receipt = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
        }
        const operation = record ? sb.from(table).update(values).eq('id', record.id).eq('revision', record.revision)
          : sb.from(table).insert({ ...values, id: crypto.randomUUID() });
        if (!await query(operation.select('id').maybeSingle())) throw new Error('Entry changed. Reopen it before saving.');
        dialog.close();
        await load();
      } catch (error) { message.textContent = error.message; }
      finally { saving = false; submit.disabled = false; }
    };
    try {
      const posts = await getAll(() => sb.from('rock_winner_posts').select('id,tournament_name,tournament_date,stage,mode')
        .order('tournament_date', { ascending: false }).order('id'));
      for (const post of posts) {
        const option = new Option(post.tournament_name + ' · ' + post.mode.toUpperCase() + ' · ' + post.stage.toUpperCase() + ' · ' + post.tournament_date, post.id);
        option.dataset.title = post.tournament_name;
        winner.add(option);
      }
      if (record?.winner_id && !posts.some(post => post.id === record.winner_id)) {
        const option = new Option('Archived winner post', record.winner_id);
        option.dataset.title = record.tournament;
        winner.add(option);
      }
      if (record?.winner_id) winner.value = record.winner_id;
    } catch (error) {
      if (record?.winner_id) {
        const option = new Option('Previously linked winner post', record.winner_id);
        option.dataset.title = record.tournament;
        winner.add(option);
        winner.value = record.winner_id;
      }
      message.textContent = error.message;
    } finally { winner.disabled = false; }
  }

  const status = element('p');
  status.setAttribute('role', 'status');
  const dashboard = element('div');
  root.append(status, dashboard);
  async function load() {
    const version = ++generation;
    dashboard.replaceChildren();
    status.textContent = 'Loading…';
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session || !await query(sb.rpc('rock_winners_can_edit'))) {
        if (version === generation) status.textContent = 'Sign in with an Owner or Finance Manager account.';
        return;
      }
      const [isOwner, savedSettings, rows] = await Promise.all([
        query(sb.rpc('rock_finance_is_owner')),
        query(sb.from('rock_finance_settings').select('require_owner_approval').eq('id', true).single()),
        getAll(() => sb.from(table).select(fields).order('entry_date', { ascending: false }).order('id'))
      ]);
      if (version !== generation) return;
      owner = isOwner;
      settings = savedSettings;
      status.textContent = '';
      render(rows);
    } catch (error) {
      if (version === generation) status.textContent = error.message;
    }
  }
  function openFinance() {
    root.hidden = location.hash !== '#finance-management';
    if (!root.hidden) {
      root.scrollIntoView();
      void load();
    } else {
      generation++;
      dashboard.replaceChildren();
    }
  }
  window.addEventListener('hashchange', openFinance);
  let accountKey;
  sb.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    const key = JSON.stringify([user?.id, user?.app_metadata?.rock_winners_role]);
    if (key === accountKey) return;
    if (accountKey !== undefined) {
      document.querySelectorAll('.rock-finance-dialog[open]').forEach(dialog => dialog.close());
    }
    accountKey = key;
    dashboard.replaceChildren();
    setTimeout(openFinance, 0);
  });
  openFinance();
})();
