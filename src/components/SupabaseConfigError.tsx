/**
 * Shown instead of the app when the Supabase environment variables are
 * missing or malformed. Deliberately dependency-free (no UI kit, no router,
 * no data fetching) so it still renders when the rest of the app cannot.
 */
export function SupabaseConfigError({ problems }: { problems: string[] }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-red-700">Supabase ist nicht korrekt konfiguriert</h1>
        <p className="mt-2 text-sm text-slate-600">
          Die Anwendung wurde nicht gestartet, weil sie sonst bei jeder Anfrage mit einem unklaren
          Netzwerkfehler scheitern würde. Folgende Werte sind zu korrigieren:
        </p>

        <ul className="mt-4 space-y-2">
          {problems.map((problem) => (
            <li
              key={problem}
              className="rounded border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {problem}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm text-slate-600">
          Lokal gehören die Werte in <code className="rounded bg-slate-100 px-1">.env.local</code>, im
          Deployment in die Environment Variables des Hosters. Nach einer Änderung im Deployment ist ein
          neuer Build nötig, weil die Werte zur Build-Zeit in das Bundle eingesetzt werden. Vorlage:{" "}
          <code className="rounded bg-slate-100 px-1">.env.example</code>.
        </p>
      </div>
    </div>
  );
}
