# Testing Guide

This project uses **Jest** and **React Testing Library** for unit and integration testing.

## Setup

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (for development)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

## Test Structure

Tests are located next to their corresponding files:
- Component tests: `components/**/__tests__/*.test.tsx`
- Utility tests: `lib/**/__tests__/*.test.ts`
- Page tests: `app/**/__tests__/*.test.tsx`

## Writing Tests

### Component Testing Example

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from '../Button'

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await userEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Testing Hooks

For testing custom hooks, use `@testing-library/react-hooks`:

```typescript
import { renderHook } from '@testing-library/react'
import { useAuth } from '../useAuth'

describe('useAuth hook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
  })
})
```

### Testing API Routes

For testing API routes, you can use Jest with Next.js API route testing:

```typescript
import { createMocks } from 'node-mocks-http'
import handler from '../api/transcribe/route'

describe('/api/transcribe', () => {
  it('handles POST requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    })
    
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
  })
})
```

## Mocking

### Mocking Next.js Router

The router is already mocked in `jest.setup.js`. If you need custom mocks:

```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/test',
  }),
}))
```

### Mocking Firebase

Firebase is mocked in `jest.setup.js`. For specific Firebase mocks:

```typescript
jest.mock('@/lib/firebase/config', () => ({
  db: {
    collection: jest.fn(),
  },
  auth: {
    currentUser: { uid: 'test-user' },
  },
}))
```

### Mocking OpenAI API

```typescript
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({
          text: 'Transcribed text',
        }),
      },
    },
  })),
}))
```

## Test Coverage

Current coverage targets:
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

View coverage report:
```bash
npm run test:coverage
```

Open `coverage/lcov-report/index.html` in your browser to see detailed coverage.

## Best Practices

1. **Test user behavior, not implementation**
   - Test what users see and do
   - Avoid testing internal state

2. **Use semantic queries**
   - Prefer `getByRole`, `getByLabelText`, `getByText`
   - Avoid `getByTestId` when possible

3. **Keep tests isolated**
   - Each test should be independent
   - Use `beforeEach`/`afterEach` for setup/cleanup

4. **Test edge cases**
   - Empty states
   - Error states
   - Loading states
   - Boundary conditions

5. **Mock external dependencies**
   - Firebase
   - API calls
   - Browser APIs

## Current Test Files

- ✅ `components/ui/__tests__/Button.test.tsx`
- ✅ `components/ui/__tests__/Card.test.tsx`
- ✅ `components/estimating/__tests__/KPISummary.test.tsx`
- ✅ `lib/utils/__tests__/cn.test.ts`
- ✅ `lib/openai/__tests__/usageTracker.test.ts`
- ✅ `app/__tests__/page.test.tsx`

## Adding New Tests

1. Create a `__tests__` folder next to your component/file
2. Create a test file: `ComponentName.test.tsx`
3. Write tests following the examples above
4. Run `npm test` to verify

## Troubleshooting

### Tests fail with "Cannot find module"
- Make sure paths in `jest.config.js` match your `tsconfig.json`
- Check that `moduleNameMapper` is configured correctly

### Firebase errors in tests
- Firebase is mocked in `jest.setup.js`
- If you need specific mocks, add them to your test file

### Router errors
- Next.js router is mocked in `jest.setup.js`
- For custom router behavior, mock it in your test file

### Coverage not generating
- Make sure you're running `npm run test:coverage`
- Check that files are in `collectCoverageFrom` paths

## CI/CD Integration

To run tests in CI:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test -- --coverage --watchAll=false
```

## Next Steps

- [ ] Add E2E tests with Playwright
- [ ] Add visual regression tests
- [ ] Increase test coverage to 80%+
- [ ] Add integration tests for API routes
- [ ] Add tests for Firebase interactions

