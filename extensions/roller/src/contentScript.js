import AutoScroll from './components/AutoScroll'
import defaults from './defaultOptions'

const autoScroll = new AutoScroll()

chrome?.storage?.local.get(defaults, (options) => {
  if (navigator.platform === 'Win32' && options.disableOnWindows) {
    return
  }
  autoScroll.options = options
  autoScroll.init()
})

export default autoScroll
