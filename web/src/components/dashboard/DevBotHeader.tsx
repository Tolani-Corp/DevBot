import { CommandLineIcon } from "@heroicons/react/24/outline";

const statusClass = {
  connected: "border-green-500/30 bg-green-500/10 text-green-400",
  connecting: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  disconnected: "border-red-500/30 bg-red-500/10 text-red-400",
};

const dotClass = {
  connected: "bg-green-400 animate-pulse",
  connecting: "bg-amber-300 animate-pulse",
  disconnected: "bg-red-400",
};

const DevBotHeader = ({
  status,
}: {
  status: "connected" | "disconnected" | "connecting" | string;
}) => {
  const normalized =
    status === "connected" || status === "connecting" ? status : "disconnected";

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <CommandLineIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
            DevBot Workstation
          </h1>
          <p className="text-xs text-slate-500">
            Request to reviewed PR evidence console
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${statusClass[normalized]}`}
        >
          <div className={`h-2 w-2 rounded-full ${dotClass[normalized]}`} />
          {normalized.toUpperCase()}
        </div>
      </div>
    </header>
  );
};

export default DevBotHeader;
