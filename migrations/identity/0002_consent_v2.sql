-- Consent notice v2: who decided for a person without capacity, and whether a copy of the notice was offered.
ALTER TABLE consents ADD COLUMN decider_type TEXT;
ALTER TABLE consents ADD COLUMN copy_offered INTEGER;
