export default function SummaryCard({ label, value }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
