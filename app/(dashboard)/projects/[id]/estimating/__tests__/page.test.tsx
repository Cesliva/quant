import { render, screen, waitFor } from '@testing-library/react'
import { useParams } from 'next/navigation'
import EstimatingPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

// Mock Firebase
jest.mock('@/lib/firebase/firestore', () => ({
  subscribeToCollection: jest.fn(() => jest.fn()), // Returns unsubscribe function
  getProjectPath: jest.fn((companyId, projectId, ...segments) => 
    `companies/${companyId}/projects/${projectId}/${segments.join('/')}`
  ),
}))

// Mock components
jest.mock('@/components/estimating/EstimatingGrid', () => {
  return function MockEstimatingGrid() {
    return <div data-testid="estimating-grid">Estimating Grid</div>
  }
})

jest.mock('@/components/estimating/KPISummary', () => {
  return function MockKPISummary() {
    return <div data-testid="kpi-summary">KPI Summary</div>
  }
})

jest.mock('@/components/estimating/VoiceHUD', () => {
  return function MockVoiceHUD() {
    return <div data-testid="voice-hud">Voice HUD</div>
  }
})

describe('EstimatingPage', () => {
  const mockUseParams = useParams as jest.MockedFunction<typeof useParams>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all components', () => {
    mockUseParams.mockReturnValue({ id: 'test-project' } as any)

    render(<EstimatingPage />)

    expect(screen.getByTestId('voice-hud')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-summary')).toBeInTheDocument()
    expect(screen.getByTestId('estimating-grid')).toBeInTheDocument()
  })

  it('uses project ID from params', () => {
    mockUseParams.mockReturnValue({ id: 'project-123' } as any)

    const { getProjectPath } = require('@/lib/firebase/firestore')
    render(<EstimatingPage />)

    expect(getProjectPath).toHaveBeenCalledWith(
      'default',
      'project-123',
      'lines'
    )
  })

  it('handles missing project ID', () => {
    mockUseParams.mockReturnValue({} as any)

    render(<EstimatingPage />)

    // Should still render components
    expect(screen.getByTestId('voice-hud')).toBeInTheDocument()
  })

  it('subscribes to Firestore collection', () => {
    mockUseParams.mockReturnValue({ id: 'test-project' } as any)

    const { subscribeToCollection } = require('@/lib/firebase/firestore')
    render(<EstimatingPage />)

    expect(subscribeToCollection).toHaveBeenCalled()
  })
})

