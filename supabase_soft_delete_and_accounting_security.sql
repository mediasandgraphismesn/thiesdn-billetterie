-- ==============================================================================
-- THIÈSDN BILLETTERIE - MIGRATION OFFICIELLE
-- SÉCURITÉ COMPTABLE MULTI-ÉVÉNEMENTS & SOFT DELETE
--
-- 1. Bloquer tout DELETE SQL sur 'events' si des commandes existent dans 'orders'
-- 2. Colonnes de Soft Delete (is_deleted, deleted_at)
-- 3. Snapshotting permanent dans 'orders' (event_title, organizer_name)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- ÉTAPE 1 : Colonnes de Soft Delete sur 'events'
-- ------------------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index pour optimiser les requêtes du catalogue public (status = 'approved' AND deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_events_status_deleted ON public.events (status, is_deleted, deleted_at);
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON public.events (deleted_at);

-- ------------------------------------------------------------------------------
-- ÉTAPE 2 : Snapshotting comptable dans 'orders'
-- Conserve le titre de l'événement et le nom de l'organisateur en dur
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS event_title TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS organizer_name TEXT;

-- Rétro-remplissage (Backfill) des commandes existantes depuis la table 'events'
UPDATE public.orders o
SET 
  event_title = COALESCE(o.event_title, e.title, 'Événement Thièsdn'),
  organizer_name = COALESCE(o.organizer_name, e.promoter_name, 'Organisateur Thièsdn')
FROM public.events e
WHERE o.event_id = e.id 
  AND (o.event_title IS NULL OR o.organizer_name IS NULL);

-- Valeur par défaut de sécurité pour toute commande orpheline antérieure
UPDATE public.orders
SET 
  event_title = COALESCE(event_title, 'Événement Thièsdn'),
  organizer_name = COALESCE(organizer_name, 'Organisateur Thièsdn')
WHERE event_title IS NULL OR organizer_name IS NULL;

-- ------------------------------------------------------------------------------
-- ÉTAPE 3 : Verrouillage SQL Absolu contre la Suppression d'Événements avec Commandes
-- Remplacement de toute contrainte CASCADE par ON DELETE RESTRICT
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_event_id_fkey' 
    AND table_name = 'orders'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_event_id_fkey;
  END IF;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_event_id_fkey
  FOREIGN KEY (event_id)
  REFERENCES public.events(id)
  ON DELETE RESTRICT;

-- ------------------------------------------------------------------------------
-- ÉTAPE 4 : Trigger PostgreSQL - Bloquer tout DELETE SQL avec message explicite
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_event_has_orders_before_delete()
RETURNS TRIGGER AS $$
DECLARE
  order_count INTEGER;
BEGIN
  SELECT count(*) INTO order_count FROM public.orders WHERE event_id = OLD.id;
  
  IF order_count > 0 THEN
    RAISE EXCEPTION 'Action bloquée par la sécurité comptable ThièsDN : Impossible de supprimer définitivement l''événement "%" (ID: %) car il contient % commande(s) ou transaction(s) financière(s) active(s). Veuillez utiliser le Soft Delete (status = ''archived'', deleted_at = now()).',
      OLD.title, OLD.id, order_count;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_delete_event_with_orders ON public.events;
CREATE TRIGGER trg_prevent_delete_event_with_orders
BEFORE DELETE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.check_event_has_orders_before_delete();

-- ------------------------------------------------------------------------------
-- ÉTAPE 5 : Fonction RPC Supabase pour le Soft Delete d'un Événement
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_event(p_event_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_title TEXT;
  v_orders_count INTEGER;
BEGIN
  SELECT title INTO v_title FROM public.events WHERE id = p_event_id;
  
  IF v_title IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Événement introuvable.');
  END IF;

  SELECT count(*) INTO v_orders_count FROM public.orders WHERE event_id = p_event_id;

  UPDATE public.events
  SET 
    is_deleted = TRUE,
    deleted_at = timezone('utc'::text, now()),
    status = 'archived',
    sales_active = FALSE
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Événement archivé avec succès (Soft Delete). Traçabilité comptable préservée.',
    'orders_count', v_orders_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires de documentation
COMMENT ON COLUMN public.events.is_deleted IS 'Indicateur de suppression logique (soft delete) préservant l intégrité comptable des commandes';
COMMENT ON COLUMN public.events.deleted_at IS 'Horodatage UTC de la suppression logique';
COMMENT ON COLUMN public.orders.event_title IS 'Snapshot immuable du titre de l événement au moment de l achat';
COMMENT ON COLUMN public.orders.organizer_name IS 'Snapshot immuable du promoteur/organisateur au moment de l achat';
COMMENT ON CONSTRAINT orders_event_id_fkey ON public.orders IS 'Clé étrangère vers events avec ON DELETE RESTRICT protégeant les transactions financières';
