import { Text } from '@hiropay/common'
import { clsx, createStyles } from '@mantine/core'
import {
  ReactNode,
  RefObject,
  WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useViewBasedState } from '../hooks'
import { ContainerWrapper } from './Container'

const useStyles = createStyles((theme, { opacityTop, opacityBottom }: any) => ({
  container: {
    position: 'relative',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  shadow: {
    height: '1px',
    width: '90%',
    background: '#000',
    boxShadow: '0px -70px 35px 60px rgba(0,0,0,0.5)',
    margin: '0 auto',
    position: 'sticky',
    borderRadius: '50%',
    transitionProperty: 'opacity',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '300ms',
    pointerEvents: 'none',
    zIndex: 2,
  },
  bottomTop: {
    top: '0',
    opacity: opacityTop ? 1 : 0,
  },
  bottomShadow: {
    bottom: '15px',
    transform: 'rotate(180deg)',
    opacity: opacityBottom ? 1 : 0,
  },
}))

export interface ScrollShadowWrapperProps {
  children: ReactNode
}

export const ScrollShadowWrapper = ({ children }: ScrollShadowWrapperProps) => {
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollHeight, setScrollHeight] = useState(0)
  const [clientHeight, setClientHeight] = useState(0)
  const [wrapperHeight, setWrapperHeight] = useState(0)

  const { subheading } = useViewBasedState(children as JSX.Element)

  const wrapper =
    document.getElementsByClassName('container-wrapper')?.[0] ?? null

  const getVisibleSides = useMemo((): { top: boolean; bottom: boolean } => {
    const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) <= 1
    const isTop = scrollTop === 0
    const isBetween = !isTop && !isBottom

    return {
      top: (isBottom || isBetween) && !(isTop && isBottom),
      bottom: (isTop || isBetween) && !(isTop && isBottom),
    }
  }, [clientHeight, scrollHeight, scrollTop])

  const { classes } = useStyles({
    opacityTop: getVisibleSides.top,
    opacityBottom: getVisibleSides.bottom,
  })

  const onScrollHandler = (event: WheelEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
    setScrollHeight(event.currentTarget.scrollHeight)
    setClientHeight(event.currentTarget.clientHeight)
  }

  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const resetRefSizes = (ref: RefObject<HTMLDivElement>) => {
      if (!ref.current) return

      setScrollTop(ref.current.scrollTop)
      setScrollHeight(ref.current.scrollHeight)
      setClientHeight(ref.current.clientHeight)
    }

    resetRefSizes(wrapperRef)
  }, [wrapperHeight, wrapperRef?.current?.clientHeight])

  useEffect(() => {
    if (!wrapper) return
    const resizeObserver = new ResizeObserver((element) => {
      setWrapperHeight(element?.[0]?.contentRect?.height ?? 0)
    })
    resizeObserver.observe(wrapper)
    return () => resizeObserver.disconnect() // clean up
  }, [wrapper])

  return (
    <div
      ref={wrapperRef}
      className={classes.container}
      onScroll={onScrollHandler}
    >
      <div className={clsx(classes.shadow, classes.bottomTop)} />
      <ContainerWrapper direction="column">
        {subheading && (
          <Text c="subtle.0" size={14} weight={600} mb={16}>
            {subheading}
          </Text>
        )}
        {children}
      </ContainerWrapper>
      <div className={clsx(classes.shadow, classes.bottomShadow)} />
    </div>
  )
}
