import { useUnit } from "effector-react";

import { $me } from "../session/model";
import { Banner, PageHeader } from "../shared/ui";

// The paste box and the links table arrive with the links feature.
export const LinksPage = () => {
  const { me } = useUnit({ me: $me });

  return (
    <>
      <PageHeader title="Your links" />
      {me?.plan === null && <Banner tone="info">Pick a plan to start tracking competitor prices.</Banner>}
    </>
  );
};
