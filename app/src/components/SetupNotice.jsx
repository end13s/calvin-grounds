// Shown instead of the app when app/.env has no Supabase URL or anon key.
export function SetupNotice() {
  return (
    <div style={{ maxWidth: 560, margin: '15vh auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 22 }}>Calvin Grounds is not connected to Supabase yet</h1>
      <ol>
        <li>Create a Supabase project and run <code>supabase/schema.sql</code> in its SQL editor.</li>
        <li>Copy <code>app/.env.example</code> to <code>app/.env</code> and fill in the project URL and anon key.</li>
        <li>Restart <code>npm run dev</code>.</li>
      </ol>
    </div>
  )
}
