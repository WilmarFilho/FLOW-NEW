-- Primeiro, removemos as políticas se elas já existirem para evitar erro de "já existe"
DROP POLICY IF EXISTS "Public Access for Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Users can Insert Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Users can Update Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Users can Delete Avatars" ON storage.objects;

-- 1. Permitir visualização pública (apenas para o bucket avatars)
CREATE POLICY "Public Access for Avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 2. Permitir upload para usuários autenticados
CREATE POLICY "Auth Users can Insert Avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- 3. Permitir atualização (Update)
CREATE POLICY "Auth Users can Update Avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- 4. Permitir exclusão (Delete)
CREATE POLICY "Auth Users can Delete Avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');


INSERT INTO storage.buckets (id, name, public)

VALUES ('avatars', 'avatars', true)

ON CONFLICT (id) DO NOTHING;