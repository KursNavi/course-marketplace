import { createClient } from '@supabase/supabase-js'
import process from 'node:process'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Fehlende ENV Variablen: SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const [oldEmailRaw, newEmailRaw] = process.argv.slice(2)

if (!oldEmailRaw || !newEmailRaw) {
  console.log(`
Verwendung:
node scripts/release-pilot-user.mjs "alte@email.ch" "neue@email.ch"
`)
  process.exit(1)
}

const oldEmail = oldEmailRaw.trim().toLowerCase()
const newEmail = newEmailRaw.trim().toLowerCase()
const redirectTo = 'https://kursnavi.ch/set-password'

if (oldEmail === newEmail) {
  console.error('Alte und neue E-Mail sind identisch.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function main() {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', oldEmail)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile) throw new Error(`Kein Profil gefunden für ${oldEmail}`)

  const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, {
    email: newEmail,
    email_confirm: true,
  })

  if (authError) throw new Error(`Auth Update fehlgeschlagen: ${authError.message}`)

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({ email: newEmail })
    .eq('id', profile.id)

  if (profileUpdateError) {
    throw new Error(`profiles Update fehlgeschlagen: ${profileUpdateError.message}`)
  }

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(newEmail, {
    redirectTo,
  })

  if (resetError) throw new Error(`Reset Mail fehlgeschlagen: ${resetError.message}`)

  console.log('Erfolgreich freigeschaltet:')
  console.log({
    id: profile.id,
    full_name: profile.full_name,
    old_email: oldEmail,
    new_email: newEmail,
    reset_sent_to: newEmail,
    redirect_to: redirectTo,
  })
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})