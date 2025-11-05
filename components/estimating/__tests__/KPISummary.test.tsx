import { render, screen } from '@testing-library/react'
import KPISummary from '../KPISummary'
import { EstimatingLine } from '../EstimatingGrid'

describe('KPISummary Component', () => {
  const mockLines: EstimatingLine[] = [
    {
      id: '1',
      item: 'Line 1',
      shape: 'W',
      size: '18x24',
      length: "15'-6\"",
      qty: 2,
      weight: 720,
      surfaceArea: 110,
      laborHours: 3.5,
      cost: 1250,
    },
    {
      id: '2',
      item: 'Line 2',
      shape: 'W',
      size: '18x24',
      length: "15'-6\"",
      qty: 1,
      weight: 360,
      surfaceArea: 55,
      laborHours: 1.75,
      cost: 625,
    },
  ]

  it('renders all KPI cards', () => {
    render(<KPISummary lines={mockLines} />)
    
    expect(screen.getByText('Total Weight')).toBeInTheDocument()
    expect(screen.getByText('Total Surface Area')).toBeInTheDocument()
    expect(screen.getByText('Total Labor Hours')).toBeInTheDocument()
    expect(screen.getByText('Total Cost')).toBeInTheDocument()
  })

  it('calculates totals correctly', () => {
    render(<KPISummary lines={mockLines} />)
    
    // Total weight: 720 + 360 = 1080
    expect(screen.getByText('1080.00 lbs')).toBeInTheDocument()
    
    // Total surface area: 110 + 55 = 165
    expect(screen.getByText('165.00 SF')).toBeInTheDocument()
    
    // Total labor: 3.5 + 1.75 = 5.25
    expect(screen.getByText('5.25 hrs')).toBeInTheDocument()
    
    // Total cost: 1250 + 625 = 1875
    expect(screen.getByText('$1875.00')).toBeInTheDocument()
  })

  it('handles empty lines array', () => {
    render(<KPISummary lines={[]} />)
    
    expect(screen.getByText('0.00 lbs')).toBeInTheDocument()
    expect(screen.getByText('0.00 SF')).toBeInTheDocument()
    expect(screen.getByText('0.00 hrs')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('handles lines with missing values', () => {
    const incompleteLines: EstimatingLine[] = [
      {
        id: '1',
        item: 'Line 1',
        shape: 'W',
        size: '18x24',
        length: "15'-6\"",
        qty: 1,
        weight: 0,
        surfaceArea: 0,
        laborHours: 0,
        cost: 0,
      },
    ]
    
    render(<KPISummary lines={incompleteLines} />)
    
    expect(screen.getByText('0.00 lbs')).toBeInTheDocument()
  })
})

