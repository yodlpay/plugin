// import { NavLink } from "@frontend/stories/NavLink";
// import { useNavLinkStyles } from "@frontend/styles/theme";
// import { ChevronRightIcon } from "@heroicons/react/20/solid";
// import { ConnectButton } from "@rainbow-me/rainbowkit";

// export const RainbowConnector = () => {
//   const { classes } = useNavLinkStyles();

//   return (
//     <ConnectButton.Custom>
//       {({
//         account,
//         chain,
//         openAccountModal,
//         openChainModal,
//         openConnectModal,
//         authenticationStatus,
//         mounted,
//       }) => {
//         // Note: If your app doesn't use authentication, you
//         // can remove all 'authenticationStatus' checks
//         const ready = mounted && authenticationStatus !== "loading";
//         const connected =
//           ready &&
//           account &&
//           chain &&
//           (!authenticationStatus || authenticationStatus === "authenticated");
//         return (
//           <div
//             {...(!ready && {
//               "aria-hidden": true,
//               style: {
//                 opacity: 0,
//                 pointerEvents: "none",
//                 userSelect: "none",
//               },
//             })}
//           >
//             {(() => (
//               <NavLink
//                 size="lg"
//                 label="Rainbow Kit"
//                 icon={
//                   <img
//                     src="/assets/images/wallets/rainbow.svg"
//                     alt="Rainbow Kit"
//                     width="32px"
//                   />
//                 }
//                 rightIcon={<ChevronRightIcon className={classes.icon} />}
//                 onClick={openConnectModal}
//               />
//             ))()}
//           </div>
//         );
//       }}
//     </ConnectButton.Custom>
//   );
// };
