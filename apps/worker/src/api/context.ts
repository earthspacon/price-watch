import type { Deps } from "../deps";
import type { AccountContext } from "../repo/accounts";

export type ApiContext = {
  deps: Deps;
  account: AccountContext;
};

export type PublicContext = {
  deps: Deps;
};
