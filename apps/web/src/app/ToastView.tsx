import { useUnit } from "effector-react";
import { CheckCircle2, XCircle } from "lucide-react";

import { $toast } from "../shared/toast-model";

export const ToastView = () => {
  const { toast } = useUnit({ toast: $toast });

  if (!toast) {
    return null;
  }
  const Icon = toast.tone === "success" ? CheckCircle2 : XCircle;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-sm items-center gap-2 rounded-lg border border-slate-300 bg-slate-200 px-4 py-3 text-sm text-slate-900 shadow-lg lg:bottom-6"
    >
      <Icon className={`size-4 shrink-0 ${toast.tone === "success" ? "text-emerald-700" : "text-rose-800"}`} />
      {toast.text}
    </div>
  );
};
