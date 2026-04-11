-- Allow 'search' as a valid intake source (text-only name lookup via web search)
alter table intake_drafts
  drop constraint intake_drafts_source_check;

alter table intake_drafts
  add constraint intake_drafts_source_check
  check (source in ('photo', 'barcode', 'hybrid', 'search'));
