import { resolveRedisUrl } from './resolve-redis-url';

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  workerOnly: process.env.WORKER_ONLY === 'true',
  port: parseInt(process.env.PORT || '3001', 10),

  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'forge',
    password: process.env.DB_PASSWORD || 'forge',
    name: process.env.DB_NAME || 'forge_db',
    poolMax: parseInt(
      process.env.DB_POOL_MAX ||
        (process.env.DATABASE_URL?.includes('neon.tech') ? '5' : '20'),
      10,
    ),
    connectTimeoutMs: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '10000', 10),
    idleTimeoutMs: parseInt(
      process.env.DB_POOL_IDLE_TIMEOUT_MS ||
        (process.env.DATABASE_URL?.includes('neon.tech') ? '120000' : '10000'),
      10,
    ),
    slowQueryMs: parseInt(process.env.DB_SLOW_QUERY_MS || '2000', 10),
  },

  redis: {
    url: resolveRedisUrl(process.env),
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'jwt-refresh-secret-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  auth: {
    /** e.g. `.forgestudios.net` when API and web are on different subdomains */
    refreshCookieDomain: process.env.AUTH_REFRESH_COOKIE_DOMAIN || '',
    /**
     * M-S2: opt-out of the double-submit CSRF check for cookie-based refresh.
     * Fail-safe by default (enabled in every environment). Only honoured
     * outside production — production ignores the flag entirely.
     */
    csrfDisabled: process.env.CSRF_DISABLED === 'true' ? 'true' : '',
    requireVerifiedLogin: process.env.AUTH_REQUIRE_VERIFIED_LOGIN === 'true',
    lockout: {
      maxAttempts: parseInt(process.env.AUTH_LOCKOUT_MAX_ATTEMPTS || '10', 10),
      windowSec: parseInt(process.env.AUTH_LOCKOUT_WINDOW_SEC || '900', 10),
      lockoutSec: parseInt(process.env.AUTH_LOCKOUT_LOCKOUT_SEC || '1800', 10),
    },
    /** 6-digit email verification code (in addition to link). */
    emailOtpEnabled: process.env.AUTH_EMAIL_OTP_ENABLED === 'true',
  },

  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3BucketName: process.env.S3_BUCKET_NAME || 'forge-media',
    cloudfrontDomain: process.env.CLOUDFRONT_DOMAIN || '',
  },

  mux: {
    tokenId: process.env.MUX_TOKEN_ID || '',
    tokenSecret: process.env.MUX_TOKEN_SECRET || '',
    webhookSecret: process.env.MUX_WEBHOOK_SECRET || '',
    signingKeyId: process.env.MUX_SIGNING_KEY_ID || '',
    signingPrivateKey: process.env.MUX_SIGNING_PRIVATE_KEY || '',
    /** Signed playback token TTL (seconds). */
    signedPlaybackTtlSec: parseInt(process.env.MUX_SIGNED_PLAYBACK_TTL_SEC || '3600', 10),
    /** Reconnection grace period — host disconnect to auto-terminate (seconds). */
    idleGraceSec: parseInt(process.env.MUX_IDLE_GRACE_SEC || '60', 10),
    /** Soft cap on idle→active cycles per stream before logging a rapid-reconnect warning. */
    maxReconnectAttempts: parseInt(process.env.MUX_MAX_RECONNECT_ATTEMPTS || '20', 10),
  },

  video: {
    /** VOD transcode: `mux` (Mux Video HLS/ABR) or `ffmpeg` (S3 + worker, local dev). */
    transcodeProvider: process.env.VIDEO_TRANSCODE_PROVIDER || 'mux',
    /** Presigned GET TTL for Mux ingest from private S3 (seconds). */
    muxIngestUrlTtlSec: parseInt(process.env.MUX_INGEST_URL_TTL_SEC || '43200', 10),
  },

  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  mail: {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    /** Optional; when set (or SMTP_PASS=re_*), uses Resend HTTP API instead of SMTP. */
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.MAIL_FROM || 'noreply@localhost',
    webUrl: process.env.WEB_URL || 'http://localhost:3000',
  },

  oauth: {
    google: {
      enabled: process.env.GOOGLE_OAUTH_ENABLED === 'true',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl:
        process.env.GOOGLE_OAUTH_CALLBACK_URL ||
        'http://localhost:3001/api/v1/auth/google/callback',
      webSuccessUrl:
        process.env.WEB_OAUTH_SUCCESS_URL ||
        `${process.env.WEB_URL || 'http://localhost:3000'}/auth/oauth/callback`,
    },
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    /** Full service account JSON (when org policy blocks Console key download — admin provides file). */
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
    /** Use GOOGLE_APPLICATION_CREDENTIALS (Workload Identity Federation on Fly). */
    useApplicationDefault: process.env.FIREBASE_USE_APPLICATION_DEFAULT === 'true',
    fcmEnabled: process.env.FCM_ENABLED === 'true',
    appCheckEnabled: process.env.APP_CHECK_ENABLED === 'true',
  },

  /** Comma-separated: e.g. multipart_upload,blueprints_public */
  featureFlags: process.env.FEATURE_FLAGS || '',

  features: {
    /**
     * Skill-economy LMS (courses, podcasts, creator programs).
     * Default off — YouTube-replica mode. Set FEATURES_SKILL_ECONOMY_LMS=true to re-enable.
     */
    skillEconomyLms: process.env.FEATURES_SKILL_ECONOMY_LMS === 'true',
  },

  entitlements: {
    mockSubscriptionsEnabled:
      process.env.MOCK_SUBSCRIPTIONS_ENABLED === 'true' ||
      (process.env.NODE_ENV || 'development') !== 'production',
  },

  billing: {
    provider: process.env.BILLING_PROVIDER || 'stub',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    stripeConnectRefreshUrl: process.env.STRIPE_CONNECT_REFRESH_URL || '',
    /** Platform fee % on Connect destination charges (default 10). */
    stripePlatformFeePercent: parseInt(process.env.STRIPE_PLATFORM_FEE_PERCENT || '10', 10),
  },

  livekit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },

  stream: {
    profanityFilterEnabled: process.env.STREAM_PROFANITY_FILTER_ENABLED !== 'false',
    chatAsync: process.env.STREAM_CHAT_ASYNC === 'true',
    snapshotRetentionDays: parseInt(process.env.STREAM_SNAPSHOT_RETENTION_DAYS || '90', 10),
    aiModerationEnabled: process.env.STREAM_AI_MODERATION_ENABLED !== 'false',
    superChatEnabled: process.env.STREAM_SUPER_CHAT_ENABLED !== 'false',
    superChatMinCents: parseInt(process.env.STREAM_SUPER_CHAT_MIN_CENTS || '100', 10),
    superChatMaxCents: parseInt(process.env.STREAM_SUPER_CHAT_MAX_CENTS || '50000', 10),
    superChatHighlightSeconds: parseInt(process.env.STREAM_SUPER_CHAT_HIGHLIGHT_SEC || '120', 10),
    chatArchiveDays: parseInt(process.env.STREAM_CHAT_ARCHIVE_DAYS || '365', 10),
    defaultClipDurationMs: parseInt(process.env.STREAM_CLIP_DURATION_MS || '30000', 10),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  ai: {
    /** Async LLM judge tail for community moderation queue (requires OPENAI_API_KEY). */
    moderationLlmEnabled: process.env.AI_MODERATION_LLM_ENABLED === 'true',
    /** Creator copilot features (discussion summaries) via OpenAI chat completions. */
    copilotEnabled: process.env.AI_COPILOT_ENABLED === 'true',
    copilotModel: process.env.AI_COPILOT_MODEL || 'gpt-4.1-mini',
    /** Claude-powered creator insights copilot (requires ANTHROPIC_API_KEY). */
    claudeEnabled: process.env.AI_CLAUDE_ENABLED === 'true',
    claudeModel: process.env.AI_CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
    /** Cost guard: only LLM-judge messages whose fast-path score is at/above this (borderline tail). */
    moderationReviewThreshold: parseFloat(process.env.AI_MODERATION_REVIEW_THRESHOLD || '0.25'),
    /** Max LLM (OpenAI) calls per UTC day across all AI features. 0 = unlimited. */
    dailyLlmBudget: parseInt(process.env.AI_DAILY_LLM_BUDGET || '0', 10),
  },
});
