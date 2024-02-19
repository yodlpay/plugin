import { Flex } from "@hiropay/common";
import { FlexProps } from "@hiropay/common/dist/components/Flex";

export type ContainerWrapperProps = {} & FlexProps;

export const ContainerWrapper = ({
  children,
  direction = "column",
  ...props
}: ContainerWrapperProps) => {
  return (
    <Flex className="container-wrapper" direction={direction} {...props}>
      {children}
    </Flex>
  );
};
