import type { FailReason, LinkStatus } from "@price-watch/contract";

import { LINK_STATUS_CONFIG } from "./config";

export { formatCents, formatChange } from "@price-watch/contract";

export function getLinkStatusLabel({ status, failReason }: { status: LinkStatus; failReason: FailReason | null }) {
  return LINK_STATUS_CONFIG[status === "failed" && failReason ? failReason : status].label;
}
