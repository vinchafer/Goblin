import { createClient } from '@supabase/supabase-js';

const MASTER_KEY = process.env.GOBLIN_MASTER_KEY!;

export async function encryptKey(plaintext: string): Promise<Buffer> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase.rpc('pgp_sym_encrypt', {
    data: plaintext,
    key: MASTER_KEY,
    cipher_algo: 'aes-256-cbc'
  });

  return Buffer.from(data, 'base64');
}

export async function decryptKey(encrypted: Buffer): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase.rpc('pgp_sym_decrypt', {
    data: encrypted.toString('base64'),
    key: MASTER_KEY,
    cipher_algo: 'aes-256-cbc'
  });

  return data;
}