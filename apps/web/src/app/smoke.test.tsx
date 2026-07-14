import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ApplicationPage from './app/page'
import HomePage from './page'

describe('web shell smoke tests', () => {
  it('renders an accessible home landmark', () => {
    const output = renderToStaticMarkup(createElement(HomePage))
    expect(output).toContain('<main')
    expect(output).toContain('Growth intelligence, made operational')
  })

  it('renders the protected workspace loading boundary', () => {
    expect(renderToStaticMarkup(createElement(ApplicationPage))).toContain('Loading workspace')
  })
})
