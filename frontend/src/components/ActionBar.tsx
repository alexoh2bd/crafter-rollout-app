interface Props {
  actionName: string | null;
  step: number;
}

export default function ActionBar({ actionName, step }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg px-4 py-2 text-sm text-gray-300 font-mono">
      <span className="text-gray-500">Step </span>
      <span className="text-white font-semibold">{step}</span>
      {actionName && (
        <>
          <span className="text-gray-500 mx-2">—</span>
          <span className="text-indigo-300">{actionName}</span>
        </>
      )}
    </div>
  );
}
