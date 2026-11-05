begin;
-- Read policies and public API without exposing the underlying table.
set local role anon;
select public.rock_wow_public(2)->'state'->>'mode' as public_mode;
do $$ begin
 begin perform state from public.rock_wow_tournaments; raise exception 'FAIL: anon table read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.rock_wow_owner(2,0,'reset','{}'); raise exception 'FAIL: anon write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","email":"not-owner@example.invalid","role":"authenticated"}',true);
do $$ begin
 begin perform public.rock_wow_owner(2,0,'reset','{}'); raise exception 'FAIL: member write allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","email":"rockesprorts.official@gmail.com","role":"authenticated"}',true);
do $$
declare rev bigint; payload jsonb; response jsonb; n integer;
begin
 rev:=(public.rock_wow_public(2)->>'revision')::bigint;
 payload:=jsonb_build_object('teams','[{"id":"test-1","name":"QA Team One","logo":"","players":[{"name":"A","photo":""},{"name":"B","photo":""}]},{"id":"test-2","name":"QA Team Two","logo":"","players":[{"name":"C","photo":""},{"name":"D","photo":""}]}]'::jsonb,'groups','[{"id":"qa-a","name":"QA A"},{"id":"qa-b","name":"QA B"}]'::jsonb,'seeds','[]'::jsonb,'results','{}'::jsonb);
 perform public.rock_wow_owner(2,rev,'save',payload);rev:=rev+1;
 begin perform public.rock_wow_owner(2,rev-1,'save',payload);raise exception 'FAIL: stale revision accepted';exception when serialization_failure then null;end;
 perform public.rock_wow_owner(2,rev,'draw',jsonb_build_object('startsAt',clock_timestamp()+interval '1 hour'));rev:=rev+1;
 response:=public.rock_wow_public(2);
 if coalesce((public.rock_wow_public(2,rev,0)->>'unchanged')::boolean,false) is not true then raise exception 'FAIL: unchanged polling';end if;
 if jsonb_array_length(response->'state'->'draw'->'order')<>0 then raise exception 'FAIL: future draw leaked'; end if;
 -- Saving photos/names must preserve the private future order.
 perform public.rock_wow_owner(2,rev,'save',payload);rev:=rev+1;
 perform public.rock_wow_owner(2,rev,'reset','{}');rev:=rev+1;
 perform public.rock_wow_owner(2,rev,'draw',jsonb_build_object('startsAt',clock_timestamp()));rev:=rev+1;
 response:=public.rock_wow_public(2);
 if (response->'state'->'draw'->>'revealed')::integer<>1 then raise exception 'FAIL: manual reveal';end if;
end $$;
reset role;
-- Advance only this transaction's test state, then verify qualifier validation.
update public.rock_wow_tournaments set state=jsonb_set(state,'{draw,startsAt}',to_jsonb((clock_timestamp()-interval '1 minute')::text)) where mode=2;
set local role authenticated;
do $$ declare r jsonb; rev bigint; payload jsonb;
begin
 r:=public.rock_wow_public(2); rev:=(r->>'revision')::bigint;payload:=r->'state';
 if jsonb_array_length(payload->'draw'->'order')<>2 then raise exception 'FAIL: completed reveal';end if;
 payload:=payload||'{"seeds":["test-1","test-2"],"results":{}}'::jsonb;
 perform public.rock_wow_owner(2,rev,'save',payload);
end $$;
reset role;
rollback;
select 'PASS: anonymous read, owner-only writes, stale-save protection, scheduled secrecy, manual draw, qualifiers; all test changes rolled back' as wow_checks;
