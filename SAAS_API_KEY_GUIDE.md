# SaaS API Key Management Guide

## Overview

For a production SaaS application, you should use **separate API keys** for development and production environments. This guide explains best practices.

## Current Setup

Your code currently uses a single environment variable:
```typescript
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;
```

This is fine for development, but for production SaaS, you need a better strategy.

## Recommended Approach

### Option 1: Separate API Keys (Recommended for MVP/Testing)

**For Development/Testing:**
- Keep using your current personal API key in `.env.local`
- This is fine for testing and development
- Monitor usage to avoid unexpected costs

**For Production:**
- Create a **new API key** specifically for production
- Store it in your hosting platform's environment variables (Vercel, Railway, etc.)
- Never commit production keys to git

**Pros:**
- Simple to set up
- Easy to track costs separately
- Can test with current key, switch before launch

**Cons:**
- Both keys tied to your personal account
- Rate limits apply per account, not per key

### Option 2: OpenAI Organization Account (Recommended for Production SaaS)

**For Production SaaS, you should:**

1. **Create an OpenAI Organization Account**
   - Go to https://platform.openai.com/org
   - Create a new organization for your business
   - Better rate limits, billing, and support

2. **Use Separate API Keys:**
   - **Development Key**: Your personal account (current setup)
   - **Production Key**: Organization account key
   - **Staging Key**: Optional, for testing before production

3. **Benefits:**
   - Higher rate limits for organization accounts
   - Better billing and cost tracking
   - Can add team members later
   - Professional setup for SaaS

## Implementation Strategy

### Phase 1: Development (Current)
✅ Use your current API key in `.env.local`
✅ Test all features
✅ Monitor costs and usage

### Phase 2: Pre-Launch
1. Create OpenAI organization account
2. Generate production API key
3. Set up environment variables in hosting platform
4. Test with production key in staging environment

### Phase 3: Launch
1. Switch to organization API key
2. Monitor usage and costs
3. Set up billing alerts
4. Implement usage tracking per customer

## Environment Variable Setup

### Development (.env.local)
```env
# Development - Your personal API key
OPENAI_API_KEY=sk-proj-your-dev-key-here
```

### Production (Hosting Platform)
```env
# Production - Organization API key
OPENAI_API_KEY=sk-proj-your-production-key-here
```

### Code Already Supports This
Your code already reads from `process.env.OPENAI_API_KEY`, so:
- **Development**: Uses `.env.local`
- **Production**: Uses hosting platform's environment variables
- **No code changes needed!**

## Cost Considerations

### Current Model: `gpt-4o-mini`
- **Cost**: ~$0.15 per 1M input tokens, $0.60 per 1M output tokens
- **Very affordable** for SaaS
- Good performance for your use case

### Cost Per Request (Estimate)
- Voice agent request: ~500-2000 tokens = $0.0003 - $0.0012
- Very low cost per user interaction

### Pricing Strategy Options
1. **Pass-through**: Charge customers cost + margin
2. **Flat fee**: Include in subscription price
3. **Usage-based**: Charge per AI request
4. **Hybrid**: Base plan + usage overage

## Security Best Practices

### ✅ DO:
- Use environment variables (never hardcode)
- Use different keys for dev/staging/production
- Rotate keys periodically
- Monitor API usage and costs
- Set up billing alerts
- Use organization account for production

### ❌ DON'T:
- Commit API keys to git
- Share keys between environments
- Use personal keys in production
- Expose keys in client-side code
- Hardcode keys in source files

## Rate Limits

### Personal Account
- Free tier: Very low limits
- Paid tier: Higher limits, but still limited

### Organization Account
- Higher rate limits
- Better for production workloads
- Can request limit increases

## Migration Path

### Step 1: Test with Current Key (Now)
- Continue development with current key
- Monitor usage and costs
- Test all features thoroughly

### Step 2: Create Organization Account (Before Launch)
- Sign up for OpenAI organization
- Generate production API key
- Test in staging environment

### Step 3: Deploy to Production
- Set production API key in hosting platform
- Monitor closely for first few days
- Set up alerts and monitoring

## Monitoring & Alerts

### Set Up:
1. **OpenAI Dashboard**: Monitor usage at platform.openai.com
2. **Billing Alerts**: Set up spending limits
3. **Application Logs**: Track API calls in your app
4. **Cost Tracking**: Log costs per customer/project

### Recommended Tools:
- OpenAI Dashboard (built-in)
- Your application's usage tracking (already implemented)
- Hosting platform monitoring (Vercel, Railway, etc.)

## Recommendation

**For your SaaS:**

1. **Now (Development)**: ✅ Keep using your current API key
   - It's fine for testing
   - Monitor costs
   - Test all features

2. **Before Launch**: Create OpenAI organization account
   - Better for production
   - Higher rate limits
   - Professional setup

3. **At Launch**: Switch to organization API key
   - Set in production environment variables
   - No code changes needed
   - Monitor usage

## Next Steps

1. Continue development with current key
2. When ready to launch, create organization account
3. Generate production API key
4. Set in hosting platform environment variables
5. Deploy and monitor

The code is already set up correctly - you just need to switch the API key when you're ready to launch!

