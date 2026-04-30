<svelte:options tag="auto-scroll" />

<script>
  import { onDestroy, onMount } from 'svelte'
  import * as utils from '../helpers/utils'
  import { findScroll, getDocumentContext, isScrollable } from '../helpers/scroll'
  import defaultOptions from '../defaultOptions'

  export let options = defaultOptions

  let visible = false
  let backgroundImage = null
  let backgroundPositionX = 0
  let backgroundPositionY = 0
  let cursor = 'auto'

  let timeout = null
  let oldX = null
  let oldY = null
  let dirX = 0
  let dirY = 0
  let clicked = false
  let scrolling = false

  const { htmlNode } = getDocumentContext()

  // Keep default scroll behavior
  // TODO: Handle current container behavior?
  // TODO: Test for SVG
  const scrollBehavior = htmlNode.style.scrollBehavior

  /**
   * The timer that does the actual scrolling; must be very fast so that the scrolling is smooth.
   *
   * @param elem
   * @param scroller
   * @param root
   */
  function startCycle(elem, scroller, root) {
     let scrollX, scrollY

     function loop() {
      timeout = requestAnimationFrame(loop)

      scrollX = root ? window.scrollX : scroller.scrollLeft
      scrollY = root ? window.scrollY : scroller.scrollTop

      let scrollWidth = scroller.scrollWidth - elem.clientWidth,
        scrollHeight = scroller.scrollHeight - elem.clientHeight

      scrollX = utils.clamp(scrollX + dirX, 0, scrollWidth)
      scrollY = utils.clamp(scrollY + dirY, 0, scrollHeight)

      // This is needed to support SVG
      // This triggers a reflow
      if (root) {
        window.scroll(scrollX, scrollY)
      } else {
        scroller.scrollLeft = scrollX
        scroller.scrollTop = scrollY
      }
    }

    loop()
  }

  /**
   * @param x
   * @param y
   * @returns {boolean}
   */
  function shouldSticky(x, y) {
    return options.stickyScroll && utils.hypot(x, y) < options.dragThreshold
  }

  /**
   * @param value
   * @returns {number}
   */
  function scale(value) {
    return value / options.moveSpeed
  }

  /** @param {WheelEvent} event */
  function handleMouseWheel(event) {
    utils.stopEvent(event, true)
  }

  /** @param {MouseEvent} event */
  function handleMouseMove(event) {
    utils.stopEvent(event, true)

    let x = event.clientX - oldX,
      y = event.clientY - oldY

    if (utils.hypot(x, y) > options.moveThreshold) {
      cursor = getStyleFromAngle(utils.angle(x, y))

      // 10 = 5
      // 5  = 10
      // 1  = 50
      if (options.sameSpeed) {
        x = utils.max(x, 1) * 50
        y = utils.max(y, 1) * 50
      }

      x = scale(x)
      y = scale(y)

      if (options.shouldCap) {
        x = utils.max(x, options.capSpeed)
        y = utils.max(y, options.capSpeed)
      }

      dirX = x
      dirY = y
    } else {
      cursor = 'auto'
      dirX = 0
      dirY = 0
    }
  }

  /** @param {MouseEvent} event */
  function handleMouseUp(event) {
    utils.stopEvent(event, true)

    let x = event.clientX - oldX,
      y = event.clientY - oldY

    if (clicked || !shouldSticky(x, y)) {
      stop()
    } else {
      clicked = true
    }
  }

  /** Stop the scrolling Remove all the listeners, and reset the scrolling state values */
  function stop() {
    cancelAnimationFrame(timeout)
    timeout = null

    removeEventListener('wheel', handleMouseWheel, true)
    removeEventListener('mousemove', handleMouseMove, true)
    removeEventListener('mouseup', handleMouseUp, true)

    visible = false
    cursor = 'auto'
    oldX = null
    oldY = null
    dirX = 0
    dirY = 0
    clicked = false
    scrolling = false

    // Restore scroll behavior
    htmlNode.style.setProperty('scroll-behavior', scrollBehavior)
  }

  /**
   * Start the scrolling
   *
   * @param o
   * @param x
   * @param y
   */
  function start(o, x, y) {
    scrolling = true
    oldX = x
    oldY = y

    startCycle(o.element, o.scroller, o.root)

    addEventListener('wheel', handleMouseWheel, true)
    addEventListener('mousemove', handleMouseMove, true)
    addEventListener('mouseup', handleMouseUp, true)

    visible = true
    backgroundImage = getImageFromScrollNormal(o)
    backgroundPositionX = x
    backgroundPositionY = y

    // Force normal scroll behavior to fix the unresponsive movements
    htmlNode.style.setProperty('scroll-behavior', 'auto')
  }

  /** @param {MouseEvent} event */
  function handleMouseDown(event) {
    if (scrolling) {
      utils.stopEvent(event, true)
    } else {
      const path = event.composedPath()
      // TODO use e.target instead of null ?
      const target = path.length === 0 ? null : path[0]

      if (
        target != null &&
        ((event.button === 1 && options.middleClick) || (event.button === 0 && (event.ctrlKey || event.metaKey) && options.ctrlClick)) &&
        // Make sure the click is not on a scrollbar
        // TODO what about using middle click on the scrollbar of a non-<html> element ?
        event.clientX < htmlNode.clientWidth &&
        event.clientY < htmlNode.clientHeight &&
        (options.scrollOnLinks || isScrollable(target))
      ) {
        const elem = findScroll(target, options.innerScroll)
        if (elem !== null) {
          utils.stopEvent(event, true)
          start(elem, event.clientX, event.clientY)
        }
      }
    }
  }

  onMount(() => {
    addEventListener('mousedown', handleMouseDown, true)
  })

  onDestroy(() => {
    stop()
    removeEventListener('mousedown', handleMouseDown, true)
  })
</script>

{#if visible}
  <div
    class="inner"
    style="transform: translateZ(0); position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2147483647; background-repeat: no-repeat;"
    style:background-image={`url("${backgroundImage}")`}
    style:background-position={`${backgroundPositionX - 13}px ${backgroundPositionY - 13}px`}
    style:cursor
  />
{/if}
