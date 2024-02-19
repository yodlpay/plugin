import {
  Flex,
  RudderStackJSPageCategories,
  RudderStackJSPageNames,
} from "@hiropay/common";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect } from "react";
import { useConnect } from "wagmi";
import { ConnectorButton } from "../components/ConnectorButton";
import { useMainStore } from "../contexts/useMainStore";

export default function WalletDialog() {
  const { connectors } = useConnect();

  const pageCallback = useMainStore((state) => state.pageCallback);

  const { openConnectModal } = useConnectModal();

  useEffect(() => {
    pageCallback?.(
      RudderStackJSPageCategories.Payment,
      RudderStackJSPageNames.WalletDialog,
      { connectors: connectors.map((connector) => connector.name) }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Flex grow={1} direction="column" gap="24px">
      <ConnectorButton
        connector={{
          id: "rainbow",
          name: "Rainbow Kit",
        }}
        handleClick={() => openConnectModal?.()}
      />
    </Flex>
  );
}
