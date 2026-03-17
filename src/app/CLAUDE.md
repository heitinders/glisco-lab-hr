# App Directory Context
- (auth) group: public routes (login, forgot-password, reset-password)
- (dashboard) group: protected routes with sidebar layout
- api/ directory: all API routes follow RBAC + audit pattern
- Use server components by default; 'use client' only when needed
