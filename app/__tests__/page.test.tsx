import { render, screen } from '@testing-library/react'
import Home from '../page'

describe('Home Page', () => {
  it('renders the main title', () => {
    render(<Home />)
    expect(screen.getByText('Quant Estimating AI')).toBeInTheDocument()
  })

  it('renders navigation buttons', () => {
    render(<Home />)
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Project Details')).toBeInTheDocument()
    expect(screen.getByText('Estimating')).toBeInTheDocument()
    expect(screen.getByText('Spec Review')).toBeInTheDocument()
    expect(screen.getByText('Proposal')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })

  it('has correct links', () => {
    render(<Home />)
    
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: 'Project Details' })).toHaveAttribute('href', '/projects/test-project')
  })
})

