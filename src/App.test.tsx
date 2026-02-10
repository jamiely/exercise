import { render, screen } from '@testing-library/react'
import App from './App'

describe('App shell', () => {
  it('renders the loaded program and first exercise', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /knee pain/i })).toBeInTheDocument()
    expect(screen.getByText(/first exercise: quad set/i)).toBeInTheDocument()
  })
})
