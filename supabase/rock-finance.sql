begin;

create function public.rock_finance_is_owner() returns boolean
language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'email', '') = 'rockesprorts.official@gmail.com';
$$;
revoke all on function public.rock_finance_is_owner() from public;
grant execute on function public.rock_finance_is_owner() to authenticated;

create table public.rock_finance_settings (
  id boolean primary key default true check (id),
  require_owner_approval boolean not null default false
);
insert into public.rock_finance_settings default values;
create table public.rock_finance_transactions (
  id uuid primary key,
  direction text not null check (direction in ('income', 'expense')),
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  tournament text not null default '' check (char_length(tournament) <= 120),
  winner_id uuid references public.rock_winner_posts(id),
  description text not null default '' check (char_length(description) <= 300),
  status text not null check (status in ('pending', 'paid')),
  payment_method text not null check (payment_method in ('QR', 'Bank Transfer', 'eSewa', 'Cash', 'Other')),
  entry_date date not null,
  payment_date date,
  receipt text check (receipt is null or (
    length(receipt) <= 2800000 and receipt ~ '^data:(image/(jpeg|png|webp)|application/pdf);base64,[A-Za-z0-9+/]+={0,2}$'
  )),
  approved boolean not null default false,
  revision integer not null default 1,
  check ((status = 'paid') = (payment_date is not null)),
  check ((direction = 'income' and category in ('Monthly Levy', 'Tournament Registration Fee', 'Sponsorship', 'Donation', 'Other Income'))
    or (direction = 'expense' and category in ('Tournament Winner Prize', 'MVP Prize', 'Website Expense', 'Other Expense'))),
  check (winner_id is null or category in ('Tournament Winner Prize', 'MVP Prize'))
);
create index finance_transactions_date on public.rock_finance_transactions(entry_date desc, id);
create table public.rock_finance_history (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.rock_finance_transactions(id),
  changed_at timestamptz not null default now(),
  changed_by uuid not null,
  previous jsonb,
  current_record jsonb not null
);
create index finance_history_transaction on public.rock_finance_history(transaction_id, id desc);

alter table public.rock_finance_settings enable row level security;
alter table public.rock_finance_transactions enable row level security;
alter table public.rock_finance_history enable row level security;
revoke all on public.rock_finance_settings, public.rock_finance_transactions, public.rock_finance_history from public, anon, authenticated;
grant select on public.rock_finance_settings, public.rock_finance_transactions, public.rock_finance_history to authenticated;
grant update (require_owner_approval) on public.rock_finance_settings to authenticated;
grant insert, update on public.rock_finance_transactions to authenticated;
create policy finance_settings_read on public.rock_finance_settings for select to authenticated
  using ((select public.rock_winners_can_edit()));
create policy finance_settings_owner on public.rock_finance_settings for update to authenticated
  using ((select public.rock_finance_is_owner())) with check ((select public.rock_finance_is_owner()));
create policy finance_transactions_editor on public.rock_finance_transactions for all to authenticated
  using ((select public.rock_winners_can_edit())) with check ((select public.rock_winners_can_edit()));
create policy finance_history_editor on public.rock_finance_history for select to authenticated
  using ((select public.rock_winners_can_edit()));

create function rock_winners_private.prepare_finance_entry() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.revision := old.revision + 1;
    if not public.rock_finance_is_owner() then
      new.approved := case when (to_jsonb(new) - 'approved' - 'revision') is distinct from
        (to_jsonb(old) - 'approved' - 'revision') then false else old.approved end;
    end if;
  else
    new.revision := 1;
    if not public.rock_finance_is_owner() then new.approved := false; end if;
  end if;
  return new;
end;
$$;
revoke all on function rock_winners_private.prepare_finance_entry() from public;
create trigger finance_entry_prepare before insert or update on public.rock_finance_transactions
  for each row execute function rock_winners_private.prepare_finance_entry();

create function rock_winners_private.audit_finance_entry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.rock_winners_can_edit() then
    raise exception 'Finance access required' using errcode = '42501';
  end if;
  insert into public.rock_finance_history(transaction_id, changed_by, previous, current_record)
  values (new.id, auth.uid(), case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return null;
end;
$$;
revoke all on function rock_winners_private.audit_finance_entry() from public;
create trigger finance_entry_audit after insert or update on public.rock_finance_transactions
  for each row execute function rock_winners_private.audit_finance_entry();

commit;
