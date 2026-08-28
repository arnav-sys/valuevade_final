-- Migration 0040: Allow pdf_document card type in master_notes_cards
-- Run this ONCE in Supabase Studio (SQL editor) before using the
-- PDF/PPT upload feature in the admin Notes editor.

-- Drop existing card_type check constraint (it previously only allowed
-- hook/concept/deep-dive/example/formula/mistake/summary/visual/study-card).
ALTER TABLE master_notes_cards
    DROP CONSTRAINT IF EXISTS master_notes_cards_card_type_check;

-- Re-add with pdf_document included.
ALTER TABLE master_notes_cards
    ADD CONSTRAINT master_notes_cards_card_type_check
    CHECK (card_type IN (
        'hook', 'concept', 'deep-dive', 'example', 'formula',
        'mistake', 'summary', 'visual', 'study-card', 'pdf_document'
    ));

-- Also create the session-notes storage bucket (public, so PDFs are viewable inline).
-- If you prefer to create it manually in Storage → New bucket, skip this block.
-- SELECT storage.create_bucket('session-notes', '{"public": true}');
