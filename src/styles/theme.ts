import { DeepPartial, THEME_COLOR_SCHEME } from '@hiropay/common';
import {
  CSSObject,
  ColorScheme,
  DEFAULT_THEME,
  DefaultMantineColor,
  MantineThemeOverride,
  createStyles,
  getStylesRef,
  px,
  rem,
} from '@mantine/core';

type Color =
  | DeepPartial<
      Record<
        DefaultMantineColor,
        [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
        ]
      >
    >
  | undefined;

export const MOBILE_BREAKPOINT = 452;
export const TABLET_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1024;

export const CONTENT_PADDING = 32;
export const MOBILE_CONTENT_PADDING = 16;

export const CUSTOM_COLORS = {
  modayOverlay: 'rgba(16, 17, 19, 0.9)',
  positiveLight: 'rgba(43, 138, 62, 1)',
  positiveDark: 'rgba(211, 249, 216, 1)',
  positiveBase: 'rgba(43, 138, 62, 0.25)',
  positiveLightInactive: 'rgba(138, 43, 62, 1)',
  positiveDarkInactive: 'rgba(249, 211, 216, 1)',
  positiveBaseInactive: 'rgba(138, 43, 62, 0.25)',
};

export const CUSTOM_ACCESSIBILITY_SPACING = 4;

export const SIZE_OPTIONS = ['xs', 'sm', 'md', 'lg', 'xl'];
export const MINIMAL_SIZE_OPTIONS = ['sm', 'md', 'lg'];

export const LIGHT_MODE_COLORS: Color = {
  brand: [DEFAULT_THEME.colors.indigo[9]],
  base: ['#FFFFFF'],
  level: [
    DEFAULT_THEME.colors.gray[0],
    DEFAULT_THEME.colors.gray[1],
    DEFAULT_THEME.colors.gray[3],
  ],
  modalOverlay: [CUSTOM_COLORS.modayOverlay],
  positiveBase: [CUSTOM_COLORS.positiveBase],
  primary: [DEFAULT_THEME.colors.gray[9]],
  subtle: [DEFAULT_THEME.colors.gray[6]],
  onColor: ['#FFFFFF'],
  disabled: [DEFAULT_THEME.colors.gray[5]],
  error: [DEFAULT_THEME.colors.red[7]],
  positive: [CUSTOM_COLORS.positiveLight],
};

export const DARK_MODE_COLORS: Color = {
  brand: [DEFAULT_THEME.colors.indigo[9]],
  base: [DEFAULT_THEME.colors.dark[8]],
  level: [
    DEFAULT_THEME.colors.dark[7],
    DEFAULT_THEME.colors.dark[6],
    DEFAULT_THEME.colors.dark[4],
  ],
  modalOverlay: [CUSTOM_COLORS.modayOverlay],
  positiveBase: [CUSTOM_COLORS.positiveBase],
  primary: [DEFAULT_THEME.colors.gray[0]],
  subtle: [DEFAULT_THEME.colors.gray[6]],
  onColor: ['#FFFFFF'],
  disabled: [DEFAULT_THEME.colors.gray[7]],
  error: [DEFAULT_THEME.colors.red[6]],
  positive: [CUSTOM_COLORS.positiveDark],
};

export const MOBILE_HEADING_SIZES = {
  h1: { fontSize: rem(36) },
  h2: { fontSize: rem(32) },
  h3: { fontSize: rem(28) },
  h4: { fontSize: rem(24) },
  h5: { fontSize: rem(20) },
  h6: { fontSize: rem(18) },
};

export const COLOR_SCHEME = {
  light: LIGHT_MODE_COLORS,
  dark: DARK_MODE_COLORS,
} as Record<ColorScheme, Color>;

export const theme: MantineThemeOverride = {
  colorScheme: THEME_COLOR_SCHEME,
  colors: {
    ...DEFAULT_THEME.colors,
    ...DARK_MODE_COLORS,
  },
  defaultRadius: 'md',
  radius: {
    xl: rem(16),
    lg: rem(12),
    md: rem(8),
    sm: rem(4),
    xs: rem(2),
  },
  fontSizes: {
    xl: rem(18),
    lg: rem(16),
    md: rem(15),
    sm: rem(14),
    xs: rem(13),
  },
  headings: {
    sizes: {
      h1: { fontSize: rem(40) },
      h2: { fontSize: rem(36) },
      h3: { fontSize: rem(32) },
      h4: { fontSize: rem(28) },
      h5: { fontSize: rem(22) },
      h6: { fontSize: rem(20) },
    },
  },
  globalStyles: (theme) => ({
    '.container-wrapper': {
      flexGrow: 1,
      padding: `${rem(CONTENT_PADDING)} ${rem(CONTENT_PADDING)}`,
      [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
        padding: `${rem(CONTENT_PADDING)} ${rem(MOBILE_CONTENT_PADDING)}`,
      },
    },
    '.layout-wrapper': {
      padding: '0 16px',
      [theme.fn.smallerThan(MOBILE_BREAKPOINT)]: {
        padding: '0 8px',
      },
    },
    '.mantine-Tooltip-tooltip': {
      fontSize: '12px',
    },
    '.mantine-NavLink-icon': {
      alignSelf: 'auto',
    },
    '@keyframes fadeAndScaleIn': {
      from: {
        opacity: 0,
        transform: 'scale(0.9)',
      },
      to: {
        opacity: 1,
        transform: 'scale(1)',
      },
    },
    '@keyframes animatedGradient': {
      '0%': {
        backgroundPosition: '0% 50%',
      },
      '50%': {
        backgroundPosition: '100% 50%',
      },
      '100%': {
        backgroundPosition: '0% 50%',
      },
    },
    '@keyframes rotate': {
      from: {
        transform: 'translate(-50%, -50%) scale(1.4) rotate(0turn)',
      },
      to: {
        transform: 'translate(-50%, -50%) scale(1.4) rotate(1turn)',
      },
    },
  }),
};

export const useNavLinkStyles = createStyles((theme) => ({
  icon: {
    height: '32px',
    width: '32px',
    fill: theme.colors?.subtle?.[0],
  },
  disabledIcon: {
    height: '24px',
    width: '32px',
    fill: theme.colors?.subtle?.[0],
    transform: 'rotate(90deg)',
  },
}));

export const usePaymentStyles = createStyles((theme) => {
  const BORDER_WIDTH = 1;

  const sharedHoverStyles = {
    background: theme.colors?.level?.[1],
    '&::before': {
      animation: 'rotate 2s linear infinite',
    },
  };

  return {
    modalContainer: {
      display: 'flex',
      maxWidth: '450px',
      width: '100%',
      margin: '0 auto',
      background: theme.colors?.onColor?.[0],
      minHeight: '560px',
      // full-height rendering
      // height: "100%",
      borderRadius: theme.radius.md,
    },
    modalHeader: {
      background: theme.colors?.level?.[0],
      borderTopRightRadius: theme.radius.md,
      borderTopLeftRadius: theme.radius.md,
    },
    flex: {
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
      flexGrow: 1,
      width: '100%',
    },
    noGrow: {
      flexGrow: 0,
    },
    fullGrow: {
      flexGrow: 1,
    },
    divider: {
      borderBottom: `1px solid ${theme.colors?.level?.[2]}`,
      paddingBottom: `${rem(24)}`,
      marginBottom: `${rem(24)}`,
    },
    icon: {
      marginLeft: '4px',
      transition: 'transform 200ms ease',
      fill: theme.colors?.subtle?.[0],
    },
    iconActivated: {
      marginLeft: '4px',
      transform: 'rotate(180deg)',
      transition: 'transform 200ms ease',
      fill: theme.colors?.subtle?.[0],
    },
    collapseButton: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontWeight: 400,
      height: 'auto',
    },
    paymentContainer: {
      position: 'relative',
    },
    paymentWindow: {
      width: '100%',
      minHeight: '86px',
      background: theme.colors?.level?.[0],
      border: `1px solid ${theme.colors?.level?.[1]}`,
      borderRadius: theme.radius.md,
      padding: '12px',
    },
    paymentArrow: {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '24px',
      background: theme.colors?.level?.[1],
      border: `1px solid ${theme.colors?.base?.[0]}`,
      borderRadius: theme.radius.md,
      margin: 'auto',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    address: {
      marginTop: '8px',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
    },
    clickButton: {
      height: 'auto',
    },
    paymentArrowIcon: {
      stroke: theme.colors?.subtle?.[0],
      color: theme.colors?.subtle?.[0],
      strokeWidth: '8px',
    },
    copyExternalIcon: {
      stroke: theme.colors?.primary?.[0],
      strokeWidth: rem(2),
      marginLeft: rem(4),
      width: rem(16),
      minWidth: rem(16),
    },
    transactionIcon: {
      stroke: theme.colors?.subtle?.[0],
      strokeWidth: rem(2),
      width: rem(16),
      minWidth: rem(16),
    },
    autoswapButton: {
      cursor: 'auto',
      [`& .${getStylesRef('autoswapContainerRef')}`]: {
        borderRadius: theme.radius.md,
        background: theme.colors?.level?.[0],
        position: 'relative',
        borderWidth: `${BORDER_WIDTH}px`,
        overflow: 'hidden',

        '&::before': {
          borderRadius: theme.radius.md,
          content: '""',
          background: `linear-gradient(90deg, #E8590C, #0A50FF)`,
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          aspectRatio: '1',
          width: '100%',
        },

        '&::after': {
          content: '""',
          background: 'inherit',
          borderRadius: `${px(theme.radius.md) - BORDER_WIDTH}px`,
          position: 'absolute',
          inset: `${BORDER_WIDTH}px`,
          height: `calc(100% - 2 * ${BORDER_WIDTH}px)`,
          width: `calc(100% - 2 * ${BORDER_WIDTH}px)`,
          transition: 'all 0.1s ease',
        },
      },
      '&:not(:disabled)': {
        cursor: 'pointer',
        [`& .${getStylesRef('autoswapContainerRef')}`]: {
          '&:hover': {
            ...sharedHoverStyles,
          },
        },
      },
    },
    autoswapButtonNoPopover: {
      cursor: 'auto !important',
    },
    autoswapButtonOpened: {
      '&:not(:disabled)': {
        [`& .${getStylesRef('autoswapContainerRef')}`]: {
          ...sharedHoverStyles,
          '&::after': {
            opacity: 0.9,
          },
        },
      },
    },
    autoswapContainer: {
      ref: getStylesRef('autoswapContainerRef'),
      height: '47px',
      padding: '12px',
      '& > div': {
        zIndex: 1,
      },
    },
    autoswapContainerNoPopover: {
      '&::before': {
        animation: 'rotate 2s linear infinite',
      },
      '&:hover': {
        background: `${theme.colors?.level?.[0]} !important`,
      },
    },
    shuffleIcon: {
      color: 'rgba(232, 89, 12, 1)',
      stroke: 'rgba(232, 89, 12, 1)',
      strokeWidth: '6px',
    },
    linkBreakIcon: {
      color: theme.colors?.subtle?.[0],
    },
    expandIcon: {
      color: theme.colors?.subtle?.[0],
    },
    autoswapLabel: {
      backgroundImage:
        'linear-gradient(to right, rgba(232, 89, 12, 1), rgba(0, 73, 255, 1))',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontWeight: 600,
      margin: '0 4px',
    },
    swapArrowIcon: {
      fill: theme.colors?.subtle?.[0],
      margin: '0 4px',
    },
    popover: {
      background: theme.colors?.level?.[0],
      border: `1px solid ${theme.colors?.level?.[2]}`,
      borderRadius: theme.radius.md,
    },
    infoIcon: {
      fill: theme.colors?.subtle?.[0],
    },
    badge: {
      height: '22px',
      padding: '2px 8px',
      '& .mantine-Badge-inner': {
        fontSize: rem(13),
        fontWeight: 500,
      },
    },
  };
});

export const getColorFromProp = (colorProp: string) => {
  const [colorName, shade] = colorProp.split('.');

  const actualShade = shade ? parseInt(shade) : 0;

  const colorValue = theme.colors?.[colorName]?.[actualShade];

  return colorValue ?? '';
};

export const addLineClamp = (numberOfLines = 1): CSSObject => ({
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  display: 'block',

  '@supports (-webkit-line-clamp: 1)': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'initial',
    WebkitLineClamp: numberOfLines,
    WebkitBoxOrient: 'vertical',
  },
});
