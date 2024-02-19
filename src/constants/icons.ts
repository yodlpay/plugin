import { Connector } from "wagmi";
import { StrippedConnector } from "../components/ConnectorButton";

export const ICONS: { [key: string]: string } = {
  metamask: "/assets/images/wallets/metamask.svg",
  walletconnect: "/assets/images/wallets/walletconnect.svg",
  coinbasewallet: "/assets/images/wallets/coinbasewallet.svg",
  rainbow: "/assets/images/wallets/rainbow.svg",
};

export function connectorWalletIcon(
  connector: Connector | StrippedConnector
): string | undefined {
  return ICONS[connector.id.toLocaleLowerCase()];
}

export function walletIcon(id: string): string | undefined {
  return ICONS[id];
}
