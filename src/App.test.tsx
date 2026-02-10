import { render, screen } from '@testing-library/react'
import App from './App'

describe('App shell', () => {
  it('renders the tracker heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /exercise tracker/i }),
    ).toBeInTheDocument()
  })
})
