import { Modal, useCustomTheme } from "@hiropay/common";
import { ColorSchemeProvider, MantineProvider, Portal } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { SnackbarProvider } from "notistack";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useMainStore } from "../contexts/useMainStore";

export type YodlSDKPluginProps = {
  children: ReactNode;
  onClose: () => void;
};

export default function YodlSDKPlugin({
  children,
  onClose,
}: YodlSDKPluginProps) {
  const [transitionedOpen, setTransitionedOpen] = useState(false);

  const flowInitiated = useMainStore((state) => state.flowInitiated);
  const colorScheme = useMainStore((state) => state.colorScheme);
  const setColorScheme = useMainStore((state) => state.setColorScheme);

  const { preferredColorScheme, dynamicTheme } = useCustomTheme(colorScheme);

  const { connectModalOpen } = useConnectModal();
  const { isConnected } = useAccount();

  const toggleColorScheme = () => {
    const newColorScheme = colorScheme === "dark" ? "light" : "dark";
    setColorScheme(newColorScheme);
  };

  const handleClose = useCallback(
    (shouldTerminate = true) => {
      setTransitionedOpen(false);
      if (shouldTerminate) {
        onClose();
      }
    },
    [onClose]
  );

  const handleOpen = useCallback(() => {
    if (flowInitiated) {
      setTransitionedOpen(true);
    }
  }, [flowInitiated]);

  useEffect(() => {
    setColorScheme(preferredColorScheme);
  }, [preferredColorScheme, setColorScheme]);

  useEffect(() => {
    handleOpen();
  }, [flowInitiated, handleOpen]);

  useEffect(() => {
    if (connectModalOpen) {
      handleClose(false);
    } else {
      handleOpen();
    }
  }, [connectModalOpen, handleClose, handleOpen, isConnected]);

  return (
    <Portal>
      <ColorSchemeProvider
        colorScheme={colorScheme}
        toggleColorScheme={toggleColorScheme}
      >
        <MantineProvider theme={dynamicTheme}>
          <ModalsProvider>
            <SnackbarProvider autoHideDuration={3000} preventDuplicate>
              <Modal
                opened={transitionedOpen}
                withCloseButton={false}
                onClose={handleClose}
                centered
                transitionProps={{ transition: "slide-up" }}
                overlayProps={{ opacity: 0.3 }}
              >
                {children}
              </Modal>
            </SnackbarProvider>
          </ModalsProvider>
        </MantineProvider>
      </ColorSchemeProvider>
    </Portal>
  );
}
