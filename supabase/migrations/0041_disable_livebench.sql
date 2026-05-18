-- 9R Session 10: Disable LiveBench adapter.
-- LiveBench does not provide an official structured data export.
-- GitHub issue livebench/livebench#82 (open since Nov 2024) confirms no plan to publish.
-- Scraping livebench.ai is not permissible under their ToS.
-- We re-enable when an official API becomes available.

update public.model_sources
set
  enabled = false,
  last_status = 'disabled',
  last_error = 'No official data export available — tracked in GitHub issue livebench/livebench#82 (open since Nov 2024). Will re-enable when API exists.',
  last_fetched_at = now()
where id = 'livebench';
