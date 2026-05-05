{
  "version": 2,
  "outputDirectory": ".",
  "buildCommand": "node vercel-build.js",
  "rewrites": [
    { "source": "/admin", "destination": "/admin/login.html" },
    { "source": "/admin/dashboard", "destination": "/admin/dashboard.html" },
    { "source": "/(.*)", "destination": "/$1" }
  ],
  "headers": [
    {
      "source": "/admin/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src * data:; font-src *; connect-src *; frame-src *;"
        }
      ]
    },
    {
      "source": "/admin/dashboard-mini.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store"
        }
      ]
    }
  ]
}
