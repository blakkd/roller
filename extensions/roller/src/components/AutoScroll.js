import defaultOptions from '../defaultOptions'
import { findScroll, getDocumentContext, isScrollable } from '../helpers/scroll'
import * as utils from '../helpers/utils'
import RollerOverlay from './RollerOverlay'

export default class AutoScroll {
  constructor() {
    this.options = defaultOptions
    this.visible = false
    this.backgroundImage = null
    this.backgroundPositionX = 0
    this.backgroundPositionY = 0
    this.cursor = 'auto'
    this.timeout = null
    this.oldX = null
    this.oldY = null
    this.dirX = 0
    this.dirY = 0
    this.clicked = false
    this.scrolling = false
    this.overlay = null

    const { htmlNode, bodyNode } = getDocumentContext()
    this.htmlNode = htmlNode
    this.bodyNode = bodyNode
    this.htmlScrollBehavior = htmlNode.style.scrollBehavior
    this.bodyScrollBehavior = bodyNode.style.scrollBehavior

    this.handleMouseDown = this.handleMouseDown.bind(this)
    this.handleMouseMove = this.handleMouseMove.bind(this)
    this.handleMouseUp = this.handleMouseUp.bind(this)
    this.handleMouseWheel = this.handleMouseWheel.bind(this)
  }

  init() {
    addEventListener('mousedown', this.handleMouseDown, true)
  }

  destroy() {
    this.stop()
    removeEventListener('mousedown', this.handleMouseDown, true)
  }

  startCycle(elem, scroller, root) {
    let scrollX, scrollY

    const scrollerStyle = getComputedStyle(scroller)
    const rowReverse = scrollerStyle.flexDirection === 'row-reverse'
    const colReverse = scrollerStyle.flexDirection === 'column-reverse'

    const loop = () => {
      this.timeout = requestAnimationFrame(loop)

      scrollX = root ? window.scrollX : scroller.scrollLeft
      scrollY = root ? window.scrollY : scroller.scrollTop

      const scrollWidth = scroller.scrollWidth - scroller.clientWidth
      const scrollHeight = scroller.scrollHeight - scroller.clientHeight

      scrollX = utils.clamp(
        scrollX + this.dirX,
        rowReverse ? -scrollWidth : 0,
        rowReverse ? 0 : scrollWidth
      )
      scrollY = utils.clamp(
        scrollY + this.dirY,
        colReverse ? -scrollHeight : 0,
        colReverse ? 0 : scrollHeight
      )

      if (root) {
        window.scroll(scrollX, scrollY)
      } else {
        scroller.scrollLeft = scrollX
        scroller.scrollTop = scrollY
      }
    }

    loop()
  }

  shouldSticky(x, y) {
    return (
      this.options.stickyScroll &&
      utils.hypot(x, y) < this.options.dragThreshold
    )
  }

  scale(value) {
    return value / this.options.moveSpeed
  }

  handleMouseWheel(event) {
    utils.stopEvent(event, true)
  }

  handleMouseMove(event) {
    utils.stopEvent(event, true)

    const x = event.clientX - this.oldX
    const y = event.clientY - this.oldY

    if (utils.hypot(x, y) > this.options.moveThreshold) {
      this.cursor = utils.getStyleFromAngle(utils.angle(x, y))

      let dx = x
      let dy = y

      if (this.options.sameSpeed) {
        dx = utils.max(dx, 1) * 50
        dy = utils.max(dy, 1) * 50
      }

      dx = this.scale(dx)
      dy = this.scale(dy)

      if (this.options.shouldCap) {
        dx = utils.max(dx, this.options.capSpeed)
        dy = utils.max(dy, this.options.capSpeed)
      }

      this.dirX = dx
      this.dirY = dy
    } else {
      this.cursor = 'auto'
      this.dirX = 0
      this.dirY = 0
    }
  }

  handleMouseUp(event) {
    utils.stopEvent(event, true)

    const x = event.clientX - this.oldX
    const y = event.clientY - this.oldY

    if (this.clicked || !this.shouldSticky(x, y)) {
      this.stop()
    } else {
      this.clicked = true
    }
  }

  stop() {
    cancelAnimationFrame(this.timeout)
    this.timeout = null

    removeEventListener('wheel', this.handleMouseWheel, true)
    removeEventListener('mousemove', this.handleMouseMove, true)
    removeEventListener('mouseup', this.handleMouseUp, true)

    this.visible = false
    this.cursor = 'auto'
    this.oldX = null
    this.oldY = null
    this.dirX = 0
    this.dirY = 0
    this.clicked = false
    this.scrolling = false

    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }

    this.htmlNode.style.setProperty('scroll-behavior', this.htmlScrollBehavior)
    this.bodyNode.style.setProperty('scroll-behavior', this.bodyScrollBehavior)
  }

  start(o, x, y) {
    this.scrolling = true
    this.oldX = x
    this.oldY = y

    this.startCycle(o.element, o.scroller, o.root)

    addEventListener('wheel', this.handleMouseWheel, true)
    addEventListener('mousemove', this.handleMouseMove, true)
    addEventListener('mouseup', this.handleMouseUp, true)

    this.visible = true
    this.backgroundImage = utils.getImageFromScrollNormal(o)
    this.backgroundPositionX = x
    this.backgroundPositionY = y

    this.updateOverlay()

    this.htmlNode.style.setProperty('scroll-behavior', 'auto', 'important')
    this.bodyNode.style.setProperty('scroll-behavior', 'auto', 'important')
  }

  updateOverlay() {
    if (this.visible) {
      if (!this.overlay) {
        this.overlay = document.createElement('roller-overlay')
        document.documentElement.appendChild(this.overlay)
      }
      this.overlay.bgImage = this.backgroundImage
      this.overlay.bgPosition = `${this.backgroundPositionX - 13}px ${this.backgroundPositionY - 13}px`
      this.overlay.cursor = this.cursor
    }
  }

  handleMouseDown(event) {
    if (this.scrolling) {
      utils.stopEvent(event, true)
    } else {
      const path = event.composedPath()
      const target = path.length === 0 ? null : path[0]

      if (
        target != null &&
        ((event.button === 1 && this.options.middleClick) ||
          (event.button === 0 &&
            (event.ctrlKey || event.metaKey) &&
            this.options.ctrlClick)) &&
        event.clientX < this.htmlNode.clientWidth &&
        event.clientY < this.htmlNode.clientHeight &&
        (this.options.scrollOnLinks || isScrollable(target))
      ) {
        const elem = findScroll(target, this.options.innerScroll)
        if (elem !== null) {
          utils.stopEvent(event, true)
          this.start(elem, event.clientX, event.clientY)
        }
      }
    }
  }
}
